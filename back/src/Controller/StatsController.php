<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\OrderModel;
use App\Model\ProductModel;

/**
 * Statistiques d'administration, réservées aux administrateurs.
 */
final class StatsController
{
    /** Le modèle qui interroge la base pour les produits. */
    private ProductModel $produits;

    /** Le modèle qui interroge la base pour les commandes. */
    private ?OrderModel $commandes;

    public function __construct(ProductModel $produits, ?OrderModel $commandes = null)
    {
        $this->produits = $produits;
        $this->commandes = $commandes;
    }

    /**
     * Retourne les statistiques d'administration en JSON (réservé aux administrateurs).
     */
    public function index(): void
    {
        // La session est déjà ouverte par index.php.
        if (($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs', 403);
        }

        $stats = $this->produits->statistiques();
        $stats['totalCommandes'] = $this->commandes !== null ? $this->commandes->compterTotal() : 0;

        Response::json($stats);
    }
}
