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
     * Liste publique des produits du catalogue en JSON (accessible à tous).
     */
    public function catalogue(?Request $requete = null): void
    {
        Response::json($this->produits->lister());
    }

    /**
     * Liste publique des catégories en JSON (accessible à tous).
     */
    public function catalogueCategories(?Request $requete = null): void
    {
        Response::json($this->produits->listerCategories());
    }

    /**
     * Détail public d'un produit avec ses images et ses options/variantes.
     */
    public function catalogueDetail(Request $requete): void
    {
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
        $produit['options']   = $this->produits->listerOptions($id);

        Response::json($produit);
    }

    /**
     * Sert le fichier image d'un produit en flux binaire avec le bon Content-Type.
     *
     * @param Request $requete
     * @return never
     */
    public function servirImage(Request $requete): void
    {
        $nom = basename($requete->parametre('nom') ?? '');
        if ($nom === '') {
            Response::erreur('Nom d\'image manquant', 400);
        }

        // 1. Chercher dans uploads/produits (fichiers téléversés)
        $chemin = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'produits' . DIRECTORY_SEPARATOR . $nom;

        // 2. Si pas trouvé, chercher dans front/assets/produits (catalogue par défaut)
        if (!is_file($chemin)) {
            $chemin = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'front' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . 'produits' . DIRECTORY_SEPARATOR . $nom;
        }

        // 3. Si pas trouvé, chercher dans front/dist/assets (build de production)
        if (!is_file($chemin)) {
            $motif = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'front' . DIRECTORY_SEPARATOR . 'dist' . DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR . pathinfo($nom, PATHINFO_FILENAME) . '*';
            $fichiersDist = glob($motif);
            if (!empty($fichiersDist) && is_file($fichiersDist[0])) {
                $chemin = $fichiersDist[0];
            }
        }

        if (!is_file($chemin)) {
            Response::erreur('Image introuvable', 404);
        }

        $extension = strtolower(pathinfo($chemin, PATHINFO_EXTENSION));
        $typesMime = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'webp' => 'image/webp',
            'gif'  => 'image/gif',
            'svg'  => 'image/svg+xml',
        ];
        $contentType = $typesMime[$extension] ?? 'application/octet-stream';

        header('Content-Type: ' . $contentType);
        header('Content-Length: ' . (string) filesize($chemin));
        header('Cache-Control: public, max-age=86400');
        readfile($chemin);
        exit;
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
        $produit['options']   = $this->produits->listerOptions($id);

        Response::json($produit);
    }

    /**
     * Enregistre les images téléversées pour un produit avec move_uploaded_file.
     *
     * @param int $productId
     * @param array<string, mixed> $fichiersImages
    /**
     * Enregistre les images téléversées pour un produit avec move_uploaded_file et les insère dans product_image.
     *
     * @param int $productId
     * @param array<string, mixed> $fichiersImages
     * @return array<int, int> Liste des identifiants des images créées
     */
    private function enregistrerFichiersImages(int $productId, array $fichiersImages): array
    {
        $dossierUpload = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'produits';
        if (!is_dir($dossierUpload)) {
            mkdir($dossierUpload, 0755, true);
        }

        $names    = is_array($fichiersImages['name']) ? $fichiersImages['name'] : [$fichiersImages['name']];
        $tmpNames = is_array($fichiersImages['tmp_name']) ? $fichiersImages['tmp_name'] : [$fichiersImages['tmp_name']];
        $errors   = is_array($fichiersImages['error']) ? $fichiersImages['error'] : [$fichiersImages['error']];
        $count    = count($names);
        $idsInserts = [];

        for ($i = 0; $i < $count; $i++) {
            if ($errors[$i] !== UPLOAD_ERR_OK) {
                continue;
            }

            $nomOriginal = (string) $names[$i];
            $tmpPath     = (string) $tmpNames[$i];

            // Conserver le nom d'origine assaini pour éviter tout caractère dangereux
            $nomSecurise = basename($nomOriginal);
            $nomSecurise = preg_replace('/[^a-zA-Z0-9._-]/', '_', $nomSecurise) ?: ('image_' . time() . '_' . $i . '.jpg');

            $cheminDestination = $dossierUpload . DIRECTORY_SEPARATOR . $nomSecurise;

            if (move_uploaded_file($tmpPath, $cheminDestination)) {
                $idsInserts[] = $this->produits->ajouterImage($productId, $nomSecurise, null, false, $i);
            }
        }

        return $idsInserts;
    }

    /**
     * US 1 : Créer un nouveau produit avec toutes ses informations.
     */
    public function creer(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();

        // Si un identifiant est présent, rediriger vers la modification pour éviter toute création en doublon
        $idExistant = (int) ($requete->parametre('id') ?? $corps['id'] ?? 0);
        if ($idExistant > 0) {
            $this->modifier($requete);
            return;
        }

        if (empty($corps['nom']) || !is_string($corps['nom'])) {
            Response::erreur('Le nom du produit est requis', 400);
        }

        if (!isset($corps['prix']) || !is_numeric($corps['prix']) || (float) $corps['prix'] < 0) {
            Response::erreur('Le prix doit être un nombre positif ou nul', 400);
        }

        try {
            $id = $this->produits->ajouter($corps);

            // Traitement des images envoyées depuis le formulaire
            $fichiers = $requete->fichiers();
            $fichiersImages = !empty($fichiers['images']['name'])
                ? $fichiers['images']
                : (!empty($fichiers['image']['name']) ? $fichiers['image'] : null);

            if ($fichiersImages !== null) {
                $idsCrees = $this->enregistrerFichiersImages($id, $fichiersImages);
                $indexPrinc = isset($corps['image_principale_index']) && is_numeric($corps['image_principale_index'])
                    ? (int) $corps['image_principale_index']
                    : 0;

                if (isset($idsCrees[$indexPrinc])) {
                    $this->produits->definirImagePrincipale($id, $idsCrees[$indexPrinc]);
                } else {
                    $this->produits->garantirImagePrincipale($id);
                }
            }

            // Traitement éventuel des options personnalisables
            if (isset($corps['options'])) {
                $optionsData = is_string($corps['options']) ? json_decode($corps['options'], true) : $corps['options'];
                if (is_array($optionsData)) {
                    $this->produits->synchroniserOptions($id, $optionsData);
                }
            }

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

            // 1. Suppression des images existantes non conservées
            if (isset($corps['images_conservees_ids'])) {
                $gardees = is_array($corps['images_conservees_ids'])
                    ? array_map('intval', $corps['images_conservees_ids'])
                    : array_map('intval', array_filter(explode(',', (string) $corps['images_conservees_ids']), 'is_numeric'));

                $imagesActuelles = $this->produits->listerImages($id);
                $totalActuelles = count($imagesActuelles);
                for ($k = 0; $k < $totalActuelles; $k++) {
                    $imgId = (int) $imagesActuelles[$k]['id'];
                    if (!in_array($imgId, $gardees, true)) {
                        $this->produits->supprimerImage($imgId, $id);
                    }
                }
            }

            // 2. Traitement d'images supplémentaires téléversées lors de la modification
            $fichiers = $requete->fichiers();
            $fichiersImages = !empty($fichiers['images']['name'])
                ? $fichiers['images']
                : (!empty($fichiers['image']['name']) ? $fichiers['image'] : null);

            $idsCrees = [];
            if ($fichiersImages !== null) {
                $idsCrees = $this->enregistrerFichiersImages($id, $fichiersImages);
            }

            // 3. Définition de l'image principale
            $indexNouvellePrinc = isset($corps['image_principale_index']) && is_numeric($corps['image_principale_index'])
                ? (int) $corps['image_principale_index']
                : -1;

            $idExistantePrinc = isset($corps['image_principale_id']) && is_numeric($corps['image_principale_id'])
                ? (int) $corps['image_principale_id']
                : 0;

            if ($indexNouvellePrinc >= 0 && isset($idsCrees[$indexNouvellePrinc])) {
                $this->produits->definirImagePrincipale($id, $idsCrees[$indexNouvellePrinc]);
            } elseif ($idExistantePrinc > 0) {
                $this->produits->definirImagePrincipale($id, $idExistantePrinc);
            } else {
                $this->produits->garantirImagePrincipale($id);
            }

            // 4. Traitement éventuel des options personnalisables
            if (isset($corps['options'])) {
                $optionsData = is_string($corps['options']) ? json_decode($corps['options'], true) : $corps['options'];
                if (is_array($optionsData)) {
                    $this->produits->synchroniserOptions($id, $optionsData);
                }
            }

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

        // Si un fichier est téléversé en multipart
        $fichiers = $requete->fichiers();
        if (!empty($fichiers['image']['name']) && ($fichiers['image']['error'] ?? 1) === UPLOAD_ERR_OK) {
            $dossierUpload = dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'produits';
            if (!is_dir($dossierUpload)) {
                mkdir($dossierUpload, 0755, true);
            }

            $nomSecurise = basename((string) $fichiers['image']['name']);
            $nomSecurise = preg_replace('/[^a-zA-Z0-9._-]/', '_', $nomSecurise) ?: ('image_' . time() . '.jpg');
            $tmpPath     = (string) $fichiers['image']['tmp_name'];

            if (move_uploaded_file($tmpPath, $dossierUpload . DIRECTORY_SEPARATOR . $nomSecurise)) {
                $url = $nomSecurise;
            }
        }

        if ($productId <= 0 || empty($url)) {
            Response::erreur('Identifiant de produit et URL ou fichier d\'image requis', 400);
        }

        try {
            $imageId = $this->produits->ajouterImage($productId, $url, $alt, $principale, $ordre);
            Response::json(['succes' => true, 'id' => $imageId, 'url' => $url, 'message' => 'Image ajoutée avec succès.'], 201);
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

    /**
     * Administration : Générer ou mettre à jour automatiquement les variantes d'un produit selon ses options.
     */
    /**
     * Administration : Lister les options personnalisables d'un produit.
     */
    public function listerOptions(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $productId = (int) ($requete->parametre('productId') ?? $requete->parametre('product_id') ?? 0);
        if ($productId <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        Response::json($this->produits->listerOptions($productId));
    }

    /**
     * Administration : Supprimer une option d'un produit.
     */
    public function supprimerOption(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $optionId = (int) ($corps['option_id'] ?? $corps['id'] ?? $requete->parametre('optionId') ?? $requete->parametre('id') ?? 0);
        $productId = (int) ($corps['product_id'] ?? $requete->parametre('productId') ?? $requete->parametre('product_id') ?? 0);

        if ($optionId <= 0 || $productId <= 0) {
            Response::erreur('Identifiants d\'option et de produit requis', 400);
        }

        try {
            $this->produits->supprimerOption($optionId, $productId);
            Response::json(['succes' => true, 'message' => 'Option supprimée avec succès.']);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la suppression de l\'option : ' . $e->getMessage(), 500);
        }
    }

    /**
     * Administration : Générer ou mettre à jour automatiquement les variantes d'un produit selon ses options.
     */
    public function genererVariantes(Request $requete): void
    {
        $this->verifierAccesAdmin();

        $corps = $requete->corps();
        $productId = (int) ($corps['product_id'] ?? $corps['id'] ?? $requete->parametre('product_id') ?? $requete->parametre('id') ?? 0);

        if ($productId <= 0) {
            Response::erreur('Identifiant de produit requis', 400);
        }

        try {
            $variantes = $this->produits->genererVariantesDepuisOptions($productId);
            Response::json([
                'succes'    => true,
                'message'   => 'Combinaisons de variantes générées avec succès.',
                'variantes' => $variantes,
            ]);
        } catch (Throwable $e) {
            Response::erreur('Erreur lors de la génération des variantes : ' . $e->getMessage(), 500);
        }
    }
}
