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
 * le gel des prix d'achat, le décrément des stocks et l'audit stock_movement
 * sous une transaction PDO atomique.
 */
final class OrderModel
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
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

                // Si une variante est demandée
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
}

