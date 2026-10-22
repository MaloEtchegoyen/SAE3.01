<?php

declare(strict_types=1);

namespace App\Model;

use PDO;
use Throwable;

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
        $this->initialiserColonnes();
    }

    /**
     * S'assure que les colonnes nom et email existent dans la table utilisateur.
     */
    private function initialiserColonnes(): void
    {
        try {
            $stmt = $this->pdo->query('SHOW COLUMNS FROM utilisateur');
            $colonnes = $stmt->fetchAll(PDO::FETCH_COLUMN);

            $aNom = false;
            $aEmail = false;
            for ($i = 0, $nb = count($colonnes); $i < $nb; $i++) {
                if ($colonnes[$i] === 'nom') {
                    $aNom = true;
                }
                if ($colonnes[$i] === 'email') {
                    $aEmail = true;
                }
            }

            if (!$aNom) {
                $this->pdo->exec('ALTER TABLE utilisateur ADD COLUMN nom VARCHAR(100) NULL AFTER login');
            }
            if (!$aEmail) {
                $this->pdo->exec('ALTER TABLE utilisateur ADD COLUMN email VARCHAR(100) NULL AFTER nom');
            }
        } catch (Throwable) {
            // Tolérance en cas de droits restreints ou si les colonnes existent déjà
        }
    }

    /**
     * Recherche un compte utilisateur par son identifiant numérique.
     *
     * @param int $id Identifiant unique.
     * @return array{id: int, login: string, nom: string, email: string, mot_de_passe: string, role: string}|null
     */
    public function trouverParId(int $id): ?array
    {
        $sql = 'SELECT id, login, nom, email, mot_de_passe, role
                  FROM utilisateur
                 WHERE id = :id
                 LIMIT 1';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['id' => $id]);
        $ligne = $stmt->fetch();

        if ($ligne === false) {
            return null;
        }

        $login = (string) $ligne['login'];
        $nom = !empty($ligne['nom']) ? (string) $ligne['nom'] : $login;
        $email = !empty($ligne['email']) ? (string) $ligne['email'] : (str_contains($login, '@') ? $login : '');

        return [
            'id'           => (int) $ligne['id'],
            'login'        => $login,
            'nom'          => $nom,
            'email'        => $email,
            'mot_de_passe' => (string) $ligne['mot_de_passe'],
            'role'         => (string) $ligne['role'],
        ];
    }

    /**
     * Recherche un compte utilisateur par son identifiant de connexion.
     *
     * @param string $login Identifiant saisi par l'utilisateur.
     * @return array{id: int, login: string, nom: string, email: string, mot_de_passe: string, role: string}|null
     */
    public function trouverParLogin(string $login): ?array
    {
        $sql = 'SELECT id, login, nom, email, mot_de_passe, role
                  FROM utilisateur
                 WHERE login = :login
                 LIMIT 1';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['login' => $login]);
        $ligne = $stmt->fetch();

        if ($ligne === false) {
            return null;
        }

        $loginVal = (string) $ligne['login'];
        $nom = !empty($ligne['nom']) ? (string) $ligne['nom'] : $loginVal;
        $email = !empty($ligne['email']) ? (string) $ligne['email'] : (str_contains($loginVal, '@') ? $loginVal : '');

        return [
            'id'           => (int) $ligne['id'],
            'login'        => $loginVal,
            'nom'          => $nom,
            'email'        => $email,
            'mot_de_passe' => (string) $ligne['mot_de_passe'],
            'role'         => (string) $ligne['role'],
        ];
    }

    /**
     * Vérifie si un email ou login est déjà attribué à un autre compte utilisateur.
     *
     * @param string $email Adresse email ou login à vérifier.
     * @param int $idExclu Identifiant de l'utilisateur en cours.
     * @return bool
     */
    public function emailExistePourAutre(string $email, int $idExclu): bool
    {
        $sql = 'SELECT COUNT(*)
                  FROM utilisateur
                 WHERE (email = :email OR login = :email)
                   AND id != :id';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'email' => $email,
            'id'    => $idExclu,
        ]);

        return ((int) $stmt->fetchColumn()) > 0;
    }

    /**
     * Met à jour les informations de profil (nom et email) d'un utilisateur.
     *
     * @param int $id Identifiant de l'utilisateur.
     * @param string $nom Nom ou dénomination de l'utilisateur.
     * @param string $email Adresse email.
     */
    public function mettreAJourProfil(int $id, string $nom, string $email): void
    {
        $sql = 'UPDATE utilisateur
                   SET nom = :nom,
                       email = :email
                 WHERE id = :id';

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'id'    => $id,
            'nom'   => $nom,
            'email' => $email,
        ]);
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
