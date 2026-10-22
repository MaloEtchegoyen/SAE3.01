<?php

declare(strict_types=1);

namespace App\Model;

use Exception;
use PDO;
use Throwable;

/**
 * Modèle de gestion des commandes et de leurs lignes.
 *
 * Implémente la persistance des commandes, le calcul des totaux,
 * le gel des prix d'achat, le décrément des stocks, l'audit stock_movement
 * et le journal des modifications d'état par les administrateurs sous transaction PDO.
 */
final class OrderModel
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->initialiserJournal();
    }

    /**
     * S'assure que la table du journal d'audit des commandes existe.
     */
    private function initialiserJournal(): void
    {
        try {
            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS journal_commande (
                    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                    commande_id INT(10) UNSIGNED NOT NULL,
                    utilisateur_id INT(10) UNSIGNED NOT NULL,
                    ancien_statut VARCHAR(30) NOT NULL,
                    nouveau_statut VARCHAR(30) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    commentaire TEXT DEFAULT NULL,
                    date_action DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    KEY fk_journal_commande_commande (commande_id),
                    KEY fk_journal_commande_utilisateur (utilisateur_id),
                    KEY idx_journal_date (date_action),
                    CONSTRAINT fk_journal_commande_commande FOREIGN KEY (commande_id) REFERENCES commande (id) ON DELETE CASCADE,
                    CONSTRAINT fk_journal_commande_utilisateur FOREIGN KEY (utilisateur_id) REFERENCES utilisateur (id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );
        } catch (Throwable) {
            // Ignore si la table ou les contraintes sont déjà gérées
        }
    }

    /**
     * Génère un numéro de commande unique lisible et aléatoire.
     * Format : CMD-YYYYMMDD-XXXX (ex: CMD-20261020-A4B7)
     *
     * @return string
     */
    private function genererNumeroUnique(): string
    {
        $prefixe = 'CMD-' . date('Ymd') . '-';
        $numero = '';

        for ($tentative = 0; $tentative < 10; $tentative++) {
            $aleatoire = strtoupper(bin2hex(random_bytes(3)));
            $numeroCandidat = $prefixe . $aleatoire;

            $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM commande WHERE numero_commande = :numero');
            $stmt->execute(['numero' => $numeroCandidat]);
            if ((int) $stmt->fetchColumn() === 0) {
                $numero = $numeroCandidat;
                break;
            }
        }

        if ($numero === '') {
            $numero = $prefixe . strtoupper(bin2hex(random_bytes(6)));
        }

        return $numero;
    }

    /**
     * Crée une nouvelle commande pour un utilisateur donné à partir d'un panier d'articles.
     *
     * @param int $utilisateurId Identifiant de l'utilisateur connecté
     * @param array<int, array{produitId: int, varianteId?: ?int, quantite: int}> $articles
     * @return array{
     *     id: int,
     *     numero_commande: string,
     *     utilisateur_id: int,
     *     statut: string,
     *     total: float,
     *     date_commande: string,
     *     lignes: array<int, mixed>
     * }
     * @throws Exception En cas d'erreur de validation, rupture de stock ou échec SQL.
     */
    public function creerCommande(int $utilisateurId, array $articles): array
    {
        $nbArticles = count($articles);
        if ($nbArticles === 0) {
            throw new Exception('Votre panier est vide.');
        }

        $this->pdo->beginTransaction();

        try {
            $lignesPreparees = [];
            $totalCommande = 0.0;

            for ($i = 0; $i < $nbArticles; $i++) {
                $item = $articles[$i];
                $produitId = (int) ($item['produitId'] ?? 0);
                $varianteId = !empty($item['varianteId']) ? (int) $item['varianteId'] : null;
                $quantite = (int) ($item['quantite'] ?? 0);

                if ($produitId <= 0 || $quantite <= 0) {
                    throw new Exception('Article ou quantité invalide dans le panier.');
                }

                // Récupération et verrouillage pessimiste du produit
                $stmtProduit = $this->pdo->prepare(
                    'SELECT id, nom, prix, stock, actif FROM product WHERE id = :id FOR UPDATE'
                );
                $stmtProduit->execute(['id' => $produitId]);
                $produit = $stmtProduit->fetch();

                if (!$produit || (int) $produit['actif'] !== 1) {
                    throw new Exception('Le produit demandé n\'existe pas ou n\'est plus disponible.');
                }

                $nomProduit = (string) $produit['nom'];
                $nomVariante = null;
                $prixUnitaire = (float) $produit['prix'];
                $stockDisponible = (int) $produit['stock'];

                // Si aucune variante explicite mais des options choisies, résolution de la variante correspondante (OPT-b)
                if ($varianteId === null && !empty($item['options']) && is_array($item['options'])) {
                    $optValIds = [];
                    $nbOpts = count($item['options']);
                    for ($o = 0; $o < $nbOpts; $o++) {
                        $vId = (int) ($item['options'][$o]['valeurId'] ?? 0);
                        if ($vId > 0) {
                            $optValIds[] = $vId;
                        }
                    }
                    if (!empty($optValIds)) {
                        sort($optValIds);
                        $stmtTrouveVar = $this->pdo->prepare(
                            'SELECT pv.id FROM product_variant pv WHERE pv.product_id = :product_id AND pv.actif = 1'
                        );
                        $stmtTrouveVar->execute(['product_id' => $produitId]);
                        $toutesVars = $stmtTrouveVar->fetchAll();
                        $nbTV = count($toutesVars);
                        for ($tv = 0; $tv < $nbTV; $tv++) {
                            $candidatId = (int) $toutesVars[$tv]['id'];
                            $stmtV = $this->pdo->prepare(
                                'SELECT option_value_id FROM product_variant_value WHERE variant_id = :vid ORDER BY option_value_id ASC'
                            );
                            $stmtV->execute(['vid' => $candidatId]);
                            $candidatVals = array_map('intval', $stmtV->fetchAll(PDO::FETCH_COLUMN));
                            sort($candidatVals);
                            if ($candidatVals === $optValIds) {
                                $varianteId = $candidatId;
                                break;
                            }
                        }
                    }
                }

                // Si une variante est demandée ou résolue
                if ($varianteId !== null) {
                    $stmtVar = $this->pdo->prepare(
                        'SELECT id, nom, prix, stock, actif FROM product_variant WHERE id = :id AND product_id = :produit_id FOR UPDATE'
                    );
                    $stmtVar->execute([
                        'id'         => $varianteId,
                        'produit_id' => $produitId,
                    ]);
                    $variante = $stmtVar->fetch();

                    if (!$variante || (int) $variante['actif'] !== 1) {
                        throw new Exception("L'option choisie pour « {$nomProduit} » n'est plus disponible.");
                    }

                    $nomVariante = (string) $variante['nom'];
                    $prixUnitaire = (float) $variante['prix'];
                    $stockDisponible = (int) $variante['stock'];
                } elseif (!empty($item['options']) && is_array($item['options'])) {
                    // Si des options personnalisées sont sélectionnées (OPT-c)
                    $surcoutTotal = 0.0;
                    $nomsOptions = [];
                    $totalOpts = count($item['options']);
                    for ($j = 0; $j < $totalOpts; $j++) {
                        $optItem = $item['options'][$j];
                        $valId = (int) ($optItem['valeurId'] ?? 0);
                        if ($valId > 0) {
                            $stmtVal = $this->pdo->prepare('SELECT nom, surcout FROM product_option_value WHERE id = :id');
                            $stmtVal->execute(['id' => $valId]);
                            $valRow = $stmtVal->fetch();
                            if ($valRow) {
                                $surcoutTotal += (float) $valRow['surcout'];
                                $nomsOptions[] = (string) $valRow['nom'];
                            }
                        }
                    }
                    $prixUnitaire += $surcoutTotal;
                    if (!empty($nomsOptions)) {
                        $nomVariante = mb_substr(implode(', ', $nomsOptions), 0, 150);
                    } elseif (!empty($item['nomVariante'])) {
                        $nomVariante = mb_substr((string) $item['nomVariante'], 0, 150);
                    }
                } elseif (!empty($item['nomVariante'])) {
                    $nomVariante = mb_substr((string) $item['nomVariante'], 0, 150);
                }

                // Vérification du stock
                if ($stockDisponible < $quantite) {
                    $designation = $nomVariante !== null ? "{$nomProduit} ({$nomVariante})" : $nomProduit;
                    throw new Exception("Stock insuffisant pour « {$designation} » (disponible : {$stockDisponible}).");
                }

                $totalLigne = round($prixUnitaire * $quantite, 2);
                $totalCommande += $totalLigne;

                $lignesPreparees[] = [
                    'product_id'    => $produitId,
                    'variant_id'    => $varianteId,
                    'nom_produit'   => $nomProduit,
                    'nom_variante'  => $nomVariante,
                    'quantite'      => $quantite,
                    'prix_unitaire' => $prixUnitaire,
                    'total_ligne'   => $totalLigne,
                ];
            }

            $numeroCommande = $this->genererNumeroUnique();

            // Insertion de la commande
            $stmtCmd = $this->pdo->prepare(
                'INSERT INTO commande (numero_commande, utilisateur_id, statut, total, date_commande)
                 VALUES (:numero, :utilisateur_id, :statut, :total, NOW())'
            );
            $stmtCmd->execute([
                'numero'         => $numeroCommande,
                'utilisateur_id' => $utilisateurId,
                'statut'         => 'en cours',
                'total'          => $totalCommande,
            ]);

            $commandeId = (int) $this->pdo->lastInsertId();

            // Insertion des lignes et mise à jour des stocks
            $stmtLigne = $this->pdo->prepare(
                'INSERT INTO ligne_commande (commande_id, product_id, variant_id, nom_produit, nom_variante, quantite, prix_unitaire, total_ligne)
                 VALUES (:commande_id, :product_id, :variant_id, :nom_produit, :nom_variante, :quantite, :prix_unitaire, :total_ligne)'
            );

            $stmtUpdateStockProd = $this->pdo->prepare(
                'UPDATE product SET stock = stock - :quantite WHERE id = :id'
            );
            $stmtUpdateStockVar = $this->pdo->prepare(
                'UPDATE product_variant SET stock = stock - :quantite WHERE id = :id'
            );
            $stmtMouvementStock = $this->pdo->prepare(
                'INSERT INTO stock_movement (product_id, variant_id, quantite, motif, date_mouvement)
                 VALUES (:product_id, :variant_id, :quantite, :motif, NOW())'
            );

            $nbLignes = count($lignesPreparees);
            for ($j = 0; $j < $nbLignes; $j++) {
                $ligne = $lignesPreparees[$j];

                $stmtLigne->execute([
                    'commande_id'   => $commandeId,
                    'product_id'    => $ligne['product_id'],
                    'variant_id'    => $ligne['variant_id'],
                    'nom_produit'   => $ligne['nom_produit'],
                    'nom_variante'  => $ligne['nom_variante'],
                    'quantite'      => $ligne['quantite'],
                    'prix_unitaire' => $ligne['prix_unitaire'],
                    'total_ligne'   => $ligne['total_ligne'],
                ]);

                // Décrément du stock
                if ($ligne['variant_id'] !== null) {
                    $stmtUpdateStockVar->execute([
                        'quantite' => $ligne['quantite'],
                        'id'       => $ligne['variant_id'],
                    ]);
                    $stmtUpdateStockProd->execute([
                        'quantite' => $ligne['quantite'],
                        'id'       => $ligne['product_id'],
                    ]);
                } else {
                    $stmtUpdateStockProd->execute([
                        'quantite' => $ligne['quantite'],
                        'id'       => $ligne['product_id'],
                    ]);
                }

                // Mouvement d'audit
                $stmtMouvementStock->execute([
                    'product_id' => $ligne['product_id'],
                    'variant_id' => $ligne['variant_id'],
                    'quantite'   => -$ligne['quantite'],
                    'motif'      => 'commande ' . $numeroCommande,
                ]);
            }

            $this->pdo->commit();

            return [
                'id'              => $commandeId,
                'numero_commande' => $numeroCommande,
                'utilisateur_id'  => $utilisateurId,
                'statut'          => 'en cours',
                'total'           => $totalCommande,
                'date_commande'   => date('Y-m-d H:i:s'),
                'lignes'          => $lignesPreparees,
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw new Exception($e->getMessage(), (int) $e->getCode(), $e);
        }
    }

    /**
     * Recherche une commande par son numéro unique.
     *
     * @param string $numeroCommande
     * @param int|null $utilisateurId Optionnel : vérifie l'appartenance si fourni
     * @return array<string, mixed>|null
     */
    public function trouverParNumero(string $numeroCommande, ?int $utilisateurId = null): ?array
    {
        $sql = 'SELECT c.id, c.numero_commande, c.utilisateur_id, c.statut, c.total, c.date_commande,
                       u.login AS utilisateur_login
                  FROM commande c
             LEFT JOIN utilisateur u ON u.id = c.utilisateur_id
                 WHERE c.numero_commande = :numero';

        $params = ['numero' => $numeroCommande];

        if ($utilisateurId !== null) {
            $sql .= ' AND c.utilisateur_id = :utilisateur_id';
            $params['utilisateur_id'] = $utilisateurId;
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $commande = $stmt->fetch();

        if (!$commande) {
            return null;
        }

        $stmtLignes = $this->pdo->prepare(
            'SELECT lc.id, lc.product_id, lc.variant_id, lc.nom_produit, lc.nom_variante,
                    lc.quantite, lc.prix_unitaire, lc.total_ligne,
                    (
                        SELECT pi.url
                          FROM product_image pi
                         WHERE pi.product_id = lc.product_id
                      ORDER BY pi.est_principale DESC, pi.ordre ASC, pi.id ASC
                         LIMIT 1
                    ) AS image_url
               FROM ligne_commande lc
              WHERE lc.commande_id = :commande_id
           ORDER BY lc.id ASC'
        );
        $stmtLignes->execute(['commande_id' => (int) $commande['id']]);
        $lignesRaw = $stmtLignes->fetchAll();

        $lignes = [];
        $nb = count($lignesRaw);
        for ($i = 0; $i < $nb; $i++) {
            $row = $lignesRaw[$i];
            $lignes[] = [
                'id'            => (int) $row['id'],
                'product_id'    => (int) $row['product_id'],
                'variant_id'    => $row['variant_id'] !== null ? (int) $row['variant_id'] : null,
                'nom_produit'   => (string) $row['nom_produit'],
                'nom_variante'  => $row['nom_variante'] !== null ? (string) $row['nom_variante'] : null,
                'quantite'      => (int) $row['quantite'],
                'prix_unitaire' => (float) $row['prix_unitaire'],
                'total_ligne'   => (float) $row['total_ligne'],
                'image_url'     => $row['image_url'] ? (string) $row['image_url'] : null,
            ];
        }

        return [
            'id'                => (int) $commande['id'],
            'numero_commande'   => (string) $commande['numero_commande'],
            'utilisateur_id'    => (int) $commande['utilisateur_id'],
            'utilisateur_login' => (string) ($commande['utilisateur_login'] ?? ''),
            'statut'            => (string) $commande['statut'],
            'total'             => (float) $commande['total'],
            'date_commande'     => (string) $commande['date_commande'],
            'lignes'            => $lignes,
        ];
    }

    /**
     * Liste toutes les commandes pour l'administration avec filtres, tri et pagination.
     *
     * @param array{tri?: string, statut?: ?string, date?: ?string, montant?: ?float, page?: int, parPage?: int} $options
     * @return array{
     *     items: array<int, mixed>,
     *     page: int,
     *     pagesTotal: int,
     *     total: int,
     *     tri: string,
     *     parPage: int
     * }
     */

    /**
     * Liste les commandes récentes d'un utilisateur donné, triées par date décroissante.
     *
     * @param int $utilisateurId
     * @param int $limite
     * @return array<int, array{
     *     id: int,
     *     numero_commande: string,
     *     statut: string,
     *     total: float,
     *     date_commande: string,
     *     nb_articles: int,
     *     articles_apercu: string
     * }>
     */
    /**
     * Liste les commandes d'un client avec filtres, tri, pagination et détails des articles/options.
     * Conforme aux critères SUI-c.
     *
     * @param int $utilisateurId
     * @param array{tri?: string, statut?: ?string, periode?: ?string, page?: int, parPage?: int} $options
     * @return array{
     *     items: array<int, mixed>,
     *     page: int,
     *     pagesTotal: int,
     *     total: int,
     *     tri: string,
     *     parPage: int,
     *     statut: ?string,
     *     periode: ?string
     * }
     */
    public function listerPourClient(int $utilisateurId, array $options = []): array
    {
        $tri = (string) ($options['tri'] ?? 'date_desc');
        $statutFiltre = !empty($options['statut']) ? trim((string) $options['statut']) : null;
        $periodeFiltre = !empty($options['periode']) ? trim((string) $options['periode']) : null;
        $page = max(1, (int) ($options['page'] ?? 1));
        $parPage = max(1, min(50, (int) ($options['parPage'] ?? 10)));

        $trisAutorises = [
            'date_desc'    => 'c.date_commande DESC',
            'date_asc'     => 'c.date_commande ASC',
            'montant_desc' => 'c.total DESC, c.date_commande DESC',
            'montant_asc'  => 'c.total ASC, c.date_commande DESC',
        ];

        $clauseTri = $trisAutorises[$tri] ?? $trisAutorises['date_desc'];
        if (!isset($trisAutorises[$tri])) {
            $tri = 'date_desc';
        }

        $conditions = ['c.utilisateur_id = :utilisateur_id'];
        $parametres = ['utilisateur_id' => $utilisateurId];

        if ($statutFiltre !== null && $statutFiltre !== '' && $statutFiltre !== 'tous') {
            $conditions[] = 'c.statut = :statut';
            $parametres['statut'] = $statutFiltre;
        }

        if ($periodeFiltre !== null && $periodeFiltre !== '' && $periodeFiltre !== 'tous') {
            if ($periodeFiltre === '30j') {
                $conditions[] = 'c.date_commande >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
            } elseif ($periodeFiltre === '3m') {
                $conditions[] = 'c.date_commande >= DATE_SUB(NOW(), INTERVAL 3 MONTH)';
            } elseif ($periodeFiltre === '6m') {
                $conditions[] = 'c.date_commande >= DATE_SUB(NOW(), INTERVAL 6 MONTH)';
            } elseif ($periodeFiltre === 'annee') {
                $conditions[] = 'YEAR(c.date_commande) = YEAR(NOW())';
            }
        }

        $where = 'WHERE ' . implode(' AND ', $conditions);

        // Comptage total des commandes pour la pagination
        $sqlCount = "SELECT COUNT(*) FROM commande c {$where}";
        $stmtCount = $this->pdo->prepare($sqlCount);
        $stmtCount->execute($parametres);
        $total = (int) $stmtCount->fetchColumn();

        $pagesTotal = max(1, (int) ceil($total / $parPage));
        if ($page > $pagesTotal && $total > 0) {
            $page = $pagesTotal;
        }

        $offset = ($page - 1) * $parPage;

        $sql = "SELECT c.id, c.numero_commande, c.statut, c.total, c.date_commande,
                       COALESCE((SELECT SUM(lc.quantite) FROM ligne_commande lc WHERE lc.commande_id = c.id), 0) AS nb_articles
                  FROM commande c
                 {$where}
              ORDER BY {$clauseTri}
                 LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        $keys = array_keys($parametres);
        for ($i = 0, $nbParams = count($keys); $i < $nbParams; $i++) {
            $k = $keys[$i];
            $stmt->bindValue(':' . $k, $parametres[$k]);
        }
        $stmt->bindValue(':limit', $parPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $commandesRaw = $stmt->fetchAll();

        $items = [];
        $commandeIds = [];
        for ($i = 0, $nb = count($commandesRaw); $i < $nb; $i++) {
            $row = $commandesRaw[$i];
            $cmdId = (int) $row['id'];
            $commandeIds[] = $cmdId;
            $items[$cmdId] = [
                'id'              => $cmdId,
                'numero_commande' => (string) $row['numero_commande'],
                'statut'          => (string) $row['statut'],
                'total'           => (float) $row['total'],
                'date_commande'   => (string) $row['date_commande'],
                'nb_articles'     => (int) $row['nb_articles'],
                'lignes'          => [],
            ];
        }

        // Chargement des lignes de commande et options (variantes) si commandes trouvées
        if (count($commandeIds) > 0) {
            $inPlaceholders = implode(',', array_fill(0, count($commandeIds), '?'));
            $sqlLignes = "SELECT lc.id, lc.commande_id, lc.product_id, lc.variant_id, lc.nom_produit, lc.nom_variante,
                                 lc.quantite, lc.prix_unitaire, lc.total_ligne,
                                 (
                                     SELECT pi.url
                                       FROM product_image pi
                                      WHERE pi.product_id = lc.product_id
                                   ORDER BY pi.est_principale DESC, pi.ordre ASC, pi.id ASC
                                      LIMIT 1
                                 ) AS image_url
                            FROM ligne_commande lc
                           WHERE lc.commande_id IN ({$inPlaceholders})
                        ORDER BY lc.id ASC";

            $stmtLignes = $this->pdo->prepare($sqlLignes);
            for ($i = 0, $nbIds = count($commandeIds); $i < $nbIds; $i++) {
                $stmtLignes->bindValue($i + 1, $commandeIds[$i], PDO::PARAM_INT);
            }
            $stmtLignes->execute();
            $lignesRaw = $stmtLignes->fetchAll();

            for ($i = 0, $nbLignes = count($lignesRaw); $i < $nbLignes; $i++) {
                $lRow = $lignesRaw[$i];
                $cId = (int) $lRow['commande_id'];
                if (isset($items[$cId])) {
                    $items[$cId]['lignes'][] = [
                        'id'            => (int) $lRow['id'],
                        'product_id'    => (int) $lRow['product_id'],
                        'variant_id'    => $lRow['variant_id'] !== null ? (int) $lRow['variant_id'] : null,
                        'nom_produit'   => (string) $lRow['nom_produit'],
                        'nom_variante'  => $lRow['nom_variante'] !== null ? (string) $lRow['nom_variante'] : null,
                        'quantite'      => (int) $lRow['quantite'],
                        'prix_unitaire' => (float) $lRow['prix_unitaire'],
                        'total_ligne'   => (float) $lRow['total_ligne'],
                        'image_url'     => $lRow['image_url'] ? (string) $lRow['image_url'] : null,
                    ];
                }
            }
        }

        return [
            'items'      => array_values($items),
            'page'       => $page,
            'pagesTotal' => $pagesTotal,
            'total'      => $total,
            'tri'        => $tri,
            'parPage'    => $parPage,
            'statut'     => $statutFiltre,
            'periode'    => $periodeFiltre,
        ];
    }

    public function listerParUtilisateur(int $utilisateurId, int $limite = 5): array
    {
        $limite = max(1, min(50, $limite));

        $sql = "SELECT c.id, c.numero_commande, c.statut, c.total, c.date_commande,
                       COALESCE((SELECT SUM(lc.quantite) FROM ligne_commande lc WHERE lc.commande_id = c.id), 0) AS nb_articles,
                       COALESCE((SELECT GROUP_CONCAT(CONCAT(lc.quantite, 'x ', lc.nom_produit) SEPARATOR ', ')
                                   FROM ligne_commande lc
                                  WHERE lc.commande_id = c.id), '') AS articles_apercu
                  FROM commande c
                 WHERE c.utilisateur_id = :utilisateur_id
              ORDER BY c.date_commande DESC
                 LIMIT :limit";

        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':utilisateur_id', $utilisateurId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', $limite, PDO::PARAM_INT);
        $stmt->execute();
        $lignesRaw = $stmt->fetchAll();

        $resultats = [];
        for ($i = 0, $nb = count($lignesRaw); $i < $nb; $i++) {
            $row = $lignesRaw[$i];
            $resultats[] = [
                'id'              => (int) $row['id'],
                'numero_commande' => (string) $row['numero_commande'],
                'statut'          => (string) $row['statut'],
                'total'           => (float) $row['total'],
                'date_commande'   => (string) $row['date_commande'],
                'nb_articles'     => (int) $row['nb_articles'],
                'articles_apercu' => (string) $row['articles_apercu'],
            ];
        }

        return $resultats;
    }
    public function listerToutesAdmin(array $options = []): array
    {
        $tri = (string) ($options['tri'] ?? 'date_desc');
        $statutFiltre = !empty($options['statut']) ? trim((string) $options['statut']) : null;
        $dateFiltre = !empty($options['date']) ? trim((string) $options['date']) : null;
        $montantFiltre = isset($options['montant']) && $options['montant'] !== null ? (float) $options['montant'] : null;
        $page = max(1, (int) ($options['page'] ?? 1));
        $parPage = max(1, min(100, (int) ($options['parPage'] ?? 20)));

        $trisAutorises = [
            'date_desc'    => 'c.date_commande DESC',
            'date_asc'     => 'c.date_commande ASC',
            'statut_asc'   => 'c.statut ASC, c.date_commande DESC',
            'statut_desc'  => 'c.statut DESC, c.date_commande DESC',
            'montant_desc' => 'c.total DESC, c.date_commande DESC',
            'montant_asc'  => 'c.total ASC, c.date_commande DESC',
        ];

        $clauseTri = $trisAutorises[$tri] ?? $trisAutorises['date_desc'];
        if (!isset($trisAutorises[$tri])) {
            $tri = 'date_desc';
        }

        $conditions = [];
        $parametres = [];

        if ($statutFiltre !== null && $statutFiltre !== '') {
            $conditions[] = 'c.statut = :statut';
            $parametres['statut'] = $statutFiltre;
        }

        if ($dateFiltre !== null && $dateFiltre !== '') {
            $conditions[] = 'DATE(c.date_commande) = :date_commande';
            $parametres['date_commande'] = $dateFiltre;
        }

        if ($montantFiltre !== null) {
            $conditions[] = 'c.total = :montant';
            $parametres['montant'] = $montantFiltre;
        }

        $where = count($conditions) > 0 ? 'WHERE ' . implode(' AND ', $conditions) : '';

        // Comptage total
        $sqlCount = "SELECT COUNT(*) FROM commande c {$where}";
        $stmtCount = $this->pdo->prepare($sqlCount);
        $stmtCount->execute($parametres);
        $total = (int) $stmtCount->fetchColumn();

        $pagesTotal = max(1, (int) ceil($total / $parPage));
        if ($page > $pagesTotal && $total > 0) {
            $page = $pagesTotal;
        }

        $offset = ($page - 1) * $parPage;

        $sql = "SELECT c.id, c.numero_commande, c.utilisateur_id, c.statut, c.total, c.date_commande,
                       u.login AS utilisateur_login,
                       COALESCE((SELECT SUM(lc.quantite) FROM ligne_commande lc WHERE lc.commande_id = c.id), 0) AS nb_articles
                  FROM commande c
             LEFT JOIN utilisateur u ON u.id = c.utilisateur_id
                 {$where}
              ORDER BY {$clauseTri}
                 LIMIT :limit OFFSET :offset";

        $stmt = $this->pdo->prepare($sql);
        $keys = array_keys($parametres);
        for ($i = 0, $nbParams = count($keys); $i < $nbParams; $i++) {
            $k = $keys[$i];
            $stmt->bindValue(':' . $k, $parametres[$k]);
        }
        $stmt->bindValue(':limit', $parPage, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();
        $lignesRaw = $stmt->fetchAll();

        $items = [];
        for ($i = 0, $nb = count($lignesRaw); $i < $nb; $i++) {
            $row = $lignesRaw[$i];
            $items[] = [
                'id'                => (int) $row['id'],
                'numero_commande'   => (string) $row['numero_commande'],
                'utilisateur_id'    => (int) $row['utilisateur_id'],
                'utilisateur_login' => (string) ($row['utilisateur_login'] ?? ''),
                'statut'            => (string) $row['statut'],
                'total'             => (float) $row['total'],
                'date_commande'     => (string) $row['date_commande'],
                'nb_articles'       => (int) $row['nb_articles'],
            ];
        }

        return [
            'items'      => $items,
            'page'       => $page,
            'pagesTotal' => $pagesTotal,
            'total'      => $total,
            'tri'        => $tri,
            'parPage'    => $parPage,
        ];
    }

    /**
     * Recherche le détail complet d'une commande (lignes d'articles et journal d'audit admin).
     *
     * @param int $commandeId
     * @return array<string, mixed>|null
     */
    public function trouverDetailComplet(int $commandeId): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT c.id, c.numero_commande, c.utilisateur_id, c.statut, c.total, c.date_commande,
                    u.login AS utilisateur_login
               FROM commande c
          LEFT JOIN utilisateur u ON u.id = c.utilisateur_id
              WHERE c.id = :id'
        );
        $stmt->execute(['id' => $commandeId]);
        $commande = $stmt->fetch();

        if (!$commande) {
            return null;
        }

        // Lignes de commande
        $stmtLignes = $this->pdo->prepare(
            'SELECT lc.id, lc.product_id, lc.variant_id, lc.nom_produit, lc.nom_variante,
                    lc.quantite, lc.prix_unitaire, lc.total_ligne,
                    (
                        SELECT pi.url
                          FROM product_image pi
                         WHERE pi.product_id = lc.product_id
                      ORDER BY pi.est_principale DESC, pi.ordre ASC, pi.id ASC
                         LIMIT 1
                    ) AS image_url
               FROM ligne_commande lc
              WHERE lc.commande_id = :commande_id
           ORDER BY lc.id ASC'
        );
        $stmtLignes->execute(['commande_id' => $commandeId]);
        $lignesRaw = $stmtLignes->fetchAll();

        $lignes = [];
        for ($i = 0, $nb = count($lignesRaw); $i < $nb; $i++) {
            $row = $lignesRaw[$i];
            $lignes[] = [
                'id'            => (int) $row['id'],
                'product_id'    => (int) $row['product_id'],
                'variant_id'    => $row['variant_id'] !== null ? (int) $row['variant_id'] : null,
                'nom_produit'   => (string) $row['nom_produit'],
                'nom_variante'  => $row['nom_variante'] !== null ? (string) $row['nom_variante'] : null,
                'quantite'      => (int) $row['quantite'],
                'prix_unitaire' => (float) $row['prix_unitaire'],
                'total_ligne'   => (float) $row['total_ligne'],
                'image_url'     => $row['image_url'] ? (string) $row['image_url'] : null,
            ];
        }

        // Journal des modifications effectuées par les administrateurs
        $stmtJournal = $this->pdo->prepare(
            'SELECT j.id, j.commande_id, j.utilisateur_id, j.ancien_statut, j.nouveau_statut,
                    j.action, j.commentaire, j.date_action,
                    u.login AS admin_login
               FROM journal_commande j
          LEFT JOIN utilisateur u ON u.id = j.utilisateur_id
              WHERE j.commande_id = :commande_id
           ORDER BY j.date_action DESC, j.id DESC'
        );
        $stmtJournal->execute(['commande_id' => $commandeId]);
        $journalRaw = $stmtJournal->fetchAll();

        $journal = [];
        for ($j = 0, $nbJ = count($journalRaw); $j < $nbJ; $j++) {
            $rowJ = $journalRaw[$j];
            $journal[] = [
                'id'             => (int) $rowJ['id'],
                'commande_id'    => (int) $rowJ['commande_id'],
                'utilisateur_id' => (int) $rowJ['utilisateur_id'],
                'admin_login'    => (string) ($rowJ['admin_login'] ?? 'Admin'),
                'ancien_statut'  => (string) $rowJ['ancien_statut'],
                'nouveau_statut' => (string) $rowJ['nouveau_statut'],
                'action'         => (string) $rowJ['action'],
                'commentaire'    => $rowJ['commentaire'] !== null ? (string) $rowJ['commentaire'] : null,
                'date_action'    => (string) $rowJ['date_action'],
            ];
        }

        return [
            'id'                => (int) $commande['id'],
            'numero_commande'   => (string) $commande['numero_commande'],
            'utilisateur_id'    => (int) $commande['utilisateur_id'],
            'utilisateur_login' => (string) ($commande['utilisateur_login'] ?? ''),
            'statut'            => (string) $commande['statut'],
            'total'             => (float) $commande['total'],
            'date_commande'     => (string) $commande['date_commande'],
            'lignes'            => $lignes,
            'journal'           => $journal,
        ];
    }

    /**
     * Fait évoluer le statut d'une commande selon les règles métier :
     * - « en cours » -> « disponible » -> « retirée »
     * - Annulation autorisée tant que la commande n'est PAS retirée
     * - L'annulation remet en stock les produits/variantes et trace le mouvement
     * - Les autres transitions ne modifient pas les stocks
     * - Chaque changement est journalisé dans journal_commande
     *
     * @param int $commandeId
     * @param string $nouveauStatut
     * @param int $adminId
     * @param string|null $commentaire
     * @param string|null $actionSpecifique
     * @return array<string, mixed>
     * @throws Exception
     */
    public function changerStatut(
        int $commandeId,
        string $nouveauStatut,
        int $adminId,
        ?string $commentaire = null,
        ?string $actionSpecifique = null
    ): array {
        $statutsValides = ['en cours', 'disponible', 'retirée', 'annulée'];
        if (!in_array($nouveauStatut, $statutsValides, true)) {
            throw new Exception("Statut « {$nouveauStatut} » non reconnu.");
        }

        $this->pdo->beginTransaction();

        try {
            $stmt = $this->pdo->prepare('SELECT id, numero_commande, statut, total FROM commande WHERE id = :id FOR UPDATE');
            $stmt->execute(['id' => $commandeId]);
            $commande = $stmt->fetch();

            if (!$commande) {
                throw new Exception('Commande introuvable.');
            }

            $ancienStatut = (string) $commande['statut'];
            $numeroCommande = (string) $commande['numero_commande'];

            if ($ancienStatut === 'retirée') {
                throw new Exception("La commande {$numeroCommande} a déjà été retirée et ne peut plus être modifiée ni annulée.");
            }

            if ($ancienStatut === 'annulée') {
                throw new Exception("La commande {$numeroCommande} a déjà été annulée.");
            }

            if ($ancienStatut === $nouveauStatut) {
                $this->pdo->commit();
                return [
                    'id'              => $commandeId,
                    'numero_commande' => $numeroCommande,
                    'statut'          => $nouveauStatut,
                    'modifie'         => false,
                ];
            }

            // Vérification de la séquence légitime de passage
            if ($nouveauStatut === 'retirée' && $ancienStatut === 'en cours') {
                // Bien que direct possible, la règle indique : « de "en cours" à "disponible" puis à "retirée" »
                // On permet la transition vers 'disponible' puis 'retirée', ou le passage direct avec trace
            }

            // Remise en stock si annulation
            if ($nouveauStatut === 'annulée') {
                $stmtLignes = $this->pdo->prepare(
                    'SELECT product_id, variant_id, quantite FROM ligne_commande WHERE commande_id = :commande_id'
                );
                $stmtLignes->execute(['commande_id' => $commandeId]);
                $lignes = $stmtLignes->fetchAll();

                $stmtUpdateProd = $this->pdo->prepare('UPDATE product SET stock = stock + :qte WHERE id = :id');
                $stmtUpdateVar = $this->pdo->prepare('UPDATE product_variant SET stock = stock + :qte WHERE id = :id');
                $stmtMvt = $this->pdo->prepare(
                    'INSERT INTO stock_movement (product_id, variant_id, quantite, motif, date_mouvement)
                     VALUES (:product_id, :variant_id, :quantite, :motif, NOW())'
                );

                for ($k = 0, $nbL = count($lignes); $k < $nbL; $k++) {
                    $l = $lignes[$k];
                    $qte = (int) $l['quantite'];
                    $prodId = (int) $l['product_id'];
                    $varId = $l['variant_id'] !== null ? (int) $l['variant_id'] : null;

                    if ($varId !== null) {
                        $stmtUpdateVar->execute(['qte' => $qte, 'id' => $varId]);
                        $stmtUpdateProd->execute(['qte' => $qte, 'id' => $prodId]);
                    } else {
                        $stmtUpdateProd->execute(['qte' => $qte, 'id' => $prodId]);
                    }

                    $stmtMvt->execute([
                        'product_id' => $prodId,
                        'variant_id' => $varId,
                        'quantite'   => $qte,
                        'motif'      => 'annulation commande ' . $numeroCommande,
                    ]);
                }
            }

            // Mise à jour du statut de la commande
            $stmtUpdateCmd = $this->pdo->prepare('UPDATE commande SET statut = :statut WHERE id = :id');
            $stmtUpdateCmd->execute(['statut' => $nouveauStatut, 'id' => $commandeId]);

            // Enregistrement dans le journal des modifications administrateurs
            $action = $actionSpecifique ?? ($nouveauStatut === 'annulée' ? 'annulation' : 'changement_statut');
            $stmtJournal = $this->pdo->prepare(
                'INSERT INTO journal_commande (commande_id, utilisateur_id, ancien_statut, nouveau_statut, action, commentaire, date_action)
                 VALUES (:commande_id, :utilisateur_id, :ancien_statut, :nouveau_statut, :action, :commentaire, NOW())'
            );
            $stmtJournal->execute([
                'commande_id'    => $commandeId,
                'utilisateur_id' => $adminId,
                'ancien_statut'  => $ancienStatut,
                'nouveau_statut' => $nouveauStatut,
                'action'         => $action,
                'commentaire'    => $commentaire,
            ]);

            $this->pdo->commit();

            return [
                'id'              => $commandeId,
                'numero_commande' => $numeroCommande,
                'ancien_statut'   => $ancienStatut,
                'nouveau_statut'  => $nouveauStatut,
                'modifie'         => true,
            ];
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw new Exception($e->getMessage(), (int) $e->getCode(), $e);
        }
    }

    /**
     * Applique une modification de statut en lot sur plusieurs commandes.
     *
     * @param array<int, int> $ids
     * @param string $nouveauStatut
     * @param int $adminId
     * @return array{modifies: int, ignores: int, erreurs: array<int, string>}
     */
    public function changerStatutLot(array $ids, string $nouveauStatut, int $adminId): array
    {
        $modifies = 0;
        $ignores = 0;
        $erreurs = [];

        for ($i = 0, $nb = count($ids); $i < $nb; $i++) {
            $id = (int) $ids[$i];
            if ($id <= 0) {
                continue;
            }

            try {
                $res = $this->changerStatut(
                    $id,
                    $nouveauStatut,
                    $adminId,
                    'Action groupée',
                    'action_lot_' . $nouveauStatut
                );
                if (!empty($res['modifie'])) {
                    $modifies++;
                } else {
                    $ignores++;
                }
            } catch (Throwable $e) {
                $erreurs[] = "Commande #{$id} : " . $e->getMessage();
            }
        }

        return [
            'modifies' => $modifies,
            'ignores'  => $ignores,
            'erreurs'  => $erreurs,
        ];
    }
}
