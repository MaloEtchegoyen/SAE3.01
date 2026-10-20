<?php

declare(strict_types=1);

namespace App\Controller;

use App\Core\Request;
use App\Core\Response;
use App\Model\UserModel;

/**
 * Connexion et déconnexion.
 *
 * L'identité et le rôle de l'utilisateur connecté sont rangés en session,
 * côté serveur. Le client ne détient que l'identifiant de session, dans le
 * cookie PHPSESSID.
 */
final class AuthController
{
    /** Modèle d'accès aux utilisateurs. */
    private UserModel $utilisateurs;

    public function __construct(UserModel $utilisateurs)
    {
        $this->utilisateurs = $utilisateurs;
    }

    /**
     * Inscription d'un nouvel utilisateur : POST /api/register
     *
     * @param Request $requete
     */
    public function register(Request $requete): void
    {
        $corps = $requete->corps();
        $email = trim((string) ($corps['email'] ?? $corps['login'] ?? ''));
        $mdp   = (string) ($corps['mdp'] ?? $corps['mot_de_passe'] ?? '');

        if ($email === '' || $mdp === '') {
            Response::erreur('L\'email et le mot de passe sont obligatoires.', 400);
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            Response::erreur('Format d\'adresse email invalide.', 400);
        }

        if (mb_strlen($email) > 50) {
            Response::erreur('L\'adresse email ne doit pas dépasser 50 caractères.', 400);
        }

        if (strlen($mdp) < 6) {
            Response::erreur('Le mot de passe doit comporter au moins 6 caractères.', 400);
        }

        $existant = $this->utilisateurs->trouverParLogin($email);
        if ($existant !== null) {
            Response::erreur('Un compte existe déjà avec cette adresse email.', 409);
        }

        $hash = password_hash($mdp, PASSWORD_DEFAULT);
        $id = $this->utilisateurs->creer($email, $hash, 'user');

        // Régénération de la session pour sécuriser la session à la création
        session_regenerate_id(true);

        $_SESSION['utilisateur'] = $email;
        $_SESSION['role']        = 'user';
        $_SESSION['id']          = $id;

        Response::json([
            'connecte'    => true,
            'utilisateur' => $email,
            'role'        => 'user',
            'message'     => 'Compte créé avec succès.',
        ], 201);
    }

    /**
     * Connexion : POST /api/login
     *
     * @param Request $requete
     */
    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $login = trim((string) ($corps['login'] ?? $corps['email'] ?? ''));
        $mdp   = (string) ($corps['mdp']   ?? $corps['mot_de_passe'] ?? '');

        if ($login === '' || $mdp === '') {
            Response::erreur('Identifiants invalides', 401);
        }

        $compte = $this->utilisateurs->trouverParLogin($login);

        if ($compte === null) {
            Response::erreur('Identifiants invalides', 401);
        }

        $mdpValide = password_verify($mdp, $compte['mot_de_passe']) || $compte['mot_de_passe'] === $mdp;

        if (!$mdpValide) {
            Response::erreur('Identifiants invalides', 401);
        }

        // Si le mot de passe stocké nécessite un rehachage (ex: mot de passe en clair initial)
        if (password_needs_rehash($compte['mot_de_passe'], PASSWORD_DEFAULT)) {
            $nouveauHash = password_hash($mdp, PASSWORD_DEFAULT);
            $this->utilisateurs->mettreAJourMotDePasse($compte['id'], $nouveauHash);
        }

        // L'utilisateur devient authentifié : on lui attribue un identifiant de
        // session neuf, et on détruit l'ancien (true). Aucun identifiant connu
        // avant ce point ne donne plus accès à la session.
        session_regenerate_id(true);

        $_SESSION['utilisateur'] = $compte['login'];
        $_SESSION['role']        = $compte['role'];
        $_SESSION['id']          = $compte['id'];

        Response::json([
            'connecte'    => true,
            'utilisateur' => $compte['login'],
            'role'        => $compte['role'],
        ]);
    }

    /**
     * Vérification de la session en cours : GET /api/me
     */
    public function me(): void
    {
        if (empty($_SESSION['utilisateur'])) {
            Response::json([
                'connecte'    => false,
                'utilisateur' => null,
                'role'        => null,
            ]);
            return;
        }

        Response::json([
            'connecte'    => true,
            'utilisateur' => (string) $_SESSION['utilisateur'],
            'role'        => (string) ($_SESSION['role'] ?? 'user'),
        ]);
    }

    /**
     * Déconnexion : POST /api/logout
     */
    public function logout(): void
    {
        $_SESSION = [];                               // vide la copie en mémoire

        // Supprime le cookie, avec le chemin sous lequel il a été posé : celui
        // que index.php a réglé avant session_start().
        setcookie(session_name(), '', [
            'expires' => time() - 3600,
            'path'    => session_get_cookie_params()['path'],
        ]);

        session_destroy();                            // efface le fichier serveur

        Response::json(['connecte' => false]);
    }
}

