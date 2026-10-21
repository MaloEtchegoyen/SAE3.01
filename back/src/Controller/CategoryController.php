<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\CategoryModel;
use Throwable;

/**
 * Contrôleur des catégories pour le catalogue public et l'administration.
 */
final class CategoryController
{
    /** Modèle d'accès aux catégories. */
    private CategoryModel $categories;

    public function __construct(CategoryModel $categories)
    {
        $this->categories = $categories;
    }

    /**
     * Vérifie que la session active appartient à un administrateur.
     */
    private function verifierAccesAdmin(): void
    {
        if (($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }
    }

    /**
     * Liste publique des catégories en JSON (accessible à tous).
     */
    public function publicCatalogue(?Request $requete = null): void
    {
        Response::json($this->categories->lister());
    }

    /**
     * Liste des catégories en JSON pour l'administration.
     */
    public function index(?Request $requete = null): void
    {
        $this->verifierAccesAdmin();
        Response::json($this->categories->lister());
    }

    /**
     * Crée une nouvelle catégorie.
     */
    public function creer(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $nom = trim((string) ($corps['nom'] ?? ''));
        $description = trim((string) ($corps['description'] ?? ''));

        if ($nom === '') {
            Response::erreur('Le nom de la catégorie est obligatoire', 400);
        }

        if (mb_strlen($nom) < 2) {
            Response::erreur('Le nom de la catégorie doit comporter au moins 2 caractères', 400);
        }

        if (mb_strlen($nom) > 100) {
            Response::erreur('Le nom de la catégorie ne peut pas dépasser 100 caractères', 400);
        }

        if ($this->categories->existeParNom($nom)) {
            Response::erreur('Une catégorie portant ce nom existe déjà', 409);
        }

        try {
            $id = $this->categories->creer([
                'nom'         => $nom,
                'description' => $description,
            ]);

            Response::json([
                'succes'  => true,
                'id'      => $id,
                'message' => 'Catégorie créée avec succès.',
            ], 201);
        } catch (Throwable $e) {
            Response::erreur('Impossible de créer la catégorie : ' . $e->getMessage(), 500);
        }
    }

    /**
     * Modifie une catégorie existante.
     */
    public function modifier(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $id = (int) ($requete->parametre('id') ?? 0);
        if ($id <= 0) {
            Response::erreur('Identifiant de catégorie invalide', 400);
        }

        $categorieExistante = $this->categories->trouverParId($id);
        if ($categorieExistante === null) {
            Response::erreur('Catégorie introuvable', 404);
        }

        $corps = $requete->corps();
        $nom = trim((string) ($corps['nom'] ?? ''));
        $description = trim((string) ($corps['description'] ?? ''));

        if ($nom === '') {
            Response::erreur('Le nom de la catégorie est obligatoire', 400);
        }

        if (mb_strlen($nom) < 2) {
            Response::erreur('Le nom de la catégorie doit comporter au moins 2 caractères', 400);
        }

        if (mb_strlen($nom) > 100) {
            Response::erreur('Le nom de la catégorie ne peut pas dépasser 100 caractères', 400);
        }

        if ($this->categories->existeParNom($nom, $id)) {
            Response::erreur('Une autre catégorie portant ce nom existe déjà', 409);
        }

        try {
            $this->categories->modifier($id, [
                'nom'         => $nom,
                'description' => $description,
            ]);

            Response::json([
                'succes'  => true,
                'message' => 'Catégorie modifiée avec succès.',
            ]);
        } catch (Throwable $e) {
            Response::erreur('Impossible de modifier la catégorie : ' . $e->getMessage(), 500);
        }
    }

    /**
     * Supprime une catégorie après vérification et gestion des produits rattachés.
     */
    public function supprimer(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $id = (int) ($requete->parametre('id') ?? $corps['id'] ?? 0);
        if ($id <= 0) {
            Response::erreur('Identifiant de catégorie invalide', 400);
        }

        $categorie = $this->categories->trouverParId($id);
        if ($categorie === null) {
            Response::erreur('Catégorie introuvable', 404);
        }

        // Règle de gestion des produits rattachés : 'bloquer' (par défaut), 'detach', ou 'reassign'
        $actionProduits = (string) ($requete->parametre('action_produits') ?? $corps['action_produits'] ?? 'bloquer');
        $rawNouvelleId = $requete->parametre('nouvelle_category_id') ?? $corps['nouvelle_category_id'] ?? null;
        $nouvelleCategoryId = ($rawNouvelleId !== null && $rawNouvelleId !== '')
            ? (int) $rawNouvelleId
            : null;

        try {
            $this->categories->supprimer($id, $actionProduits, $nouvelleCategoryId);

            Response::json([
                'succes'  => true,
                'message' => 'Catégorie supprimée avec succès.',
            ]);
        } catch (\InvalidArgumentException $e) {
            Response::erreur($e->getMessage(), 400);
        } catch (\RuntimeException $e) {
            Response::erreur($e->getMessage(), 409);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la suppression de la catégorie : ' . $e->getMessage(), 500);
        }
    }
}

