<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des produits et catégories.
 */
final class ProductModel
{
    /** Connexion à la base de données. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Retourne les statistiques globales du catalogue (produits et catégories).
     *
     * @return array{totalProduits: int, totalCategories: int}
     */
    public function statistiques(): array
    {
        $nbProduits = (int) $this->pdo->query('SELECT COUNT(*) FROM product')->fetchColumn();
        $nbCategories = (int) $this->pdo->query('SELECT COUNT(*) FROM category')->fetchColumn();

        return [
            'totalProduits'   => $nbProduits,
            'totalCategories' => $nbCategories,
        ];
    }

    /**
     * Liste tous les produits avec le nom de leur catégorie.
     *
     * @return array<int, array{
     *     id: int,
     *     nom: string,
     *     category_id: ?int,
     *     categorie: string,
     *     prix: float,
     *     stock: int,
     *     seuil_alerte: int,
     *     description: ?string
     * }>
     */
    public function lister(): array
    {
        $sql = 'SELECT product.id,
                       product.nom,
                       product.category_id,
                       product.prix,
                       product.stock,
                       product.seuil_alerte,
                       product.description,
                       category.nom AS categorie
                  FROM product
             LEFT JOIN category ON category.id = product.category_id
              ORDER BY product.nom ASC';

        $lignes = $this->pdo->query($sql)->fetchAll();

        return array_map(static function (array $ligne): array {
            return [
                'id'           => (int) $ligne['id'],
                'nom'          => (string) $ligne['nom'],
                'category_id'  => $ligne['category_id'] !== null ? (int) $ligne['category_id'] : null,
                'categorie'    => $ligne['categorie'] !== null ? (string) $ligne['categorie'] : 'Sans catégorie',
                'prix'         => (float) $ligne['prix'],
                'stock'        => (int) $ligne['stock'],
                'seuil_alerte' => (int) $ligne['seuil_alerte'],
                'description'  => $ligne['description'] !== null ? (string) $ligne['description'] : null,
            ];
        }, $lignes);
    }
}
