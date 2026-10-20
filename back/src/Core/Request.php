<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Représente la requête HTTP entrante.
 *
 * Les cookies ne passent pas par cette classe : les contrôleurs lisent
 * $_COOKIE et appellent setcookie() directement.
 */
final class Request
{
    /** Méthode HTTP, en majuscules : GET, POST… */
    private string $methode;

    /** Chemin demandé, à partir de /api/. */
    private string $chemin;

    /** Paramètres de la chaîne de requête ($_GET). */
    private array $parametres;

    /** Corps de la requête, décodé depuis le JSON reçu ou issu de $_POST. */
    private array $corps;

    /** Fichiers téléversés reçus via $_FILES. */
    private array $fichiers;

    private function __construct(string $methode, string $chemin, array $parametres, array $corps, array $fichiers = [])
    {
        $this->methode    = $methode;
        $this->chemin     = $chemin;
        $this->parametres = $parametres;
        $this->corps      = $corps;
        $this->fichiers   = $fichiers;
    }

    /**
     * Construit la requête à partir des variables du serveur.
     */
    public static function depuisGlobals(): self
    {
        // Deux opérateurs voisins, à ne pas confondre :
        //   ?? se déclenche si la valeur de gauche n'existe pas (ou vaut null) ;
        //   ?: se déclenche si elle existe mais est « fausse » — ici parse_url()
        //      renvoie false quand l'URL est inexploitable.
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // L'application est déployée dans un sous-dossier, donc l'URL reçue
        // ressemble à /~votre_login/Base/api/films. On ne conserve que la partie
        // qui nous concerne, à partir du marqueur /api/.
        $position = strpos($uri, '/api/');
        $chemin   = $position === false ? '/' : substr($uri, $position);

        $corps = [];
        if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            $brut    = file_get_contents('php://input') ?: '';
            $decode  = json_decode($brut, true);
            if (is_array($decode)) {
                $corps = $decode;
            } elseif (!empty($_POST)) {
                $corps = $_POST;
            }
        }

        $methode = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($methode === 'POST') {
            if (!empty($_POST['_method'])) {
                $methode = strtoupper((string) $_POST['_method']);
            } elseif (!empty($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
                $methode = strtoupper((string) $_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
            }
        }

        return new self(
            $methode,
            $chemin,
            $_GET,
            $corps,
            $_FILES ?? [],
        );
    }

    /**
     * Retourne la méthode HTTP de la requête (GET, POST, etc.).
     */
    public function methode(): string
    {
        return $this->methode;
    }

    /**
     * Retourne le chemin normalisé de la requête relative à l'API.
     */
    public function chemin(): string
    {
        return $this->chemin;
    }

    /**
     * Un paramètre de la chaîne de requête (?page=2).
     */
    public function parametre(string $cle, ?string $defaut = null): ?string
    {
        $valeur = $this->parametres[$cle] ?? null;

        return is_string($valeur) ? $valeur : $defaut;
    }

    /**
     * Le corps JSON ou POST de la requête, décodé en tableau associatif.
     */
    public function corps(): array
    {
        return $this->corps;
    }

    /**
     * Les fichiers téléversés via $_FILES.
     *
     * @return array<string, mixed>
     */
    public function fichiers(): array
    {
        return $this->fichiers;
    }

    /**
     * Retourne les informations d'un fichier téléversé spécifique si présent.
     *
     * @param string $cle
     * @return array<string, mixed>|null
     */
    public function fichier(string $cle): ?array
    {
        return isset($this->fichiers[$cle]) && is_array($this->fichiers[$cle])
            ? $this->fichiers[$cle]
            : null;
    }

    /**
     * Identifiant de route, par exemple « GET /api/films ».
     */
    public function signature(): string
    {
        return $this->methode . ' ' . $this->chemin;
    }
}
