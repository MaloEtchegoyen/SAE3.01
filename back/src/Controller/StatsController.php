<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Response;
use App\Model\StatsModel;

/**
 * Statistiques d'administration (PIL-a), réservées aux administrateurs.
 */
final class StatsController
{
    private StatsModel $stats;

    public function __construct(StatsModel $stats)
    {
        $this->stats = $stats;
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

        // Empêche toute mise en cache navigateur pour garantir des données en direct
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');

        $donnees = $this->stats->obtenirTableauDeBord();

        Response::json($donnees);
    }
}
