<?php

declare(strict_types=1);

use App\Controller\AuthController;
use App\Controller\CatalogueController;
use App\Controller\OrderController;
use App\Controller\ProductController;
use App\Controller\StatsController;
use App\Controller\CategoryController;

/**
 * Table des routes de l'API.
 *
 * Clé    : méthode HTTP et chemin, séparés par un ou plusieurs espaces.
 * Valeur : [classe du contrôleur, méthode à appeler].
 *
 * Toute instance de contrôleur utilisée ici doit également être enregistrée
 * dans back/index.php.
 */

return [
    'GET  /api/films'          => [CatalogueController::class, 'index'],
    'POST /api/register'       => [AuthController::class,      'register'],
    'POST /api/login'          => [AuthController::class,      'login'],
    'POST /api/logout'         => [AuthController::class,      'logout'],
    'GET  /api/me'             => [AuthController::class,      'me'],
    'GET  /api/admin/stats'    => [StatsController::class,     'index'],

    // Commandes (Clients connectés)
    'POST /api/orders'         => [OrderController::class,     'creer'],
    'GET  /api/orders/detail'  => [OrderController::class,     'detail'],

    // Administration - Commandes (PIL-b)
    'GET  /api/admin/orders'        => [OrderController::class, 'listeAdmin'],
    'GET  /api/admin/orders/detail' => [OrderController::class, 'detailAdmin'],
    'PUT  /api/admin/orders/statut' => [OrderController::class, 'modifierStatut'],
    'PUT  /api/admin/orders/lot'    => [OrderController::class, 'modifierStatutLot'],

    // Catalogue public (accessible à tous)
    'GET    /api/products'                         => [ProductController::class, 'catalogue'],
    'GET    /api/categories'                       => [CategoryController::class, 'publicCatalogue'],
    'GET    /api/products/detail'                  => [ProductController::class, 'catalogueDetail'],
    'GET    /api/products/image'                   => [ProductController::class, 'servirImage'],

    // Administration - Produits
    'GET    /api/admin/products'                   => [ProductController::class, 'index'],
    'GET    /api/admin/categories'                 => [CategoryController::class, 'index'],
    'POST   /api/admin/categories'                 => [CategoryController::class, 'creer'],
    'PUT    /api/admin/categories'                 => [CategoryController::class, 'modifier'],
    'DELETE /api/admin/categories'                 => [CategoryController::class, 'supprimer'],
    'GET    /api/admin/products/detail'            => [ProductController::class, 'detail'],
    'POST   /api/admin/products'                   => [ProductController::class, 'creer'],
    'POST   /api/admin/products/modifier'          => [ProductController::class, 'modifier'],
    'PUT    /api/admin/products/modifier'          => [ProductController::class, 'modifier'],
    'PUT    /api/admin/products'                   => [ProductController::class, 'modifier'],
    'DELETE /api/admin/products'                   => [ProductController::class, 'supprimer'],

    // Administration - Prix, Stocks et Alertes
    'PUT    /api/admin/products/stock-prix'        => [ProductController::class, 'fixerPrixEtStock'],
    'PUT    /api/admin/products/seuil-alerte'      => [ProductController::class, 'modifierSeuilAlerte'],
    'GET    /api/admin/products/alertes'           => [ProductController::class, 'alertesStock'],

    // Administration - Images
    'GET    /api/admin/products/images'            => [ProductController::class, 'listerImages'],
    'POST   /api/admin/products/images'            => [ProductController::class, 'ajouterImage'],
    'PUT    /api/admin/products/images/principale' => [ProductController::class, 'definirImagePrincipale'],
    'DELETE /api/admin/products/images'            => [ProductController::class, 'supprimerImage'],

    // Administration - Options & Variantes
    'GET    /api/admin/products/options'           => [ProductController::class, 'listerOptions'],
    'DELETE /api/admin/products/options'           => [ProductController::class, 'supprimerOption'],
    'GET    /api/admin/products/variantes'         => [ProductController::class, 'listerVariantes'],
    'POST   /api/admin/products/variantes'         => [ProductController::class, 'ajouterVariante'],
    'PUT    /api/admin/products/variantes'         => [ProductController::class, 'modifierVariante'],
    'DELETE /api/admin/products/variantes'         => [ProductController::class, 'supprimerVariante'],
];
