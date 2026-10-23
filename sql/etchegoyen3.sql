-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Hôte : localhost
-- Généré le : ven. 23 oct. 2026 à 17:04
-- Version du serveur : 11.8.6-MariaDB-0+deb13u1 from Debian
-- Version de PHP : 8.4.27

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `etchegoyen3`
--

-- --------------------------------------------------------

--
-- Structure de la table `category`
--

CREATE TABLE `category` (
  `id` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `description` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `category`
--

INSERT INTO `category` (`id`, `nom`, `description`) VALUES
(2, 'boissons froides', NULL),
(3, 'pâtisseries', NULL),
(4, 'boissons chaudes', NULL);

-- --------------------------------------------------------

--
-- Structure de la table `commande`
--

CREATE TABLE `commande` (
  `id` int(10) UNSIGNED NOT NULL,
  `numero_commande` varchar(32) NOT NULL,
  `utilisateur_id` int(10) UNSIGNED NOT NULL,
  `statut` varchar(30) NOT NULL DEFAULT 'en cours',
  `total` decimal(10,2) NOT NULL,
  `date_commande` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `commande`
--

INSERT INTO `commande` (`id`, `numero_commande`, `utilisateur_id`, `statut`, `total`, `date_commande`) VALUES
(1, 'CMD-20261020-0360CA', 3, 'retirée', '29.97', '2026-10-20 10:43:51'),
(2, 'CMD-20261022-3CF39E', 3, 'retirée', '4.50', '2026-10-22 16:13:17');

-- --------------------------------------------------------

--
-- Structure de la table `journal_commande`
--

CREATE TABLE `journal_commande` (
  `id` int(10) UNSIGNED NOT NULL,
  `commande_id` int(10) UNSIGNED NOT NULL,
  `utilisateur_id` int(10) UNSIGNED NOT NULL,
  `ancien_statut` varchar(30) NOT NULL,
  `nouveau_statut` varchar(30) NOT NULL,
  `action` varchar(50) NOT NULL,
  `commentaire` text DEFAULT NULL,
  `date_action` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `journal_commande`
--

INSERT INTO `journal_commande` (`id`, `commande_id`, `utilisateur_id`, `ancien_statut`, `nouveau_statut`, `action`, `commentaire`, `date_action`) VALUES
(1, 1, 2, 'en cours', 'disponible', 'action_lot_disponible', 'Action groupée', '2026-10-20 15:47:53'),
(2, 1, 2, 'disponible', 'annulée', 'action_lot_annulée', 'Action groupée', '2026-10-20 15:48:24'),
(3, 1, 2, 'disponible', 'retirée', 'changement_statut', NULL, '2026-10-21 09:02:35'),
(4, 2, 2, 'en cours', 'retirée', 'changement_statut', NULL, '2026-10-23 15:24:04');

-- --------------------------------------------------------

--
-- Structure de la table `ligne_commande`
--

CREATE TABLE `ligne_commande` (
  `id` int(10) UNSIGNED NOT NULL,
  `commande_id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant_id` int(10) UNSIGNED DEFAULT NULL,
  `nom_produit` varchar(255) NOT NULL,
  `nom_variante` varchar(150) DEFAULT NULL,
  `quantite` int(11) NOT NULL,
  `prix_unitaire` decimal(10,2) NOT NULL,
  `total_ligne` decimal(10,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `ligne_commande`
--

INSERT INTO `ligne_commande` (`id`, `commande_id`, `product_id`, `variant_id`, `nom_produit`, `nom_variante`, `quantite`, `prix_unitaire`, `total_ligne`) VALUES
(1, 1, 26, NULL, 'test', NULL, 3, '9.99', '29.97'),
(2, 2, 2, 1, 'Chaï latte', 'Moyen (35 cl), Lait entier', 1, '4.50', '4.50');

-- --------------------------------------------------------

--
-- Structure de la table `product`
--

CREATE TABLE `product` (
  `id` int(11) NOT NULL,
  `nom` varchar(255) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `prix` decimal(10,2) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `seuil_alerte` int(11) NOT NULL DEFAULT 5,
  `description` text DEFAULT NULL,
  `actif` tinyint(1) NOT NULL DEFAULT 1,
  `date_modification` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product`
--

INSERT INTO `product` (`id`, `nom`, `category_id`, `prix`, `stock`, `seuil_alerte`, `description`, `actif`, `date_modification`) VALUES
(1, 'Café noisette', 4, '2.50', 50, 10, 'Café noisette', 1, '2026-10-21 15:29:56'),
(2, 'Chaï latte', 4, '4.50', 29, 5, 'Chaï latte chaud', 1, '2026-10-21 15:30:28'),
(3, 'Chocolat chaud maison', 4, '4.00', 0, 10, 'Chocolat chaud fait maison', 1, '2026-10-21 15:30:18'),
(4, 'Latte macchiato', 4, '3.80', 35, 10, 'Latte macchiato classique', 1, '2026-10-21 15:30:05'),
(5, 'Oranges pressées', 2, '4.50', 2, 5, 'Jus d\'oranges pressées minute', 1, '2026-10-17 13:27:11'),
(6, 'Milkshake', 2, '5.00', 15, 5, 'Milkshake gourmand', 1, NULL),
(7, 'Thés glacés', 2, '3.50', 30, 10, 'Thé glacé maison', 1, NULL),
(8, 'Citronnade maison', 2, '3.50', 25, 10, 'Citronnade fraîche maison', 1, NULL),
(9, 'Flan vanille', 3, '3.50', 12, 3, 'Flan à la vanille de Madagascar', 1, NULL),
(10, 'Eclair chocoloat', 3, '3.00', 15, 4, 'Éclair au chocolat traditionnel', 1, NULL),
(11, 'Riz au lait', 3, '4.00', 10, 2, 'Riz au lait onctueux', 1, NULL),
(12, 'Mousse au chocolat', 3, '4.50', 14, 4, 'Mousse au chocolat noir', 1, NULL),
(26, 'test', NULL, '9.99', 99, 5, 'produit test', 1, '2026-10-21 11:14:14');

-- --------------------------------------------------------

--
-- Structure de la table `product_image`
--

CREATE TABLE `product_image` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL,
  `url` varchar(255) NOT NULL,
  `alt` varchar(255) DEFAULT NULL,
  `est_principale` tinyint(1) NOT NULL DEFAULT 0,
  `ordre` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_image`
--

INSERT INTO `product_image` (`id`, `product_id`, `url`, `alt`, `est_principale`, `ordre`) VALUES
(18, 26, 'eclair.jpg', NULL, 0, 0),
(19, 26, 'riz.jpg', NULL, 0, 1),
(20, 26, 'milkshake.jpg', NULL, 1, 0),
(21, 26, 'citronnade.jpg', NULL, 0, 0),
(22, 1, 'cafeNoisettes.jpg', NULL, 1, 0),
(23, 2, 'chaiLatte.jpg', NULL, 1, 0),
(24, 3, 'chocolatChaud.jpg', NULL, 1, 0);

-- --------------------------------------------------------

--
-- Structure de la table `product_option`
--

CREATE TABLE `product_option` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL,
  `nom` varchar(100) NOT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'radio',
  `obligatoire` tinyint(1) NOT NULL DEFAULT 1,
  `ordre` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_option`
--

INSERT INTO `product_option` (`id`, `product_id`, `nom`, `type`, `obligatoire`, `ordre`) VALUES
(1, 1, 'Taille', 'radio', 1, 0),
(2, 1, 'Type de lait', 'radio', 1, 1),
(3, 1, 'Sirop gourmand', 'radio', 0, 2),
(4, 2, 'Taille', 'radio', 1, 0),
(5, 2, 'Type de lait', 'radio', 1, 1),
(6, 6, 'Parfum', 'radio', 1, 0),
(7, 6, 'Chantilly', 'radio', 1, 1),
(8, 8, 'Taille', 'radio', 1, 0),
(9, 8, 'Touche de fraîcheur', 'radio', 1, 1);

-- --------------------------------------------------------

--
-- Structure de la table `product_option_value`
--

CREATE TABLE `product_option_value` (
  `id` int(10) UNSIGNED NOT NULL,
  `option_id` int(10) UNSIGNED NOT NULL,
  `nom` varchar(150) NOT NULL,
  `surcout` decimal(10,2) NOT NULL DEFAULT 0.00,
  `ordre` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_option_value`
--

INSERT INTO `product_option_value` (`id`, `option_id`, `nom`, `surcout`, `ordre`) VALUES
(1, 1, 'Simple (Tasse)', '0.00', 0),
(2, 1, 'Double (+0,60 €)', '0.60', 1),
(3, 2, 'Lait entier de vache', '0.00', 0),
(4, 2, 'Lait d\'avoine bio', '0.50', 1),
(5, 2, 'Lait d\'amande', '0.50', 2),
(6, 3, 'Sans sirop', '0.00', 0),
(7, 3, 'Sirop Vanille de Madagascar', '0.50', 1),
(8, 3, 'Sirop Caramel au beurre salé', '0.50', 2),
(9, 3, 'Sirop Noisette grillée', '0.50', 3),
(10, 4, 'Moyen (35 cl)', '0.00', 0),
(11, 4, 'Grand (50 cl)', '0.90', 1),
(12, 5, 'Lait entier', '0.00', 0),
(13, 5, 'Lait d\'avoine', '0.50', 1),
(14, 5, 'Lait de soja', '0.50', 2),
(15, 6, 'Vanille Bourbon', '0.00', 0),
(16, 6, 'Chocolat intense', '0.00', 1),
(17, 6, 'Fraise mara des bois', '0.00', 2),
(18, 6, 'Caramel beurre salé', '0.50', 3),
(19, 7, 'Sans chantilly', '0.00', 0),
(20, 7, 'Avec chantilly maison', '0.60', 1),
(21, 8, 'Verre (33 cl)', '0.00', 0),
(22, 8, 'Bouteille fraîcheur (50 cl)', '1.20', 1),
(23, 9, 'Classique nature', '0.00', 0),
(24, 9, 'Feuilles de menthe fraîche', '0.40', 1),
(25, 9, 'Gingembre pressé', '0.50', 2);

-- --------------------------------------------------------

--
-- Structure de la table `product_variant`
--

CREATE TABLE `product_variant` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL,
  `nom` varchar(150) NOT NULL,
  `prix` decimal(10,2) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `seuil_alerte` int(11) NOT NULL DEFAULT 5,
  `actif` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_variant`
--

INSERT INTO `product_variant` (`id`, `product_id`, `nom`, `prix`, `stock`, `seuil_alerte`, `actif`) VALUES
(1, 2, 'Moyen (35 cl), Lait entier', '4.50', 14, 5, 1),
(2, 2, 'Moyen (35 cl), Lait d\'avoine', '5.00', 8, 5, 1),
(3, 2, 'Moyen (35 cl), Lait de soja', '5.00', 0, 5, 1),
(4, 2, 'Grand (50 cl), Lait entier', '5.40', 4, 5, 1),
(5, 2, 'Grand (50 cl), Lait d\'avoine', '5.90', 2, 5, 1),
(6, 2, 'Grand (50 cl), Lait de soja', '5.90', 0, 5, 1),
(7, 8, 'Verre (33 cl), Classique nature', '3.50', 12, 5, 1),
(8, 8, 'Verre (33 cl), Feuilles de menthe fraîche', '3.90', 10, 5, 1),
(9, 8, 'Verre (33 cl), Gingembre pressé', '4.00', 0, 5, 1),
(10, 8, 'Bouteille fraîcheur (50 cl), Classique nature', '4.70', 8, 5, 1),
(11, 8, 'Bouteille fraîcheur (50 cl), Feuilles de menthe fraîche', '5.10', 3, 5, 1),
(12, 6, 'Vanille Bourbon, Sans chantilly', '5.00', 10, 5, 1),
(13, 6, 'Vanille Bourbon, Avec chantilly maison', '5.60', 4, 5, 1),
(14, 6, 'Chocolat intense, Sans chantilly', '5.00', 6, 5, 1),
(15, 6, 'Chocolat intense, Avec chantilly maison', '5.60', 0, 5, 1),
(16, 6, 'Fraise mara des bois, Sans chantilly', '5.00', 5, 5, 1),
(17, 6, 'Fraise mara des bois, Avec chantilly maison', '5.60', 2, 5, 1),
(18, 6, 'Caramel beurre salé, Sans chantilly', '5.50', 0, 5, 1),
(19, 6, 'Caramel beurre salé, Avec chantilly maison', '6.10', 3, 5, 1),
(20, 1, 'Simple (Tasse), Lait entier, Sans sirop', '2.50', 25, 5, 1),
(21, 1, 'Simple (Tasse), Lait d\'avoine bio, Sans sirop', '3.00', 10, 5, 1),
(22, 1, 'Simple (Tasse), Lait d\'amande, Sans sirop', '3.00', 6, 5, 1),
(23, 1, 'Simple (Tasse), Lait entier, Sirop Vanille', '3.00', 8, 5, 1),
(24, 1, 'Simple (Tasse), Lait entier, Sirop Caramel', '3.00', 3, 5, 1),
(25, 1, 'Simple (Tasse), Lait entier, Sirop Noisette', '3.00', 0, 5, 1),
(26, 1, 'Double, Lait entier, Sans sirop', '3.10', 15, 5, 1),
(27, 1, 'Double, Lait d\'avoine bio, Sans sirop', '3.60', 4, 5, 1),
(28, 1, 'Double, Lait d\'amande, Sans sirop', '3.60', 0, 5, 1),
(29, 1, 'Double, Lait entier, Sirop Caramel', '3.60', 2, 5, 1);

-- --------------------------------------------------------

--
-- Structure de la table `product_variant_value`
--

CREATE TABLE `product_variant_value` (
  `variant_id` int(10) UNSIGNED NOT NULL,
  `option_value_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `product_variant_value`
--

INSERT INTO `product_variant_value` (`variant_id`, `option_value_id`) VALUES
(20, 1),
(21, 1),
(22, 1),
(23, 1),
(24, 1),
(25, 1),
(26, 2),
(27, 2),
(28, 2),
(29, 2),
(20, 3),
(23, 3),
(24, 3),
(25, 3),
(26, 3),
(29, 3),
(21, 4),
(27, 4),
(22, 5),
(28, 5),
(20, 6),
(21, 6),
(22, 6),
(26, 6),
(27, 6),
(28, 6),
(23, 7),
(24, 8),
(29, 8),
(25, 9),
(1, 10),
(2, 10),
(3, 10),
(4, 11),
(5, 11),
(6, 11),
(1, 12),
(4, 12),
(2, 13),
(5, 13),
(3, 14),
(6, 14),
(12, 15),
(13, 15),
(14, 16),
(15, 16),
(16, 17),
(17, 17),
(18, 18),
(19, 18),
(12, 19),
(14, 19),
(16, 19),
(18, 19),
(13, 20),
(15, 20),
(17, 20),
(19, 20),
(7, 21),
(8, 21),
(9, 21),
(10, 22),
(11, 22),
(7, 23),
(10, 23),
(8, 24),
(11, 24),
(9, 25);

-- --------------------------------------------------------

--
-- Structure de la table `stock_movement`
--

CREATE TABLE `stock_movement` (
  `id` int(10) UNSIGNED NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant_id` int(11) DEFAULT NULL,
  `quantite` int(11) NOT NULL,
  `motif` varchar(100) NOT NULL,
  `date_mouvement` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `stock_movement`
--

INSERT INTO `stock_movement` (`id`, `product_id`, `variant_id`, `quantite`, `motif`, `date_mouvement`) VALUES
(7, 26, NULL, -3, 'commande CMD-20261020-0360CA', '2026-10-20 10:43:51'),
(8, 26, NULL, 3, 'annulation commande CMD-20261020-0360CA', '2026-10-20 15:48:24'),
(9, 2, 1, -1, 'commande CMD-20261022-3CF39E', '2026-10-22 16:13:17');

-- --------------------------------------------------------

--
-- Structure de la table `utilisateur`
--

CREATE TABLE `utilisateur` (
  `id` int(10) UNSIGNED NOT NULL,
  `login` varchar(50) NOT NULL,
  `nom` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `mot_de_passe` varchar(255) NOT NULL,
  `role` varchar(20) NOT NULL DEFAULT 'user'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Déchargement des données de la table `utilisateur`
--

INSERT INTO `utilisateur` (`id`, `login`, `nom`, `email`, `mot_de_passe`, `role`) VALUES
(1, 'alice', NULL, NULL, '$2y$12$ygYv/U0OwHsC.tUWu0LeNuaKglFseVSmN0ifUjVlatha4Rbou5nAS', 'user'),
(2, 'admin', NULL, NULL, '$2y$12$f6Ok/iMYoyNyyFHPzhvtOuAWUI/WQWu5pn0gGU7NlXGU66wMmHMsq', 'admin'),
(3, 'malo.etchegoyen@gmail.com', NULL, NULL, '$2y$12$.s2Wq3rsLGd4Q5I/rdqU/erQ9puI9Y30Uz3IVL9LVeDDwPgHlm5iC', 'user');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `category`
--
ALTER TABLE `category`
  ADD PRIMARY KEY (`id`);

--
-- Index pour la table `commande`
--
ALTER TABLE `commande`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_commande_numero` (`numero_commande`),
  ADD KEY `fk_commande_utilisateur` (`utilisateur_id`),
  ADD KEY `idx_commande_date` (`date_commande`);

--
-- Index pour la table `journal_commande`
--
ALTER TABLE `journal_commande`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_journal_commande_commande` (`commande_id`),
  ADD KEY `fk_journal_commande_utilisateur` (`utilisateur_id`),
  ADD KEY `idx_journal_date` (`date_action`);

--
-- Index pour la table `ligne_commande`
--
ALTER TABLE `ligne_commande`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_ligne_commande_commande` (`commande_id`),
  ADD KEY `fk_ligne_commande_produit` (`product_id`),
  ADD KEY `fk_ligne_commande_variant` (`variant_id`);

--
-- Index pour la table `product`
--
ALTER TABLE `product`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Index pour la table `product_image`
--
ALTER TABLE `product_image`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_product_image_product` (`product_id`);

--
-- Index pour la table `product_option`
--
ALTER TABLE `product_option`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_product_option_product` (`product_id`);

--
-- Index pour la table `product_option_value`
--
ALTER TABLE `product_option_value`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_product_option_value_option` (`option_id`);

--
-- Index pour la table `product_variant`
--
ALTER TABLE `product_variant`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_product_variant_product` (`product_id`);

--
-- Index pour la table `product_variant_value`
--
ALTER TABLE `product_variant_value`
  ADD PRIMARY KEY (`variant_id`,`option_value_id`),
  ADD KEY `fk_pvv_option_value` (`option_value_id`);

--
-- Index pour la table `stock_movement`
--
ALTER TABLE `stock_movement`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stock_movement_product` (`product_id`);

--
-- Index pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_utilisateur_login` (`login`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `category`
--
ALTER TABLE `category`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `commande`
--
ALTER TABLE `commande`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `journal_commande`
--
ALTER TABLE `journal_commande`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT pour la table `ligne_commande`
--
ALTER TABLE `ligne_commande`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `product`
--
ALTER TABLE `product`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT pour la table `product_image`
--
ALTER TABLE `product_image`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT pour la table `product_option`
--
ALTER TABLE `product_option`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT pour la table `product_option_value`
--
ALTER TABLE `product_option_value`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT pour la table `product_variant`
--
ALTER TABLE `product_variant`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT pour la table `stock_movement`
--
ALTER TABLE `stock_movement`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT pour la table `utilisateur`
--
ALTER TABLE `utilisateur`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `commande`
--
ALTER TABLE `commande`
  ADD CONSTRAINT `fk_commande_utilisateur` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `journal_commande`
--
ALTER TABLE `journal_commande`
  ADD CONSTRAINT `fk_journal_commande_commande` FOREIGN KEY (`commande_id`) REFERENCES `commande` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_journal_commande_utilisateur` FOREIGN KEY (`utilisateur_id`) REFERENCES `utilisateur` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `ligne_commande`
--
ALTER TABLE `ligne_commande`
  ADD CONSTRAINT `fk_ligne_commande_commande` FOREIGN KEY (`commande_id`) REFERENCES `commande` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ligne_commande_produit` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`),
  ADD CONSTRAINT `fk_ligne_commande_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `product`
--
ALTER TABLE `product`
  ADD CONSTRAINT `product_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `category` (`id`);

--
-- Contraintes pour la table `product_image`
--
ALTER TABLE `product_image`
  ADD CONSTRAINT `fk_product_image_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_option`
--
ALTER TABLE `product_option`
  ADD CONSTRAINT `fk_product_option_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_option_value`
--
ALTER TABLE `product_option_value`
  ADD CONSTRAINT `fk_product_option_value_option` FOREIGN KEY (`option_id`) REFERENCES `product_option` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_variant`
--
ALTER TABLE `product_variant`
  ADD CONSTRAINT `fk_product_variant_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `product_variant_value`
--
ALTER TABLE `product_variant_value`
  ADD CONSTRAINT `fk_pvv_option_value` FOREIGN KEY (`option_value_id`) REFERENCES `product_option_value` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_pvv_variant` FOREIGN KEY (`variant_id`) REFERENCES `product_variant` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `stock_movement`
--
ALTER TABLE `stock_movement`
  ADD CONSTRAINT `fk_stock_movement_product` FOREIGN KEY (`product_id`) REFERENCES `product` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
