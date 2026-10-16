<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux données des comptes utilisateurs.
 */
final class UserModel
{
    /** Connexion à la base de données. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Recherche un compte utilisateur par son identifiant de connexion.
     *
     * @param string $login Identifiant saisi par l'utilisateur.
     * @return array{id: int, login: string, mot_de_passe: string, role: string}|null
     */
    public function trouverParLogin(string $login): ?array
    {
        $sql = 'SELECT id, login, mot_de_passe, role
                  FROM utilisateur
                 WHERE login = :login
                 LIMIT 1';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['login' => $login]);
        $ligne = $stmt->fetch();

        if ($ligne === false) {
            return null;
        }

        return [
            'id'           => (int) $ligne['id'],
            'login'        => (string) $ligne['login'],
            'mot_de_passe' => (string) $ligne['mot_de_passe'],
            'role'         => (string) $ligne['role'],
        ];
    }
}

