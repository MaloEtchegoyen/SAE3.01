<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use Throwable;

/**
 * Accès aux données des catégories pour le catalogue et l'administration.
 */
final class CategoryModel
{
    /** Connexion à la base de données. */
    private PDO $pdo;

    /** Indique si la colonne description est présente en base. */
    private ?bool $aColonneDescription = null;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Vérifie la présence de la colonne description et tente de l'ajouter si absente.
     */
    private function verifierColonneDescription(): bool
    {
        if ($this->aColonneDescription !== null) {
            return $this->aColonneDescription;
        }

        try {
            $stmt = $this->pdo->query("SHOW COLUMNS FROM category LIKE 'description'");
            $colonne = $stmt->fetch();
            if ($colonne !== false && !empty($colonne)) {
                $this->aColonneDescription = true;
                return true;
            }

            // Tenter d'ajouter la colonne si possible
            $this->pdo->exec("ALTER TABLE category ADD COLUMN description text DEFAULT NULL AFTER nom");
            $this->aColonneDescription = true;
            return true;
        } catch (Throwable) {
            $this->aColonneDescription = false;
            return false;
        }
    }

    /**
     * Liste toutes les catégories avec le nombre de produits rattachés.
     *
     * @return array<int, array{id: int, nom: string, description: string, nombre_produits: int}>
     */
    public function lister(): array
    {
        $avecDescription = $this->verifierColonneDescription();
        $colonneDesc = $avecDescription ? 'category.description' : "'' AS description";

        $sql = "SELECT category.id,
                       category.nom,
                       {$colonneDesc},
                       (
                           SELECT COUNT(*)
                             FROM product
                            WHERE product.category_id = category.id
                       ) AS nombre_produits
                  FROM category
              ORDER BY category.nom ASC";

        $stmt = $this->pdo->query($sql);
        $lignes = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return array_map(static function (array $ligne): array {
            return [
                'id'              => (int) $ligne['id'],
                'nom'             => (string) $ligne['nom'],
                'description'     => isset($ligne['description']) && $ligne['description'] !== null ? (string) $ligne['description'] : '',
                'nombre_produits' => (int) ($ligne['nombre_produits'] ?? 0),
            ];
        }, $lignes);
    }

    /**
     * Trouve une catégorie par son identifiant.
     *
     * @param int $id
     * @return array{id: int, nom: string, description: string, nombre_produits: int}|null
     */
    public function trouverParId(int $id): ?array
    {
        $avecDescription = $this->verifierColonneDescription();
        $colonneDesc = $avecDescription ? 'category.description' : "'' AS description";

        $sql = "SELECT category.id,
                       category.nom,
                       {$colonneDesc},
                       (
                           SELECT COUNT(*)
                             FROM product
                            WHERE product.category_id = category.id
                       ) AS nombre_produits
                  FROM category
                 WHERE category.id = :id
                 LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['id' => $id]);
        $ligne = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$ligne) {
            return null;
        }

        return [
            'id'              => (int) $ligne['id'],
            'nom'             => (string) $ligne['nom'],
            'description'     => isset($ligne['description']) && $ligne['description'] !== null ? (string) $ligne['description'] : '',
            'nombre_produits' => (int) ($ligne['nombre_produits'] ?? 0),
        ];
    }

    /**
     * Compte le nombre total de produits rattachés à une catégorie (actifs et inactifs).
     */
    public function compterProduits(int $id): int
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM product WHERE category_id = :id');
        $stmt->execute(['id' => $id]);
        return (int) $stmt->fetchColumn();
    }

    /**
     * Vérifie si un nom de catégorie existe déjà (pour éviter les doublons).
     */
    public function existeParNom(string $nom, ?int $exclureId = null): bool
    {
        if ($exclureId !== null && $exclureId > 0) {
            $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM category WHERE LOWER(TRIM(nom)) = LOWER(TRIM(:nom)) AND id != :id');
            $stmt->execute(['nom' => $nom, 'id' => $exclureId]);
        } else {
            $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM category WHERE LOWER(TRIM(nom)) = LOWER(TRIM(:nom))');
            $stmt->execute(['nom' => $nom]);
        }

        return ((int) $stmt->fetchColumn()) > 0;
    }

    /**
     * Crée une nouvelle catégorie.
     *
     * @param array{nom: string, description?: ?string} $donnees
     * @return int Identifiant de la catégorie créée
     */
    public function creer(array $donnees): int
    {
        $nom = trim($donnees['nom'] ?? '');
        $description = trim($donnees['description'] ?? '');

        $avecDescription = $this->verifierColonneDescription();

        if ($avecDescription) {
            $stmt = $this->pdo->prepare('INSERT INTO category (nom, description) VALUES (:nom, :description)');
            $stmt->execute([
                'nom'         => $nom,
                'description' => $description !== '' ? $description : null,
            ]);
        } else {
            $stmt = $this->pdo->prepare('INSERT INTO category (nom) VALUES (:nom)');
            $stmt->execute(['nom' => $nom]);
        }

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Modifie une catégorie existante.
     *
     * @param int $id
     * @param array{nom: string, description?: ?string} $donnees
     * @return bool
     */
    public function modifier(int $id, array $donnees): bool
    {
        $nom = trim($donnees['nom'] ?? '');
        $description = trim($donnees['description'] ?? '');

        $avecDescription = $this->verifierColonneDescription();

        if ($avecDescription) {
            $stmt = $this->pdo->prepare('UPDATE category SET nom = :nom, description = :description WHERE id = :id');
            return $stmt->execute([
                'id'          => $id,
                'nom'         => $nom,
                'description' => $description !== '' ? $description : null,
            ]);
        }

        $stmt = $this->pdo->prepare('UPDATE category SET nom = :nom WHERE id = :id');
        return $stmt->execute([
            'id'  => $id,
            'nom' => $nom,
        ]);
    }

    /**
     * Supprime une catégorie en appliquant la règle explicite de gestion des produits rattachés.
     *
     * @param int $id Identifiant de la catégorie à supprimer
     * @param string $actionProduits Règle : 'bloquer', 'detach' ou 'reassign'
     * @param int|null $nouvelleCategoryId ID de la catégorie cible en cas de réaffectation
     * @return bool
     */
    public function supprimer(int $id, string $actionProduits = 'bloquer', ?int $nouvelleCategoryId = null): bool
    {
        $nbProduits = $this->compterProduits($id);

        if ($nbProduits > 0) {
            if ($actionProduits === 'reassign') {
                if ($nouvelleCategoryId === null || $nouvelleCategoryId <= 0 || $nouvelleCategoryId === $id) {
                    throw new \InvalidArgumentException('Catégorie de réaffectation invalide.');
                }

                // Vérifier que la nouvelle catégorie existe
                $stmtVerif = $this->pdo->prepare('SELECT COUNT(*) FROM category WHERE id = :id');
                $stmtVerif->execute(['id' => $nouvelleCategoryId]);
                if (((int) $stmtVerif->fetchColumn()) === 0) {
                    throw new \InvalidArgumentException('La catégorie de destination sélectionnée n\'existe pas.');
                }
            } elseif ($actionProduits === 'detach') {
                // Détachement valide
            } else {
                throw new \RuntimeException(sprintf(
                    'Impossible de supprimer cette catégorie car %d produit(s) y sont rattachés.',
                    $nbProduits
                ));
            }
        }

        $this->pdo->beginTransaction();

        try {
            if ($nbProduits > 0) {
                if ($actionProduits === 'reassign') {
                    $stmtReassign = $this->pdo->prepare('UPDATE product SET category_id = :nouvelle_id WHERE category_id = :id');
                    $stmtReassign->execute([
                        'nouvelle_id' => $nouvelleCategoryId,
                        'id'          => $id,
                    ]);
                } elseif ($actionProduits === 'detach') {
                    $stmtDetach = $this->pdo->prepare('UPDATE product SET category_id = NULL WHERE category_id = :id');
                    $stmtDetach->execute(['id' => $id]);
                }
            }

            // Supprimer la catégorie
            $stmtDelete = $this->pdo->prepare('DELETE FROM category WHERE id = :id');
            $stmtDelete->execute(['id' => $id]);

            $this->pdo->commit();
            return true;
        } catch (Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            throw $e;
        }
    }
}

