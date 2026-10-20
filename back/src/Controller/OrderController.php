<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\OrderModel;
use Throwable;

/**
 * Contrôleur de traitement des commandes.
 */
final class OrderController
{
    private OrderModel $orders;

    public function __construct(OrderModel $orders)
    {
        $this->orders = $orders;
    }

    /**
     * Valide et crée une nouvelle commande : POST /api/orders
     *
     * @param Request $requete
     */
    public function creer(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || empty($_SESSION['id'])) {
            Response::erreur('Vous devez être connecté pour valider une commande.', 401);
            return;
        }

        $corps = $requete->corps();
        $articles = $corps['articles'] ?? null;

        if (!is_array($articles) || count($articles) === 0) {
            Response::erreur('Le panier ne contient aucun article.', 400);
            return;
        }

        $utilisateurId = (int) $_SESSION['id'];

        try {
            $commande = $this->orders->creerCommande($utilisateurId, $articles);
            Response::json($commande, 201);
        } catch (Throwable $e) {
            Response::erreur($e->getMessage(), 400);
        }
    }

    /**
     * Récupère le détail d'une commande par son numéro : GET /api/orders/detail
     *
     * @param Request $requete
     */
    public function detail(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || empty($_SESSION['id'])) {
            Response::erreur('Vous devez être connecté pour consulter une commande.', 401);
            return;
        }

        $numero = trim((string) ($requete->parametre('numero') ?? ''));
        if ($numero === '') {
            Response::erreur('Numéro de commande manquant.', 400);
            return;
        }

        $role = (string) ($_SESSION['role'] ?? 'user');
        $utilisateurId = $role === 'admin' ? null : (int) $_SESSION['id'];

        $commande = $this->orders->trouverParNumero($numero, $utilisateurId);

        if ($commande === null) {
            Response::erreur('Commande introuvable.', 404);
            return;
        }

        Response::json($commande);
    }
}

