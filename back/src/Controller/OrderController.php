<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\OrderModel;
use Throwable;

/**
 * Contrôleur de traitement et de gestion des commandes (client et administration).
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

    /**
     * Liste toutes les commandes des clients pour l'administration : GET /api/admin/orders
     *
     * @param Request $requete
     */
    public function listeAdmin(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || ($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs.', 403);
            return;
        }

        $tri = (string) ($requete->parametre('tri') ?? 'date_desc');
        $statut = $requete->parametre('statut');
        $date = $requete->parametre('date');
        $montant = $requete->parametre('montant');
        $page = (int) ($requete->parametre('page') ?? 1);
        $parPage = (int) ($requete->parametre('parPage') ?? 20);

        try {
            $resultat = $this->orders->listerToutesAdmin([
                'tri'     => $tri,
                'statut'  => $statut !== null && $statut !== '' ? (string) $statut : null,
                'date'    => $date !== null && $date !== '' ? (string) $date : null,
                'montant' => $montant !== null && $montant !== '' ? (float) $montant : null,
                'page'    => $page,
                'parPage' => $parPage,
            ]);
            Response::json($resultat);
        } catch (Throwable $e) {
            Response::erreur($e->getMessage(), 500);
        }
    }

    /**
     * Récupère le détail complet d'une commande avec son journal d'audit : GET /api/admin/orders/detail
     *
     * @param Request $requete
     */
    public function detailAdmin(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || ($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs.', 403);
            return;
        }

        $id = (int) ($requete->parametre('id') ?? 0);
        $numero = trim((string) ($requete->parametre('numero') ?? ''));

        if ($id <= 0 && $numero === '') {
            Response::erreur('Identifiant ou numéro de commande requis.', 400);
            return;
        }

        try {
            if ($id <= 0 && $numero !== '') {
                $cmd = $this->orders->trouverParNumero($numero);
                if ($cmd === null) {
                    Response::erreur('Commande introuvable.', 404);
                    return;
                }
                $id = (int) $cmd['id'];
            }

            $detail = $this->orders->trouverDetailComplet($id);
            if ($detail === null) {
                Response::erreur('Commande introuvable.', 404);
                return;
            }

            Response::json($detail);
        } catch (Throwable $e) {
            Response::erreur($e->getMessage(), 500);
        }
    }

    /**
     * Fait évoluer le statut d'une commande : PUT /api/admin/orders/statut
     *
     * @param Request $requete
     */
    public function modifierStatut(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || ($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs.', 403);
            return;
        }

        $corps = $requete->corps();
        $id = (int) ($corps['id'] ?? 0);
        $statut = trim((string) ($corps['statut'] ?? ''));
        $commentaire = !empty($corps['commentaire']) ? trim((string) $corps['commentaire']) : null;

        if ($id <= 0 || $statut === '') {
            Response::erreur('Identifiant et nouveau statut obligatoires.', 400);
            return;
        }

        $adminId = (int) $_SESSION['id'];

        try {
            $resultat = $this->orders->changerStatut($id, $statut, $adminId, $commentaire);
            Response::json($resultat);
        } catch (Throwable $e) {
            Response::erreur($e->getMessage(), 400);
        }
    }

    /**
     * Fait évoluer le statut de plusieurs commandes en lot : PUT /api/admin/orders/lot
     *
     * @param Request $requete
     */
    public function modifierStatutLot(Request $requete): void
    {
        if (empty($_SESSION['utilisateur']) || ($_SESSION['role'] ?? '') !== 'admin') {
            Response::erreur('Accès réservé aux administrateurs.', 403);
            return;
        }

        $corps = $requete->corps();
        $ids = $corps['ids'] ?? null;
        $statut = trim((string) ($corps['statut'] ?? ''));

        if (!is_array($ids) || count($ids) === 0 || $statut === '') {
            Response::erreur('Liste d\'identifiants et statut obligatoires.', 400);
            return;
        }

        $adminId = (int) $_SESSION['id'];

        try {
            $resultat = $this->orders->changerStatutLot($ids, $statut, $adminId);
            Response::json($resultat);
        } catch (Throwable $e) {
            Response::erreur($e->getMessage(), 400);
        }
    }
}
