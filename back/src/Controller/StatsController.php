<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\ProductModel;

/**
 * Statistiques du catalogue, réservées aux administrateurs.
 */
final class StatsController
{
    /** Le modèle qui interroge la base, fourni à la construction. */
    private ProductModel $produits;

    public function __construct(ProductModel $produits)
    {
        $this->produits = $produits;
    }

    public function index(): void
    {
        // La session est déjà ouverte par index.php.
        if (($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        Response::json($this->produits->statistiques());
    }
}
