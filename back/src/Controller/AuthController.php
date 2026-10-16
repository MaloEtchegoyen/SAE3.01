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

    public function login(Request $requete): void
    {
        $corps = $requete->corps();
        $login = trim((string) ($corps['login'] ?? ''));
        $mdp   = (string) ($corps['mdp']   ?? '');

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

        // L'utilisateur devient authentifié : on lui attribue un identifiant de
        // session neuf, et on détruit l'ancien (true). Aucun identifiant connu
        // avant ce point ne donne plus accès à la session.
        session_regenerate_id(true);

        $_SESSION['utilisateur'] = $compte['login'];
        $_SESSION['role']        = $compte['role'];

        Response::json(['connecte' => true, 'role' => $compte['role']]);
    }

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
