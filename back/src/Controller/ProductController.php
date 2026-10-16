<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\ProductModel;
use Throwable;

/**
 * Contrôleur des produits pour l'administration.
 */
final class ProductController
{
    /** Modèle d'accès aux produits. */
    private ProductModel $produits;

    public function __construct(ProductModel $produits)
    {
        $this->produits = $produits;
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
     * Liste des produits en JSON pour les administrateurs.
     */
    public function index(?Request $requete = null): void
    {
        $this->verifierAccesAdmin();
        Response::json($this->produits->lister());
    }

    /**
     * Liste des catégories en JSON pour les administrateurs.
     */
    public function categories(?Request $requete = null): void
    {
        $this->verifierAccesAdmin();
        Response::json($this->produits->listerCategories());
    }

    /**
     * Détail d'un produit avec ses images et ses options/variantes.
     */
    public function detail(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $id = (int) ($requete->parametre('id') ?? 0);
        if ($id <= 0) {
            Response::erreur('Identifiant de produit invalide ou manquant', 400);
        }

        $produit = $this->produits->trouverParId($id);
        if ($produit === null) {
            Response::erreur('Produit introuvable', 404);
        }

        $produit['images']    = $this->produits->listerImages($id);
        $produit['variantes'] = $this->produits->listerVariantes($id);

        Response::json($produit);
    }

    /**
     * US 1 : Créer un nouveau produit avec toutes ses informations.
     */
    public function creer(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        if (empty($corps['nom']) || !is_string($corps['nom'])) {
            Response::erreur('Le nom du produit est requis', 400);
        }

        if (!isset($corps['prix']) || !is_numeric($corps['prix']) || (float) $corps['prix'] < 0) {
            Response::erreur('Le prix doit être un nombre positif ou nul', 400);
        }

        try {
            $id = $this->produits->ajouter($corps);
            Response::json(['succes' => true, 'id' => $id, 'message' => 'Produit créé avec succès.'], 201);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la création du produit : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 2 : Modifier tous les aspects d'un produit existant.
     */
    public function modifier(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $id    = (int) ($requete->parametre('id') ?? $corps['id'] ?? 0);

        if ($id <= 0) {
            Response::erreur('Identifiant de produit invalide', 400);
        }

        if (empty($corps['nom']) || !is_string($corps['nom'])) {
            Response::erreur('Le nom du produit est requis', 400);
        }

        if (!isset($corps['prix']) || !is_numeric($corps['prix']) || (float) $corps['prix'] < 0) {
            Response::erreur('Le prix doit être un nombre positif ou nul', 400);
        }

        try {
            $this->produits->modifier($id, $corps);
            Response::json(['succes' => true, 'message' => 'Produit mis à jour avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la mise à jour du produit : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 3 : Supprimer un produit après confirmation.
     */
    public function supprimer(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $id = (int) ($requete->parametre('id') ?? $corps['id'] ?? 0);
        $definitifParam = $requete->parametre('definitif') ?? $corps['definitif'] ?? null;
        $definitif = $definitifParam !== null ? (bool) $definitifParam : true;

        if ($id <= 0) {
            Response::erreur('Identifiant de produit invalide', 400);
        }

        try {
            $this->produits->supprimer($id, $definitif);
            Response::json(['succes' => true, 'message' => 'Produit supprimé avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la suppression du produit : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 4 : Ajouter une image pour un produit.
     */
    public function ajouterImage(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps      = $requete->corps();
        $productId  = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? 0);
        $url        = (string) ($corps['url'] ?? '');
        $alt        = isset($corps['alt']) ? (string) $corps['alt'] : null;
        $principale = !empty($corps['est_principale']);
        $ordre      = (int) ($corps['ordre'] ?? 0);

        if ($productId <= 0 || empty($url)) {
            Response::erreur('Identifiant de produit et URL d\'image requis', 400);
        }

        try {
            $imageId = $this->produits->ajouterImage($productId, $url, $alt, $principale, $ordre);
            Response::json(['succes' => true, 'id' => $imageId, 'message' => 'Image ajoutée avec succès.'], 201);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de l\'ajout de l\'image : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 4 : Lister les images d'un produit.
     */
    public function listerImages(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $productId = (int) ($requete->parametre('productId') ?? 0);
        if ($productId <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        Response::json($this->produits->listerImages($productId));
    }

    /**
     * US 4 : Définir l'image principale d'un produit.
     */
    public function definirImagePrincipale(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps     = $requete->corps();
        $productId = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? 0);
        $imageId   = (int) ($corps['image_id'] ?? $requete->parametre('imageId') ?? 0);

        if ($productId <= 0 || $imageId <= 0) {
            Response::erreur('Identifiants de produit et d\'image requis', 400);
        }

        try {
            $this->produits->definirImagePrincipale($productId, $imageId);
            Response::json(['succes' => true, 'message' => 'Image principale mise à jour.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors du changement d\'image principale : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 4 : Supprimer une image d'un produit.
     */
    public function supprimerImage(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps     = $requete->corps();
        $productId = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? 0);
        $imageId   = (int) ($corps['image_id'] ?? $requete->parametre('imageId') ?? 0);

        if ($productId <= 0 || $imageId <= 0) {
            Response::erreur('Identifiants de produit et d\'image requis', 400);
        }

        try {
            $this->produits->supprimerImage($imageId, $productId);
            Response::json(['succes' => true, 'message' => 'Image supprimée avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la suppression de l\'image : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 5 : Fixer le prix et le stock d'un produit.
     */
    public function fixerPrixEtStock(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $id    = (int) ($corps['id'] ?? $requete->parametre('id') ?? 0);

        if ($id <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        if (!isset($corps['prix']) || !is_numeric($corps['prix']) || (float) $corps['prix'] < 0) {
            Response::erreur('Le prix doit être un nombre positif ou nul', 400);
        }

        if (!isset($corps['stock']) || !is_numeric($corps['stock']) || (int) $corps['stock'] < 0) {
            Response::erreur('Le stock doit être un entier positif ou nul', 400);
        }

        $prix  = (float) $corps['prix'];
        $stock = (int) $corps['stock'];
        $motif = (string) ($corps['motif'] ?? 'ajustement_manuel');

        try {
            $this->produits->fixerPrixEtStock($id, $prix, $stock, $motif);
            Response::json(['succes' => true, 'message' => 'Prix et stock mis à jour avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la mise à jour prix/stock : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 6 : Modifier le seuil d'alerte « Bientôt épuisé ».
     */
    public function modifierSeuilAlerte(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $id    = (int) ($corps['id'] ?? $requete->parametre('id') ?? 0);

        if ($id <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        if (!isset($corps['seuil_alerte']) || !is_numeric($corps['seuil_alerte']) || (int) $corps['seuil_alerte'] < 0) {
            Response::erreur('Le seuil d\'alerte doit être un entier positif ou nul', 400);
        }

        $seuil = (int) $corps['seuil_alerte'];

        try {
            $this->produits->modifierSeuilAlerte($id, $seuil);
            Response::json(['succes' => true, 'message' => 'Seuil d\'alerte mis à jour avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la modification du seuil : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 6 : Lister les produits en alerte « Bientôt épuisé ».
     */
    public function alertesStock(?Request $requete = null): void
    {
        $this->verifierAccesAdmin();
        Response::json($this->produits->listerProduitsBientotEpuises());
    }

    /**
     * US 7 : Lister les options / variantes d'un produit.
     */
    public function listerVariantes(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $productId = (int) ($requete->parametre('productId') ?? 0);
        if ($productId <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        Response::json($this->produits->listerVariantes($productId));
    }

    /**
     * US 7 : Ajouter une option / variante pour un produit.
     */
    public function ajouterVariante(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps     = $requete->corps();
        $productId = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? 0);

        if ($productId <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        if (empty($corps['nom']) || !is_string($corps['nom'])) {
            Response::erreur('Le nom de l\'option/variante est requis', 400);
        }

        if (!isset($corps['prix']) || !is_numeric($corps['prix']) || (float) $corps['prix'] < 0) {
            Response::erreur('Le prix de la variante doit être un nombre positif ou nul', 400);
        }

        try {
            $variantId = $this->produits->ajouterVariante($productId, $corps);
            Response::json(['succes' => true, 'id' => $variantId, 'message' => 'Option créée avec succès.'], 201);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de l\'ajout de l\'option : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 7 : Modifier une option / variante existante.
     */
    public function modifierVariante(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps     = $requete->corps();
        $variantId = (int) ($corps['variant_id'] ?? $corps['id'] ?? 0);
        $productId = (int) ($corps['product_id'] ?? 0);

        if ($variantId <= 0 || $productId <= 0) {
            Response::erreur('Identifiants de variante et de produit requis', 400);
        }

        if (empty($corps['nom']) || !is_string($corps['nom'])) {
            Response::erreur('Le nom de l\'option/variante est requis', 400);
        }

        try {
            $this->produits->modifierVariante($variantId, $productId, $corps);
            Response::json(['succes' => true, 'message' => 'Option mise à jour avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la modification de l\'option : ' . $e->getMessage(), 500);
        }
    }

    /**
     * US 7 : Supprimer ou désactiver une option / variante d'un produit.
     */
    public function supprimerVariante(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps     = $requete->corps();
        $variantId = (int) ($corps['variant_id'] ?? $corps['id'] ?? $requete->parametre('variantId') ?? 0);
        $productId = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? 0);
        $definitif = (bool) ($corps['definitif'] ?? false);

        if ($variantId <= 0 || $productId <= 0) {
            Response::erreur('Identifiants de variante et de produit requis', 400);
        }

        try {
            $this->produits->supprimerVariante($variantId, $productId, $definitif);
            Response::json(['succes' => true, 'message' => 'Option supprimée avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la suppression de l\'option : ' . $e->getMessage(), 500);
        }
    }
}

