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
                       COALESCE((SELECT MIN(pv.prix) FROM product_variant pv WHERE pv.product_id = product.id AND pv.actif = 1), product.prix) AS prix,
                       COALESCE((SELECT SUM(pv.stock) FROM product_variant pv WHERE pv.product_id = product.id AND pv.actif = 1), product.stock) AS stock,
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
                    COALESCE((SELECT MIN(pv.prix) FROM product_variant pv WHERE pv.product_id = product.id AND pv.actif = 1), product.prix) AS prix,
                    COALESCE((SELECT SUM(pv.stock) FROM product_variant pv WHERE pv.product_id = product.id AND pv.actif = 1), product.stock) AS stock,
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

            if (!empty($donnees['valeur_ids']) && is_array($donnees['valeur_ids'])) {
                $stmtValVar = $this->pdo->prepare(
                    'INSERT IGNORE INTO product_variant_value (variant_id, option_value_id) VALUES (:variant_id, :option_value_id)'
                );
                $valIds = $donnees['valeur_ids'];
                for ($v = 0, $nbV = count($valIds); $v < $nbV; $v++) {
                    $optValId = (int) $valIds[$v];
                    if ($optValId > 0) {
                        $stmtValVar->execute([
                            'variant_id'      => $variantId,
                            'option_value_id' => $optValId,
                        ]);
                    }
                }
            }

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

        $res = $stmt->execute([
            'variant_id'   => $variantId,
            'product_id'   => $productId,
            'nom'          => (string) $donnees['nom'],
            'prix'         => (float) $donnees['prix'],
            'stock'        => (int) $donnees['stock'],
            'seuil_alerte' => (int) $donnees['seuil_alerte'],
            'actif'        => isset($donnees['actif']) ? (int) $donnees['actif'] : 1,
        ]);

        if ($res && isset($donnees['valeur_ids']) && is_array($donnees['valeur_ids'])) {
            $this->pdo->prepare('DELETE FROM product_variant_value WHERE variant_id = :id')->execute(['id' => $variantId]);
            $stmtInsert = $this->pdo->prepare(
                'INSERT IGNORE INTO product_variant_value (variant_id, option_value_id) VALUES (:variant_id, :option_value_id)'
            );
            $valeurIds = $donnees['valeur_ids'];
            for ($v = 0, $nbV = count($valeurIds); $v < $nbV; $v++) {
                $optValId = (int) $valeurIds[$v];
                if ($optValId > 0) {
                    $stmtInsert->execute([
                        'variant_id'      => $variantId,
                        'option_value_id' => $optValId,
                    ]);
                }
            }
        }

        return $res;
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
        $this->initialiserTablesOptions();

        $stmt = $this->pdo->prepare(
            'SELECT id, product_id, nom, prix, stock, seuil_alerte, actif
               FROM product_variant
              WHERE product_id = :product_id AND actif = 1
              ORDER BY id ASC'
        );
        $stmt->execute(['product_id' => $productId]);
        $lignes = $stmt->fetchAll();

        $nbLignes = count($lignes);
        $resultat = [];

        $stmtVals = $this->pdo->prepare(
            'SELECT option_value_id
               FROM product_variant_value
              WHERE variant_id = :variant_id
              ORDER BY option_value_id ASC'
        );

        for ($i = 0; $i < $nbLignes; $i++) {
            $ligne = $lignes[$i];
            $variantId = (int) $ligne['id'];

            $stmtVals->execute(['variant_id' => $variantId]);
            $rowsVals = $stmtVals->fetchAll();
            $valeurIds = array_map(static function (array $v): int {
                return (int) $v['option_value_id'];
            }, $rowsVals);

            $resultat[] = [
                'id'           => $variantId,
                'product_id'   => (int) $ligne['product_id'],
                'nom'          => (string) $ligne['nom'],
                'prix'         => (float) $ligne['prix'],
                'stock'        => (int) $ligne['stock'],
                'seuil_alerte' => (int) $ligne['seuil_alerte'],
                'actif'        => (int) $ligne['actif'],
                'valeur_ids'   => $valeurIds,
            ];
        }

        return $resultat;
    }

    /**
     * OPT-b : Trouve une variante correspondant exactement à une liste d'identifiants de valeurs d'options.
     *
     * @param int $productId
     * @param array<int, int> $valeurIds
     * @return array{id: int, product_id: int, nom: string, prix: float, stock: int, seuil_alerte: int, actif: int, valeur_ids: array<int, int>}|null
     */
    public function trouverVarianteParValeurs(int $productId, array $valeurIds): ?array
    {
        $variantes = $this->listerVariantes($productId);
        $nbVars = count($variantes);
        if ($nbVars === 0) {
            return null;
        }

        $valeursTriees = array_map('intval', $valeurIds);
        sort($valeursTriees);

        for ($i = 0; $i < $nbVars; $i++) {
            $var = $variantes[$i];
            $varVals = array_map('intval', $var['valeur_ids'] ?? []);
            sort($varVals);
            if ($varVals === $valeursTriees) {
                return $var;
            }
        }

        return null;
    }

    /**
     * Initialise automatiquement les tables product_option, product_option_value, product_variant et product_variant_value si inexistantes.
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

            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS product_variant (
                    id INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
                    product_id INT(11) NOT NULL,
                    nom VARCHAR(150) NOT NULL,
                    prix DECIMAL(10,2) NOT NULL,
                    stock INT(11) NOT NULL DEFAULT 0,
                    seuil_alerte INT(11) NOT NULL DEFAULT 5,
                    actif TINYINT(1) NOT NULL DEFAULT 1,
                    PRIMARY KEY (id),
                    KEY fk_product_variant_product (product_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );

            $this->pdo->exec(
                "CREATE TABLE IF NOT EXISTS product_variant_value (
                    variant_id INT(10) UNSIGNED NOT NULL,
                    option_value_id INT(10) UNSIGNED NOT NULL,
                    PRIMARY KEY (variant_id, option_value_id),
                    KEY fk_pvv_option_value (option_value_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
            );

            // Vérifier s'il y a déjà des options, sinon insérer le jeu d'essai
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
                    (8, 8, 'Taille', 'radio', 1, 0),
                    (9, 8, 'Touche de fraîcheur', 'radio', 1, 1);

                    INSERT INTO product_option_value (id, option_id, nom, surcout, ordre) VALUES
                    (1, 1, 'Simple (Tasse)', 0.00, 0),
                    (2, 1, 'Double (+0,60 €)', 0.60, 1),
                    (3, 2, 'Lait entier de vache', 0.00, 0),
                    (4, 2, 'Lait d\'avoine bio', 0.50, 1),
                    (5, 2, 'Lait d\'amande', 0.50, 2),
                    (6, 3, 'Sans sirop', 0.00, 0),
                    (7, 3, 'Sirop Vanille', 0.50, 1),
                    (8, 3, 'Sirop Caramel beurre salé', 0.50, 2),
                    (9, 3, 'Sirop Noisette grillée', 0.50, 3),
                    (10, 4, 'Moyen (35 cl)', 0.00, 0),
                    (11, 4, 'Grand (50 cl)', 0.90, 1),
                    (12, 5, 'Lait entier', 0.00, 0),
                    (13, 5, 'Lait d\'avoine', 0.50, 1),
                    (14, 5, 'Lait de soja', 0.50, 2),
                    (15, 6, 'Vanille Bourbon', 0.00, 0),
                    (16, 6, 'Chocolat intense', 0.00, 1),
                    (17, 6, 'Fraise mara des bois', 0.00, 2),
                    (18, 6, 'Caramel beurre salé', 0.50, 3),
                    (19, 7, 'Sans chantilly', 0.00, 0),
                    (20, 7, 'Avec chantilly maison', 0.60, 1),
                    (21, 8, 'Verre (33 cl)', 0.00, 0),
                    (22, 8, 'Bouteille (50 cl)', 1.20, 1),
                    (23, 9, 'Classique nature', 0.00, 0),
                    (24, 9, 'Feuilles de menthe fraîche', 0.40, 1),
                    (25, 9, 'Gingembre pressé', 0.50, 2);
                ");
            }

            // OPT-b : Initialisation des variantes et stocks par combinaison
            $countVarVal = (int) $this->pdo->query("SELECT COUNT(*) FROM product_variant_value")->fetchColumn();
            if ($countVarVal === 0) {
                $this->pdo->exec("
                    INSERT INTO product_variant (id, product_id, nom, prix, stock, seuil_alerte, actif) VALUES
                    -- Chaï latte (ID: 2)
                    (1, 2, 'Moyen (35 cl), Lait entier', 4.50, 15, 5, 1),
                    (2, 2, 'Moyen (35 cl), Lait d\'avoine', 5.00, 8, 5, 1),
                    (3, 2, 'Moyen (35 cl), Lait de soja', 5.00, 0, 5, 1),
                    (4, 2, 'Grand (50 cl), Lait entier', 5.40, 4, 5, 1),
                    (5, 2, 'Grand (50 cl), Lait d\'avoine', 5.90, 2, 5, 1),
                    (6, 2, 'Grand (50 cl), Lait de soja', 5.90, 0, 5, 1),
                    -- Citronnade maison (ID: 8) (Bouteille + Gingembre inexistante)
                    (7, 8, 'Verre (33 cl), Classique nature', 3.50, 12, 5, 1),
                    (8, 8, 'Verre (33 cl), Feuilles de menthe fraîche', 3.90, 10, 5, 1),
                    (9, 8, 'Verre (33 cl), Gingembre pressé', 4.00, 0, 5, 1),
                    (10, 8, 'Bouteille (50 cl), Classique nature', 4.70, 8, 5, 1),
                    (11, 8, 'Bouteille (50 cl), Feuilles de menthe fraîche', 5.10, 3, 5, 1),
                    -- Milkshake (ID: 6)
                    (12, 6, 'Vanille Bourbon, Sans chantilly', 5.00, 10, 5, 1),
                    (13, 6, 'Vanille Bourbon, Avec chantilly maison', 5.60, 4, 5, 1),
                    (14, 6, 'Chocolat intense, Sans chantilly', 5.00, 6, 5, 1),
                    (15, 6, 'Chocolat intense, Avec chantilly maison', 5.60, 0, 5, 1),
                    (16, 6, 'Fraise mara des bois, Sans chantilly', 5.00, 5, 5, 1),
                    (17, 6, 'Fraise mara des bois, Avec chantilly maison', 5.60, 2, 5, 1),
                    (18, 6, 'Caramel beurre salé, Sans chantilly', 5.50, 0, 5, 1),
                    (19, 6, 'Caramel beurre salé, Avec chantilly maison', 6.10, 3, 5, 1),
                    -- Café noisette (ID: 1)
                    (20, 1, 'Simple (Tasse), Lait entier, Sans sirop', 2.50, 25, 5, 1),
                    (21, 1, 'Simple (Tasse), Lait d\'avoine bio, Sans sirop', 3.00, 10, 5, 1),
                    (22, 1, 'Simple (Tasse), Lait d\'amande, Sans sirop', 3.00, 6, 5, 1),
                    (23, 1, 'Simple (Tasse), Lait entier, Sirop Vanille', 3.00, 8, 5, 1),
                    (24, 1, 'Simple (Tasse), Lait entier, Sirop Caramel', 3.00, 3, 5, 1),
                    (25, 1, 'Simple (Tasse), Lait entier, Sirop Noisette', 3.00, 0, 5, 1),
                    (26, 1, 'Double, Lait entier, Sans sirop', 3.10, 15, 5, 1),
                    (27, 1, 'Double, Lait d\'avoine bio, Sans sirop', 3.60, 4, 5, 1),
                    (28, 1, 'Double, Lait d\'amande, Sans sirop', 3.60, 0, 5, 1),
                    (29, 1, 'Double, Lait entier, Sirop Caramel', 3.60, 2, 5, 1)
                    ON DUPLICATE KEY UPDATE nom = VALUES(nom), prix = VALUES(prix), stock = VALUES(stock), seuil_alerte = VALUES(seuil_alerte);

                    INSERT INTO product_variant_value (variant_id, option_value_id) VALUES
                    (1, 10), (1, 12),
                    (2, 10), (2, 13),
                    (3, 10), (3, 14),
                    (4, 11), (4, 12),
                    (5, 11), (5, 13),
                    (6, 11), (6, 14),
                    (7, 21), (7, 23),
                    (8, 21), (8, 24),
                    (9, 21), (9, 25),
                    (10, 22), (10, 23),
                    (11, 22), (11, 24),
                    (12, 15), (12, 19),
                    (13, 15), (13, 20),
                    (14, 16), (14, 19),
                    (15, 16), (15, 20),
                    (16, 17), (16, 19),
                    (17, 17), (17, 20),
                    (18, 18), (18, 19),
                    (19, 18), (19, 20),
                    (20, 1), (20, 3), (20, 6),
                    (21, 1), (21, 4), (21, 6),
                    (22, 1), (22, 5), (22, 6),
                    (23, 1), (23, 3), (23, 7),
                    (24, 1), (24, 3), (24, 8),
                    (25, 1), (25, 3), (25, 9),
                    (26, 2), (26, 3), (26, 6),
                    (27, 2), (27, 4), (27, 6),
                    (28, 2), (28, 5), (28, 6),
                    (29, 2), (29, 3), (29, 8)
                    ON DUPLICATE KEY UPDATE option_value_id = VALUES(option_value_id);
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

        // Génération automatique des combinaisons de variantes correspondantes
        $this->genererVariantesDepuisOptions($productId);
    }

    /**
     * Calcule le produit cartésien d'une liste de groupes de valeurs (sans foreach).
     *
     * @param array<int, array<int, array{id: int, nom: string, surcout: float|int|string}>> $groupes
     * @return array<int, array<int, array{id: int, nom: string, surcout: float|int|string}>>
     */
    private function calculerProduitCartesien(array $groupes): array
    {
        if (empty($groupes)) {
            return [];
        }

        $combinaisons = [[]];
        $nbGroupes = count($groupes);

        for ($g = 0; $g < $nbGroupes; $g++) {
            $groupe = $groupes[$g];
            $nouvelles = [];
            $nbComb = count($combinaisons);
            $nbVals = count($groupe);

            for ($c = 0; $c < $nbComb; $c++) {
                $base = $combinaisons[$c];
                for ($v = 0; $v < $nbVals; $v++) {
                    $copie = $base;
                    $copie[] = $groupe[$v];
                    $nouvelles[] = $copie;
                }
            }

            $combinaisons = $nouvelles;
        }

        return $combinaisons;
    }

    /**
     * Génère automatiquement toutes les combinaisons de variantes (produit cartésien)
     * à partir des options configurées pour un produit, en préservant les stocks existants.
     *
     * @param int $productId
     * @return array<int, array{id: int, product_id: int, nom: string, prix: float, stock: int, seuil_alerte: int, actif: int, valeur_ids?: array<int, int>}>
     */
    public function genererVariantesDepuisOptions(int $productId): array
    {
        $this->initialiserTablesOptions();

        $stmtProd = $this->pdo->prepare('SELECT id, nom, prix, stock, seuil_alerte FROM product WHERE id = :id');
        $stmtProd->execute(['id' => $productId]);
        $produit = $stmtProd->fetch(PDO::FETCH_ASSOC);

        if (!$produit) {
            return [];
        }

        $prixBase = (float) $produit['prix'];
        $stockBase = (int) ($produit['stock'] ?? 0);
        $seuilAlerte = (int) ($produit['seuil_alerte'] ?? 5);

        // Récupérer les options et leurs valeurs ordonnées
        $stmtOpts = $this->pdo->prepare(
            'SELECT id, nom, obligatoire
               FROM product_option
              WHERE product_id = :product_id
              ORDER BY ordre ASC, id ASC'
        );
        $stmtOpts->execute(['product_id' => $productId]);
        $options = $stmtOpts->fetchAll(PDO::FETCH_ASSOC);

        $nbOptions = count($options);
        if ($nbOptions === 0) {
            return [];
        }

        $stmtVals = $this->pdo->prepare(
            'SELECT id, nom, surcout
               FROM product_option_value
              WHERE option_id = :option_id
              ORDER BY ordre ASC, id ASC'
        );

        $groupesValeurs = [];
        for ($i = 0; $i < $nbOptions; $i++) {
            $opt = $options[$i];
            $stmtVals->execute(['option_id' => (int) $opt['id']]);
            $vals = $stmtVals->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($vals)) {
                $groupesValeurs[] = $vals;
            }
        }

        if (empty($groupesValeurs)) {
            return [];
        }

        // Calcul de toutes les combinaisons cartésiennes
        $combinaisons = $this->calculerProduitCartesien($groupesValeurs);
        $nbCombinaisons = count($combinaisons);

        if ($nbCombinaisons === 0) {
            return [];
        }

        // Indexation des variantes existantes du produit par combinaison de valeur_ids
        $stmtExistantes = $this->pdo->prepare(
            'SELECT id, nom, prix, stock, seuil_alerte, actif
               FROM product_variant
              WHERE product_id = :product_id'
        );
        $stmtExistantes->execute(['product_id' => $productId]);
        $existantes = $stmtExistantes->fetchAll(PDO::FETCH_ASSOC);

        $stmtVarVals = $this->pdo->prepare(
            'SELECT option_value_id
               FROM product_variant_value
              WHERE variant_id = :variant_id
              ORDER BY option_value_id ASC'
        );

        $existantesParCle = [];
        $nbExistantes = count($existantes);

        for ($e = 0; $e < $nbExistantes; $e++) {
            $varRow = $existantes[$e];
            $stmtVarVals->execute(['variant_id' => (int) $varRow['id']]);
            $vVals = $stmtVarVals->fetchAll(PDO::FETCH_COLUMN);
            $vValsInt = array_map('intval', $vVals);
            sort($vValsInt);
            $cle = implode('_', $vValsInt);
            $existantesParCle[$cle] = $varRow;
        }

        $stmtInsertVar = $this->pdo->prepare(
            'INSERT INTO product_variant (product_id, nom, prix, stock, seuil_alerte, actif)
             VALUES (:product_id, :nom, :prix, :stock, :seuil_alerte, 1)'
        );

        $stmtUpdateVar = $this->pdo->prepare(
            'UPDATE product_variant
                SET nom = :nom, prix = :prix, actif = 1
              WHERE id = :id'
        );

        $stmtInsertVarVal = $this->pdo->prepare(
            'INSERT IGNORE INTO product_variant_value (variant_id, option_value_id)
             VALUES (:variant_id, :option_value_id)'
        );

        $idsVariantesConservees = [];

        for ($k = 0; $k < $nbCombinaisons; $k++) {
            $comb = $combinaisons[$k];

            $valIds = array_map(static function (array $val): int {
                return (int) $val['id'];
            }, $comb);
            sort($valIds);
            $cle = implode('_', $valIds);

            $noms = array_map(static function (array $val): string {
                return (string) $val['nom'];
            }, $comb);
            $nomVariante = implode(', ', $noms);

            $surcoutTotal = 0.0;
            $nbValsComb = count($comb);
            for ($vc = 0; $vc < $nbValsComb; $vc++) {
                $surcoutTotal += (float) ($comb[$vc]['surcout'] ?? 0.0);
            }
            $prixVariante = round($prixBase + $surcoutTotal, 2);

            if (isset($existantesParCle[$cle])) {
                // Variante existante : préserver le stock actuel et réactiver si nécessaire
                $varId = (int) $existantesParCle[$cle]['id'];
                $stmtUpdateVar->execute([
                    'nom'  => $nomVariante,
                    'prix' => $prixVariante,
                    'id'   => $varId,
                ]);
                $idsVariantesConservees[] = $varId;
            } else {
                // Nouvelle combinaison : insertion dans product_variant
                $stmtInsertVar->execute([
                    'product_id'   => $productId,
                    'nom'          => $nomVariante,
                    'prix'         => $prixVariante,
                    'stock'        => $stockBase,
                    'seuil_alerte' => $seuilAlerte,
                ]);
                $varId = (int) $this->pdo->lastInsertId();

                $nbV = count($valIds);
                for ($v = 0; $v < $nbV; $v++) {
                    $stmtInsertVarVal->execute([
                        'variant_id'      => $varId,
                        'option_value_id' => $valIds[$v],
                    ]);
                }
                $idsVariantesConservees[] = $varId;
            }
        }

        // Marquer inactives les anciennes variantes obsolètes qui ne correspondent plus aux options
        for ($e = 0; $e < $nbExistantes; $e++) {
            $exId = (int) $existantes[$e]['id'];
            if (!in_array($exId, $idsVariantesConservees, true)) {
                $this->pdo->prepare('UPDATE product_variant SET actif = 0 WHERE id = :id')->execute(['id' => $exId]);
            }
        }

        return $this->listerVariantes($productId);
    }
}
