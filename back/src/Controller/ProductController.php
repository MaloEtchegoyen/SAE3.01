<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\ProductModel;

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
     * Liste des produits en JSON pour les administrateurs.
     */
    public function index(): void
    {
        if (($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        Response::json($this->produits->lister());
    }
}

