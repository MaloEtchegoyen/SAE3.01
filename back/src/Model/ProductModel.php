<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use Throwable;

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
     * Liste toutes les catégories disponibles dans le catalogue.
     *
     * @return array<int, array{id: int, nom: string}>
     */
    public function listerCategories(): array
    {
        $stmt = $this->pdo->query('SELECT id, nom FROM category ORDER BY nom ASC');
        $lignes = $stmt->fetchAll();

        return array_map(static function (array $ligne): array {
            return [
                'id'  => (int) $ligne['id'],
                'nom' => (string) $ligne['nom'],
            ];
        }, $lignes);
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
                 WHERE product.actif = 1
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

    /**
     * Recherche un produit par son identifiant avec sa catégorie.
     *
     * @param int $id
     * @return array{
     *     id: int,
     *     nom: string,
     *     category_id: ?int,
     *     categorie: string,
     *     prix: float,
     *     stock: int,
     *     seuil_alerte: int,
     *     description: ?string,
     *     actif: int
     * }|null
     */
    public function trouverParId(int $id): ?array
    {
        $stmt = $this->pdo->prepare(
            'SELECT product.id,
                    product.nom,
                    product.category_id,
                    product.prix,
                    product.stock,
                    product.seuil_alerte,
                    product.description,
                    product.actif,
                    category.nom AS categorie
               FROM product
          LEFT JOIN category ON category.id = product.category_id
              WHERE product.id = :id'
        );
        $stmt->execute(['id' => $id]);
        $ligne = $stmt->fetch();

        if ($ligne === false) {
            return null;
        }

        return [
            'id'           => (int) $ligne['id'],
            'nom'          => (string) $ligne['nom'],
            'category_id'  => $ligne['category_id'] !== null ? (int) $ligne['category_id'] : null,
            'categorie'    => $ligne['categorie'] !== null ? (string) $ligne['categorie'] : 'Sans catégorie',
            'prix'         => (float) $ligne['prix'],
            'stock'        => (int) $ligne['stock'],
            'seuil_alerte' => (int) $ligne['seuil_alerte'],
            'description'  => $ligne['description'] !== null ? (string) $ligne['description'] : null,
            'actif'        => (int) $ligne['actif'],
        ];
    }

    /**
     * US 1 : Ajoute un nouveau produit avec toutes ses informations.
     *
     * @param array{
     *     nom: string,
     *     description?: ?string,
     *     category_id?: ?int,
     *     prix: float,
     *     stock?: int,
     *     seuil_alerte?: int
     * } $donnees
     * @return int Identifiant du nouveau produit créé
     */
    public function ajouter(array $donnees): int
    {
        $nom         = trim((string) $donnees['nom']);
        $description = isset($donnees['description']) && trim((string) $donnees['description']) !== '' ? trim((string) $donnees['description']) : null;
        $categoryId  = isset($donnees['category_id']) && $donnees['category_id'] !== '' && (int) $donnees['category_id'] > 0 ? (int) $donnees['category_id'] : null;
        $prix        = (float) $donnees['prix'];
        $stock       = isset($donnees['stock']) && (int) $donnees['stock'] >= 0 ? (int) $donnees['stock'] : 0;
        $seuilAlerte = isset($donnees['seuil_alerte']) && (int) $donnees['seuil_alerte'] >= 0 ? (int) $donnees['seuil_alerte'] : 5;

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO product (nom, description, category_id, prix, stock, seuil_alerte, actif)
                 VALUES (:nom, :description, :category_id, :prix, :stock, :seuil_alerte, 1)'
            );
            $stmt->execute([
                'nom'          => $nom,
                'description'  => $description,
                'category_id'  => $categoryId,
                'prix'         => $prix,
                'stock'        => $stock,
                'seuil_alerte' => $seuilAlerte,
            ]);

            $nouveauId = (int) $this->pdo->lastInsertId();

            if ($stock > 0) {
                $stmtAudit = $this->pdo->prepare(
                    'INSERT INTO stock_movement (product_id, variant_id, quantite, motif)
                     VALUES (:product_id, NULL, :quantite, :motif)'
                );
                $stmtAudit->execute([
                    'product_id' => $nouveauId,
                    'quantite'   => $stock,
                    'motif'      => 'creation_produit',
                ]);
            }

            $this->pdo->commit();
            return $nouveauId;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * US 2 : Modifie tous les aspects d'un produit existant.
     *
     * @param int $id
     * @param array{
     *     nom: string,
     *     description?: ?string,
     *     category_id?: ?int,
     *     prix: float,
     *     stock: int,
     *     seuil_alerte: int,
     *     actif?: int
     * } $donnees
     * @return bool
     */
    public function modifier(int $id, array $donnees): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE product
                SET nom               = :nom,
                    description       = :description,
                    category_id       = :category_id,
                    prix              = :prix,
                    stock             = :stock,
                    seuil_alerte      = :seuil_alerte,
                    actif             = :actif,
                    date_modification = NOW()
              WHERE id = :id'
        );

        return $stmt->execute([
            'id'           => $id,
            'nom'          => (string) $donnees['nom'],
            'description'  => isset($donnees['description']) ? (string) $donnees['description'] : null,
            'category_id'  => isset($donnees['category_id']) && $donnees['category_id'] !== null ? (int) $donnees['category_id'] : null,
            'prix'         => (float) $donnees['prix'],
            'stock'        => (int) $donnees['stock'],
            'seuil_alerte' => (int) $donnees['seuil_alerte'],
            'actif'        => isset($donnees['actif']) ? (int) $donnees['actif'] : 1,
        ]);
    }

    /**
     * US 3 : Supprime un produit (suppression logique par défaut, ou physique si demandé).
     *
     * @param int $id
     * @param bool $definitif
     * @return bool
     */
    public function supprimer(int $id, bool $definitif = false): bool
    {
        if ($definitif) {
            $this->pdo->beginTransaction();
            try {
                $this->pdo->prepare('DELETE FROM product_image WHERE product_id = :id')->execute(['id' => $id]);
                $this->pdo->prepare('DELETE FROM product_variant WHERE product_id = :id')->execute(['id' => $id]);
                $this->pdo->prepare('DELETE FROM stock_movement WHERE product_id = :id')->execute(['id' => $id]);
                $stmt = $this->pdo->prepare('DELETE FROM product WHERE id = :id');
                $resultat = $stmt->execute(['id' => $id]);
                $this->pdo->commit();
                return $resultat;
            } catch (Throwable $e) {
                $this->pdo->rollBack();
                throw $e;
            }
        }

        $stmt = $this->pdo->prepare('UPDATE product SET actif = 0, date_modification = NOW() WHERE id = :id');
        return $stmt->execute(['id' => $id]);
    }

    /**
     * US 4 : Ajoute une image associée à un produit.
     *
     * @param int $productId
     * @param string $url
     * @param string|null $alt
     * @param bool $estPrincipale
     * @param int $ordre
     * @return int Identifiant de l'image insérée
     */
    public function ajouterImage(
        int $productId,
        string $url,
        ?string $alt = null,
        bool $estPrincipale = false,
        int $ordre = 0
    ): int {
        $this->pdo->beginTransaction();
        try {
            if ($estPrincipale) {
                $stmtReset = $this->pdo->prepare('UPDATE product_image SET est_principale = 0 WHERE product_id = :product_id');
                $stmtReset->execute(['product_id' => $productId]);
            }

            $stmt = $this->pdo->prepare(
                'INSERT INTO product_image (product_id, url, alt, est_principale, ordre)
                 VALUES (:product_id, :url, :alt, :est_principale, :ordre)'
            );
            $stmt->execute([
                'product_id'     => $productId,
                'url'            => $url,
                'alt'            => $alt,
                'est_principale' => $estPrincipale ? 1 : 0,
                'ordre'          => $ordre,
            ]);

            $imageId = (int) $this->pdo->lastInsertId();
            $this->pdo->commit();
            return $imageId;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * US 4 : Définit une image comme principale pour un produit.
     *
     * @param int $productId
     * @param int $imageId
     * @return bool
     */
    public function definirImagePrincipale(int $productId, int $imageId): bool
    {
        $this->pdo->beginTransaction();
        try {
            $stmtReset = $this->pdo->prepare('UPDATE product_image SET est_principale = 0 WHERE product_id = :product_id');
            $stmtReset->execute(['product_id' => $productId]);

            $stmtSet = $this->pdo->prepare('UPDATE product_image SET est_principale = 1 WHERE id = :image_id AND product_id = :product_id');
            $stmtSet->execute([
                'image_id'   => $imageId,
                'product_id' => $productId,
            ]);

            $this->pdo->commit();
            return true;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * US 4 : Supprime une image d'un produit.
     *
     * @param int $imageId
     * @param int $productId
     * @return bool
     */
    public function supprimerImage(int $imageId, int $productId): bool
    {
        $stmt = $this->pdo->prepare('DELETE FROM product_image WHERE id = :image_id AND product_id = :product_id');
        return $stmt->execute([
            'image_id'   => $imageId,
            'product_id' => $productId,
        ]);
    }

    /**
     * US 4 : Liste toutes les images d'un produit.
     *
     * @param int $productId
     * @return array<int, array{id: int, product_id: int, url: string, alt: ?string, est_principale: bool, ordre: int}>
     */
    public function listerImages(int $productId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, product_id, url, alt, est_principale, ordre
               FROM product_image
              WHERE product_id = :product_id
              ORDER BY est_principale DESC, ordre ASC'
        );
        $stmt->execute(['product_id' => $productId]);
        $lignes = $stmt->fetchAll();

        return array_map(static function (array $ligne): array {
            return [
                'id'             => (int) $ligne['id'],
                'product_id'     => (int) $ligne['product_id'],
                'url'            => (string) $ligne['url'],
                'alt'            => $ligne['alt'] !== null ? (string) $ligne['alt'] : null,
                'est_principale' => (bool) $ligne['est_principale'],
                'ordre'          => (int) $ligne['ordre'],
            ];
        }, $lignes);
    }

    /**
     * US 5 : Fixe le prix et le stock d'un produit avec traçabilité dans le journal d'audit.
     *
     * @param int $id
     * @param float $prix
     * @param int $stock
     * @param string $motif
     * @return bool
     */
    public function fixerPrixEtStock(int $id, float $prix, int $stock, string $motif = 'ajustement_manuel'): bool
    {
        $this->pdo->beginTransaction();
        try {
            $stmtSelect = $this->pdo->prepare('SELECT stock FROM product WHERE id = :id FOR UPDATE');
            $stmtSelect->execute(['id' => $id]);
            $ancienStock = (int) $stmtSelect->fetchColumn();

            $stmtUpdate = $this->pdo->prepare(
                'UPDATE product
                    SET prix              = :prix,
                        stock             = :stock,
                        date_modification = NOW()
                  WHERE id = :id'
            );
            $stmtUpdate->execute([
                'id'    => $id,
                'prix'  => $prix,
                'stock' => $stock,
            ]);

            $delta = $stock - $ancienStock;
            if ($delta !== 0) {
                $stmtAudit = $this->pdo->prepare(
                    'INSERT INTO stock_movement (product_id, variant_id, quantite, motif)
                     VALUES (:product_id, NULL, :quantite, :motif)'
                );
                $stmtAudit->execute([
                    'product_id' => $id,
                    'quantite'   => $delta,
                    'motif'      => $motif,
                ]);
            }

            $this->pdo->commit();
            return true;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * US 6 : Modifie le seuil d'alerte « Bientôt épuisé » d'un produit.
     *
     * @param int $id
     * @param int $seuilAlerte
     * @return bool
     */
    public function modifierSeuilAlerte(int $id, int $seuilAlerte): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE product
                SET seuil_alerte      = :seuil_alerte,
                    date_modification = NOW()
              WHERE id = :id'
        );

        return $stmt->execute([
            'id'           => $id,
            'seuil_alerte' => $seuilAlerte,
        ]);
    }

    /**
     * US 6 : Liste les produits dont le stock est inférieur ou égal au seuil d'alerte.
     *
     * @return array<int, array{id: int, nom: string, categorie: string, stock: int, seuil_alerte: int}>
     */
    public function listerProduitsBientotEpuises(): array
    {
        $sql = 'SELECT product.id,
                       product.nom,
                       product.stock,
                       product.seuil_alerte,
                       category.nom AS categorie
                  FROM product
             LEFT JOIN category ON category.id = product.category_id
                 WHERE product.stock <= product.seuil_alerte
                   AND product.actif = 1
              ORDER BY product.stock ASC';

        $lignes = $this->pdo->query($sql)->fetchAll();

        return array_map(static function (array $ligne): array {
            return [
                'id'           => (int) $ligne['id'],
                'nom'          => (string) $ligne['nom'],
                'categorie'    => $ligne['categorie'] !== null ? (string) $ligne['categorie'] : 'Sans catégorie',
                'stock'        => (int) $ligne['stock'],
                'seuil_alerte' => (int) $ligne['seuil_alerte'],
            ];
        }, $lignes);
    }

    /**
     * US 7 : Ajoute une option / variante pour un produit.
     *
     * @param int $productId
     * @param array{
     *     nom: string,
     *     prix: float,
     *     stock?: int,
     *     seuil_alerte?: int
     * } $donnees
     * @return int Identifiant de la variante créée
     */
    public function ajouterVariante(int $productId, array $donnees): int
    {
        $nom         = (string) $donnees['nom'];
        $prix        = (float) $donnees['prix'];
        $stock       = isset($donnees['stock']) ? (int) $donnees['stock'] : 0;
        $seuilAlerte = isset($donnees['seuil_alerte']) ? (int) $donnees['seuil_alerte'] : 5;

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                'INSERT INTO product_variant (product_id, nom, prix, stock, seuil_alerte, actif)
                 VALUES (:product_id, :nom, :prix, :stock, :seuil_alerte, 1)'
            );
            $stmt->execute([
                'product_id'   => $productId,
                'nom'          => $nom,
                'prix'         => $prix,
                'stock'        => $stock,
                'seuil_alerte' => $seuilAlerte,
            ]);

            $variantId = (int) $this->pdo->lastInsertId();

            if ($stock > 0) {
                $stmtAudit = $this->pdo->prepare(
                    'INSERT INTO stock_movement (product_id, variant_id, quantite, motif)
                     VALUES (:product_id, :variant_id, :quantite, :motif)'
                );
                $stmtAudit->execute([
                    'product_id' => $productId,
                    'variant_id' => $variantId,
                    'quantite'   => $stock,
                    'motif'      => 'creation_variante',
                ]);
            }

            $this->pdo->commit();
            return $variantId;
        } catch (Throwable $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * US 7 : Modifie une option / variante existante.
     *
     * @param int $variantId
     * @param int $productId
     * @param array{
     *     nom: string,
     *     prix: float,
     *     stock: int,
     *     seuil_alerte: int,
     *     actif?: int
     * } $donnees
     * @return bool
     */
    public function modifierVariante(int $variantId, int $productId, array $donnees): bool
    {
        $stmt = $this->pdo->prepare(
            'UPDATE product_variant
                SET nom          = :nom,
                    prix         = :prix,
                    stock        = :stock,
                    seuil_alerte = :seuil_alerte,
                    actif        = :actif
              WHERE id = :variant_id AND product_id = :product_id'
        );

        return $stmt->execute([
            'variant_id'   => $variantId,
            'product_id'   => $productId,
            'nom'          => (string) $donnees['nom'],
            'prix'         => (float) $donnees['prix'],
            'stock'        => (int) $donnees['stock'],
            'seuil_alerte' => (int) $donnees['seuil_alerte'],
            'actif'        => isset($donnees['actif']) ? (int) $donnees['actif'] : 1,
        ]);
    }

    /**
     * US 7 : Désactive ou supprime une option / variante d'un produit.
     *
     * @param int $variantId
     * @param int $productId
     * @param bool $definitif
     * @return bool
     */
    public function supprimerVariante(int $variantId, int $productId, bool $definitif = false): bool
    {
        if ($definitif) {
            $stmt = $this->pdo->prepare('DELETE FROM product_variant WHERE id = :variant_id AND product_id = :product_id');
            return $stmt->execute([
                'variant_id' => $variantId,
                'product_id' => $productId,
            ]);
        }

        $stmt = $this->pdo->prepare('UPDATE product_variant SET actif = 0 WHERE id = :variant_id AND product_id = :product_id');
        return $stmt->execute([
            'variant_id' => $variantId,
            'product_id' => $productId,
        ]);
    }

    /**
     * US 7 : Liste les options / variantes actives d'un produit.
     *
     * @param int $productId
     * @return array<int, array{id: int, product_id: int, nom: string, prix: float, stock: int, seuil_alerte: int, actif: int}>
     */
    public function listerVariantes(int $productId): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, product_id, nom, prix, stock, seuil_alerte, actif
               FROM product_variant
              WHERE product_id = :product_id AND actif = 1
              ORDER BY id ASC'
        );
        $stmt->execute(['product_id' => $productId]);
        $lignes = $stmt->fetchAll();

        return array_map(static function (array $ligne): array {
            return [
                'id'           => (int) $ligne['id'],
                'product_id'   => (int) $ligne['product_id'],
                'nom'          => (string) $ligne['nom'],
                'prix'         => (float) $ligne['prix'],
                'stock'        => (int) $ligne['stock'],
                'seuil_alerte' => (int) $ligne['seuil_alerte'],
                'actif'        => (int) $ligne['actif'],
            ];
        }, $lignes);
    }
}
