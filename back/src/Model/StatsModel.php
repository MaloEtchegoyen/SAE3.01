<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Modèle de gestion des statistiques administratives (Epic PIL-a).
 *
 * Fournit les métriques nécessaires au pilotage de l'activité :
 * - Revenus consolidés des 7 derniers jours
 * - Répartition des commandes par statut (tolérance casse/accents)
 * - Niveau des stocks par produit (histogramme)
 * - Produits les plus vendus sur les 7 derniers jours
 * - Alertes de stock faible (produits et variantes)
 */
final class StatsModel
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Calcule le total des revenus générés sur les 7 derniers jours (commandes non annulées).
     *
     * @return float
     */
    public function revenus7DerniersJours(): float
    {
        $sql = "SELECT COALESCE(SUM(total), 0)
                  FROM commande
                 WHERE date_commande >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND LOWER(statut) NOT LIKE '%annul%'";

        return (float) $this->pdo->query($sql)->fetchColumn();
    }

    /**
     * Compte le nombre total de commandes et le détail par statut.
     * La comparaison est insensible à la casse et aux variantes d'accents.
     *
     * @return array{
     *     total: int,
     *     parStatut: array{
     *         en_cours: int,
     *         disponible: int,
     *         retiree: int,
     *         annulee: int
     *     }
     * }
     */
    public function statistiquesCommandes(): array
    {
        $sql = 'SELECT statut, COUNT(*) AS nb FROM commande GROUP BY statut';
        $lignes = $this->pdo->query($sql)->fetchAll();

        $statuts = [
            'en_cours'   => 0,
            'disponible' => 0,
            'retiree'    => 0,
            'annulee'    => 0,
        ];

        $total = 0;
        for ($i = 0, $nbLignes = count($lignes); $i < $nbLignes; $i++) {
            $ligne = $lignes[$i];
            $statut = (string) $ligne['statut'];
            $nb = (int) $ligne['nb'];
            $total += $nb;

            // Normalisation insensible à la casse et aux accents
            $normalise = mb_strtolower(trim($statut), 'UTF-8');
            $normalise = str_replace(['é', 'è', 'ê', 'ë'], 'e', $normalise);

            if (str_contains($normalise, 'cours')) {
                $statuts['en_cours'] += $nb;
            } elseif (str_contains($normalise, 'dispo')) {
                $statuts['disponible'] += $nb;
            } elseif (str_contains($normalise, 'retir')) {
                $statuts['retiree'] += $nb;
            } elseif (str_contains($normalise, 'annul')) {
                $statuts['annulee'] += $nb;
            }
        }

        return [
            'total'     => $total,
            'parStatut' => $statuts,
        ];
    }

    /**
     * Retourne la liste des produits avec leur stock total (somme des variantes actives si existantes).
     *
     * @return array<int, array{id: int, nom: string, stock: int}>
     */
    public function stocksParProduit(): array
    {
        $sql = 'SELECT p.id,
                       p.nom,
                       COALESCE(
                           (SELECT SUM(pv.stock) FROM product_variant pv WHERE pv.product_id = p.id AND pv.actif = 1),
                           p.stock
                       ) AS stock
                  FROM product p
                 WHERE p.actif = 1
              ORDER BY p.nom ASC';

        $lignes = $this->pdo->query($sql)->fetchAll();
        $resultat = [];

        for ($i = 0, $nb = count($lignes); $i < $nb; $i++) {
            $row = $lignes[$i];
            $resultat[] = [
                'id'    => (int) $row['id'],
                'nom'   => (string) $row['nom'],
                'stock' => max(0, (int) $row['stock']),
            ];
        }

        return $resultat;
    }

    /**
     * Retourne les produits les plus vendus sur les 7 derniers jours (commandes non annulées).
     *
     * @param int $limite
     * @return array<int, array{nom: string, quantite: int}>
     */
    public function topVentes7DerniersJours(int $limite = 5): array
    {
        $sql = "SELECT lc.nom_produit AS nom,
                       SUM(lc.quantite) AS quantite
                  FROM ligne_commande lc
                  JOIN commande c ON c.id = lc.commande_id
                 WHERE c.date_commande >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                   AND LOWER(c.statut) NOT LIKE '%annul%'
              GROUP BY lc.product_id, lc.nom_produit
              ORDER BY quantite DESC
                 LIMIT :limite";

        $stmt = $this->pdo->prepare($sql);
        $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
        $stmt->execute();
        $lignes = $stmt->fetchAll();

        $resultat = [];
        for ($i = 0, $nb = count($lignes); $i < $nb; $i++) {
            $row = $lignes[$i];
            $resultat[] = [
                'nom'      => (string) $row['nom'],
                'quantite' => (int) $row['quantite'],
            ];
        }

        return $resultat;
    }

    /**
     * Retourne la liste des produits et variantes dont le stock est inférieur ou égal au seuil d'alerte.
     *
     * @return array<int, array{nom: string, stock: int, seuil: int}>
     */
    public function alertesStockFaible(): array
    {
        // 1. Produits simples (sans variantes actives) sous le seuil
        $sqlSimples = 'SELECT p.nom,
                              p.stock,
                              p.seuil_alerte AS seuil
                         FROM product p
                        WHERE p.actif = 1
                          AND p.stock <= p.seuil_alerte
                          AND NOT EXISTS (
                              SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id AND pv.actif = 1
                          )';

        // 2. Variantes actives sous le seuil
        $sqlVariantes = 'SELECT CONCAT(p.nom, " - ", pv.nom) AS nom,
                                pv.stock,
                                pv.seuil_alerte AS seuil
                           FROM product_variant pv
                           JOIN product p ON p.id = pv.product_id
                          WHERE pv.actif = 1
                            AND p.actif = 1
                            AND pv.stock <= pv.seuil_alerte';

        $sql = "({$sqlSimples}) UNION ALL ({$sqlVariantes}) ORDER BY stock ASC, nom ASC";
        $lignes = $this->pdo->query($sql)->fetchAll();

        $resultat = [];
        for ($i = 0, $nb = count($lignes); $i < $nb; $i++) {
            $row = $lignes[$i];
            $resultat[] = [
                'nom'   => (string) $row['nom'],
                'stock' => max(0, (int) $row['stock']),
                'seuil' => (int) $row['seuil'],
            ];
        }

        return $resultat;
    }

    /**
     * Agrège l'ensemble des données du tableau de bord d'administration.
     *
     * @return array<string, mixed>
     */
    public function obtenirTableauDeBord(): array
    {
        $statsCommandes = $this->statistiquesCommandes();

        $nbProduits = (int) $this->pdo->query('SELECT COUNT(*) FROM product WHERE actif = 1')->fetchColumn();
        $nbCategories = (int) $this->pdo->query('SELECT COUNT(*) FROM category')->fetchColumn();

        return [
            'revenus7Jours'       => $this->revenus7DerniersJours(),
            'totalCommandes'      => $statsCommandes['total'],
            'statutsCommandes'    => $statsCommandes['parStatut'],
            'stocksParProduit'    => $this->stocksParProduit(),
            'topVentes'           => $this->topVentes7DerniersJours(10),
            'alertesStock'        => $this->alertesStockFaible(),
            // Données de compatibilité
            'totalProduits'       => $nbProduits,
            'totalCategories'     => $nbCategories,
        ];
    }
}
