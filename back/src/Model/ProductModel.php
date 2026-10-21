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
     *     description: ?string,
     *     image_url: ?string
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
                       category.nom AS categorie,
                       (
                           SELECT pi.url
                             FROM product_image pi
                            WHERE pi.product_id = product.id
                         ORDER BY pi.est_principale DESC, pi.ordre ASC, pi.id ASC
                            LIMIT 1
                       ) AS image_url
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
                'image_url'    => $ligne['image_url'] !== null ? (string) $ligne['image_url'] : null,
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
     *     actif: int,
     *     image_url: ?string
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
                    category.nom AS categorie,
                    (
                        SELECT pi.url
                          FROM product_image pi
                         WHERE pi.product_id = product.id
                      ORDER BY pi.est_principale DESC, pi.ordre ASC, pi.id ASC
                         LIMIT 1
                    ) AS image_url
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
            'image_url'    => $ligne['image_url'] !== null ? (string) $ligne['image_url'] : null,
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
                $this->pdo->prepare('DELETE FROM product_option WHERE product_id = :id')->execute(['id' => $id]);
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
     * Garantit qu'au moins une image est définie comme principale si le produit a des images.
     *
     * @param int $productId
     * @return void
     */
    public function garantirImagePrincipale(int $productId): void
    {
        $images = $this->listerImages($productId);
        $total = count($images);
        if ($total === 0) {
            return;
        }

        $aPrincipale = false;
        for ($i = 0; $i < $total; $i++) {
            if (!empty($images[$i]['est_principale'])) {
                $aPrincipale = true;
                break;
            }
        }

        if (!$aPrincipale && isset($images[0]['id'])) {
            $this->definirImagePrincipale($productId, (int) $images[0]['id']);
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

    /**
     * Initialise automatiquement les tables product_option et product_option_value si inexistantes.
     */
    public function initialiserTablesOptions(): void
    {
        try {
            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS product_option (
                    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                    product_id INT(11) NOT NULL,
                    nom VARCHAR(100) NOT NULL,
                    type VARCHAR(30) NOT NULL DEFAULT 'radio',
                    obligatoire TINYINT(1) NOT NULL DEFAULT 1,
                    ordre INT(11) NOT NULL DEFAULT 0,
                    PRIMARY KEY (id),
                    KEY fk_product_option_product (product_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );

            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS product_option_value (
                    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                    option_id INT(10) UNSIGNED NOT NULL,
                    nom VARCHAR(150) NOT NULL,
                    surcout DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                    ordre INT(11) NOT NULL DEFAULT 0,
                    PRIMARY KEY (id),
                    KEY fk_product_option_value_option (option_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );

            // Vérifier s'il y a déjà des données, sinon insérer le jeu d'essai
            $count = (int) $this->pdo->query("SELECT COUNT(*) FROM product_option")->fetchColumn();
            if ($count === 0) {
                $this->pdo->exec("
                    INSERT INTO product_option (id, product_id, nom, type, obligatoire, ordre) VALUES
                    (1, 1, 'Taille', 'radio', 1, 0),
                    (2, 1, 'Type de lait', 'radio', 1, 1),
                    (3, 1, 'Sirop gourmand', 'radio', 0, 2),
                    (4, 2, 'Taille', 'radio', 1, 0),
                    (5, 2, 'Type de lait', 'radio', 1, 1),
                    (6, 6, 'Parfum', 'radio', 1, 0),
                    (7, 6, 'Chantilly', 'radio', 1, 1),
                    (8, 8, 'Taille', 'radio', 1, 0);

                    INSERT INTO product_option_value (id, option_id, nom, surcout, ordre) VALUES
                    (1, 1, 'Simple (Tasse)', 0.00, 0),
                    (2, 1, 'Double (+0,60 €)', 0.60, 1),
                    (3, 2, 'Lait entier de vache', 0.00, 0),
                    (4, 2, 'Lait d\'avoine bio', 0.50, 1),
                    (5, 2, 'Lait d\'amande', 0.50, 2),
                    (6, 3, 'Sans sirop', 0.00, 0),
                    (7, 3, 'Sirop Vanille', 0.50, 1),
                    (8, 3, 'Sirop Caramel beurre salé', 0.50, 2),
                    (9, 4, 'Moyen (35 cl)', 0.00, 0),
                    (10, 4, 'Grand (50 cl)', 0.90, 1),
                    (11, 5, 'Lait entier', 0.00, 0),
                    (12, 5, 'Lait d\'avoine', 0.50, 1),
                    (13, 6, 'Vanille Bourbon', 0.00, 0),
                    (14, 6, 'Chocolat intense', 0.00, 1),
                    (15, 6, 'Fraise mara des bois', 0.00, 2),
                    (16, 7, 'Sans chantilly', 0.00, 0),
                    (17, 7, 'Avec chantilly maison', 0.60, 1),
                    (18, 8, 'Verre (33 cl)', 0.00, 0),
                    (19, 8, 'Bouteille (50 cl)', 1.20, 1);
                ");
            }
        } catch (Throwable) {
            // Ignorer si les tables existent déjà ou si les droits sont restreints
        }
    }

    /**
     * OPT-c : Liste les options personnalisables et leurs valeurs pour un produit donné.
     *
     * @param int $productId
     * @return array<int, array{
     *     id: int,
     *     product_id: int,
     *     nom: string,
     *     type: string,
     *     obligatoire: bool,
     *     ordre: int,
     *     valeurs: array<int, array{id: int, option_id: int, nom: string, surcout: float, ordre: int}>
     * }>
     */
    public function listerOptions(int $productId): array
    {
        $this->initialiserTablesOptions();

        $stmt = $this->pdo->prepare(
            'SELECT id, product_id, nom, type, obligatoire, ordre
               FROM product_option
              WHERE product_id = :product_id
              ORDER BY ordre ASC, id ASC'
        );
        $stmt->execute(['product_id' => $productId]);
        $optionsBrutes = $stmt->fetchAll();

        $totalOptions = count($optionsBrutes);
        if ($totalOptions === 0) {
            return [];
        }

        $resultat = [];

        for ($i = 0; $i < $totalOptions; $i++) {
            $opt = $optionsBrutes[$i];
            $optId = (int) $opt['id'];

            $stmtVal = $this->pdo->prepare(
                'SELECT id, option_id, nom, surcout, ordre
                   FROM product_option_value
                  WHERE option_id = :option_id
                  ORDER BY ordre ASC, id ASC'
            );
            $stmtVal->execute(['option_id' => $optId]);
            $valeursBrutes = $stmtVal->fetchAll();

            $valeurs = array_map(static function (array $v): array {
                return [
                    'id'        => (int) $v['id'],
                    'option_id' => (int) $v['option_id'],
                    'nom'       => (string) $v['nom'],
                    'surcout'   => (float) $v['surcout'],
                    'ordre'     => (int) $v['ordre'],
                ];
            }, $valeursBrutes);

            $resultat[] = [
                'id'          => $optId,
                'product_id'  => (int) $opt['product_id'],
                'nom'         => (string) $opt['nom'],
                'type'        => (string) $opt['type'],
                'obligatoire' => (bool) $opt['obligatoire'],
                'ordre'       => (int) $opt['ordre'],
                'valeurs'     => $valeurs,
            ];
        }

        return $resultat;
    }

    /**
     * Supprime une option d'un produit.
     *
     * @param int $optionId
     * @param int $productId
     * @return bool
     */
    public function supprimerOption(int $optionId, int $productId): bool
    {
        $this->initialiserTablesOptions();
        $stmt = $this->pdo->prepare('DELETE FROM product_option WHERE id = :id AND product_id = :product_id');
        return $stmt->execute([
            'id'         => $optionId,
            'product_id' => $productId,
        ]);
    }

    /**
     * Synchronise de façon atomique les options et valeurs d'un produit.
     *
     * @param int $productId
     * @param array<int, array{
     *     id?: int,
     *     nom: string,
     *     type?: string,
     *     obligatoire?: bool|int,
     *     ordre?: int,
     *     valeurs?: array<int, array{id?: int, nom: string, surcout?: float|int|string, ordre?: int}>
     * }> $options
     * @return void
     */
    public function synchroniserOptions(int $productId, array $options): void
    {
        $this->initialiserTablesOptions();

        $stmtExistantes = $this->pdo->prepare('SELECT id FROM product_option WHERE product_id = :product_id');
        $stmtExistantes->execute(['product_id' => $productId]);
        $idsExistants = $stmtExistantes->fetchAll(PDO::FETCH_COLUMN);

        $idsConserves = [];
        $totalOptions = count($options);

        for ($i = 0; $i < $totalOptions; $i++) {
            $opt = $options[$i];
            $nomOpt = trim((string) ($opt['nom'] ?? ''));
            if ($nomOpt === '') {
                continue;
            }

            $typeOpt = !empty($opt['type']) ? (string) $opt['type'] : 'radio';
            $obligatoire = !empty($opt['obligatoire']) ? 1 : 0;
            $ordreOpt = isset($opt['ordre']) ? (int) $opt['ordre'] : $i;
            $optId = isset($opt['id']) && is_numeric($opt['id']) ? (int) $opt['id'] : 0;

            if ($optId > 0 && in_array($optId, $idsExistants, true)) {
                $stmtUpdateOpt = $this->pdo->prepare(
                    'UPDATE product_option
                        SET nom = :nom, type = :type, obligatoire = :obligatoire, ordre = :ordre
                      WHERE id = :id AND product_id = :product_id'
                );
                $stmtUpdateOpt->execute([
                    'nom'         => $nomOpt,
                    'type'        => $typeOpt,
                    'obligatoire' => $obligatoire,
                    'ordre'       => $ordreOpt,
                    'id'          => $optId,
                    'product_id'  => $productId,
                ]);
            } else {
                $stmtInsertOpt = $this->pdo->prepare(
                    'INSERT INTO product_option (product_id, nom, type, obligatoire, ordre)
                     VALUES (:product_id, :nom, :type, :obligatoire, :ordre)'
                );
                $stmtInsertOpt->execute([
                    'product_id'  => $productId,
                    'nom'         => $nomOpt,
                    'type'        => $typeOpt,
                    'obligatoire' => $obligatoire,
                    'ordre'       => $ordreOpt,
                ]);
                $optId = (int) $this->pdo->lastInsertId();
            }

            $idsConserves[] = $optId;

            // Synchronisation des valeurs de cette option
            $valeurs = isset($opt['valeurs']) && is_array($opt['valeurs']) ? $opt['valeurs'] : [];
            $totalValeurs = count($valeurs);

            $stmtValsExistantes = $this->pdo->prepare('SELECT id FROM product_option_value WHERE option_id = :option_id');
            $stmtValsExistantes->execute(['option_id' => $optId]);
            $idsValsExistants = $stmtValsExistantes->fetchAll(PDO::FETCH_COLUMN);

            $idsValsConserves = [];

            for ($j = 0; $j < $totalValeurs; $j++) {
                $val = $valeurs[$j];
                $nomVal = trim((string) ($val['nom'] ?? ''));
                if ($nomVal === '') {
                    continue;
                }

                $surcout = isset($val['surcout']) && is_numeric($val['surcout']) ? (float) $val['surcout'] : 0.0;
                $ordreVal = isset($val['ordre']) ? (int) $val['ordre'] : $j;
                $valId = isset($val['id']) && is_numeric($val['id']) ? (int) $val['id'] : 0;

                if ($valId > 0 && in_array($valId, $idsValsExistants, true)) {
                    $stmtUpdateVal = $this->pdo->prepare(
                        'UPDATE product_option_value
                            SET nom = :nom, surcout = :surcout, ordre = :ordre
                          WHERE id = :id AND option_id = :option_id'
                    );
                    $stmtUpdateVal->execute([
                        'nom'       => $nomVal,
                        'surcout'   => $surcout,
                        'ordre'     => $ordreVal,
                        'id'        => $valId,
                        'option_id' => $optId,
                    ]);
                } else {
                    $stmtInsertVal = $this->pdo->prepare(
                        'INSERT INTO product_option_value (option_id, nom, surcout, ordre)
                         VALUES (:option_id, :nom, :surcout, :ordre)'
                    );
                    $stmtInsertVal->execute([
                        'option_id' => $optId,
                        'nom'       => $nomVal,
                        'surcout'   => $surcout,
                        'ordre'     => $ordreVal,
                    ]);
                    $valId = (int) $this->pdo->lastInsertId();
                }

                $idsValsConserves[] = $valId;
            }

            // Supprimer les valeurs d'option retirées
            $totalValsExistantes = count($idsValsExistants);
            for ($k = 0; $k < $totalValsExistantes; $k++) {
                $exId = (int) $idsValsExistants[$k];
                if (!in_array($exId, $idsValsConserves, true)) {
                    $stmtSupprVal = $this->pdo->prepare('DELETE FROM product_option_value WHERE id = :id AND option_id = :option_id');
                    $stmtSupprVal->execute(['id' => $exId, 'option_id' => $optId]);
                }
            }
        }

        // Supprimer les options retirées
        $totalExistantes = count($idsExistants);
        for ($m = 0; $m < $totalExistantes; $m++) {
            $exOptId = (int) $idsExistants[$m];
            if (!in_array($exOptId, $idsConserves, true)) {
                $stmtSupprOpt = $this->pdo->prepare('DELETE FROM product_option WHERE id = :id AND product_id = :product_id');
                $stmtSupprOpt->execute(['id' => $exOptId, 'product_id' => $productId]);
            }
        }
    }
}
