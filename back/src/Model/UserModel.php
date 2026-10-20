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

    /**
     * Crée un nouveau compte utilisateur.
     *
     * @param string $login Identifiant ou adresse email.
     * @param string $motDePasseHache Mot de passe déjà haché en bcrypt.
     * @param string $role Rôle de l'utilisateur (défaut: 'user').
     * @return int Identifiant généré de l'utilisateur.
     */
    public function creer(string $login, string $motDePasseHache, string $role = 'user'): int
    {
        $sql = 'INSERT INTO utilisateur (login, mot_de_passe, role)
                VALUES (:login, :mot_de_passe, :role)';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'login'        => $login,
            'mot_de_passe' => $motDePasseHache,
            'role'         => $role,
        ]);

        return (int) $this->pdo->lastInsertId();
    }

    /**
     * Met à jour le mot de passe d'un utilisateur (ex: rehachage de mot de passe).
     *
     * @param int $id Identifiant de l'utilisateur.
     * @param string $nouveauHash Nouveau mot de passe haché.
     */
    public function mettreAJourMotDePasse(int $id, string $nouveauHash): void
    {
        $sql = 'UPDATE utilisateur
                   SET mot_de_passe = :mot_de_passe
                 WHERE id = :id';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id'           => $id,
            'mot_de_passe' => $nouveauHash,
        ]);
    }
}


