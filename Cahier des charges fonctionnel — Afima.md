# CAHIER DES CHARGES FONCTIONNEL — AFIMA

## 1. Objectif du projet

Afima est une plateforme marketplace sécurisée permettant aux utilisateurs d'acheter et de vendre des produits en ligne.

**Composantes principales :**
- Marketplace dynamique
- Paiement sécurisé avec escrow
- Portefeuille électronique
- Système de livraison configurable
- Retours et remboursements
- Vérification d'identité des vendeurs
- Messagerie contextuelle
- Assistants IA spécialisés
- Création de boutiques en ligne personnalisées
- Éditeur No-Code pour boutiques
- Agent Coding pour personnalisation
2. Types d'utilisateurs
Acheteur
Rechercher des produits
Consulter les fiches produits
Contacter un vendeur
Acheter
Suivre une commande
Confirmer la réception
Demander un retour/remboursement
Consulter son portefeuille
Vendeur
Ajouter des produits
Configurer la livraison
Recevoir des commandes
Expédier les commandes
Recevoir les paiements
Gérer son stock
Communiquer avec les acheteurs
Consulter ses statistiques
Administrateur
Gérer les utilisateurs
Vérifier les vendeurs
Gérer les litiges
Surveiller les transactions
Gérer les produits signalés
Gérer les retraits
Administrer les boutiques
Superviser le système IA
3. Gestion des produits

Lorsqu'un vendeur ajoute un produit, il doit renseigner :

Nom
Photos
Description
Prix
Quantité
Catégorie
État du produit
Localisation
Options/variantes si nécessaire
Livraison (voir section 3.1)

### 3.1 Configuration de livraison (IMPORTANT)

Le vendeur doit configurer complètement le mode de livraison pour chaque produit.

**Mode de livraison :**
- Livraison à domicile
- Livraison en point relais
- Livraison par transporteur
- Livraison par le vendeur
- Retrait chez le vendeur
- Livraison personnalisée

**Zone de livraison :**
- Même ville
- Même région
- Tout le pays
- Pays sélectionnés

**Tarification :**
- Gratuit
- Prix fixe
- Prix selon distance
- Prix selon poids
- Prix selon zone

**Délais :**
- 24 h
- 48 h
- 3-5 jours
- Personnalisé

**Informations supplémentaires :**
- Conditions de livraison
- Horaires de livraison
- Instructions particulières
- Possibilité de retrait sur place

**Important :** Ce système doit permettre à la plateforme de calculer automatiquement le coût total AVANT le paiement.
4. Fiche produit détaillée

Chaque produit doit avoir une page complète contenant :

**Informations principales :**
- Photos/vidéos du produit
- Nom du produit
- Prix
- Quantité disponible
- Description détaillée
- État : neuf/occasion
- Localisation approximative du vendeur

**Informations du vendeur :**
- Profil du vendeur
- Note/réputation (★★★★★)
- Nombre de ventes
- Statut de vérification (✓ Identité vérifiée)

**Options de paiement et livraison :**
- Moyens de paiement disponibles
- Moyens de livraison configurés
- Frais de livraison
- Délai estimé de livraison
- Politique de retour/remboursement

**Boutons d'action :**
- Acheter
- Ajouter au panier
- Contacter vendeur (chat contextuel)
- Signaler produit

5. Messagerie et contact

Lorsqu'un acheteur clique sur « Contacter », le système doit :
- Ouvrir une conversation directe avec le vendeur
- Lier automatiquement la conversation au produit concerné
- Pré-remplir un message de contexte si l'utilisateur le souhaite

**Exemple :**
L'acheteur clique « Contacter » sur un iPhone 13.
Le système crée une conversation pré-contextualisée :
« Bonjour, je suis intéressé par votre iPhone 13. Est-il toujours disponible ? »

**Fonctionnalités du système de messagerie :**
- Messages instantanés
- Notifications
- Historique des conversations
- Signalement d'un message ou d'un utilisateur
- Possibilité de joindre des fichiers/photos
6. Système de commandes et flux de paiement sécurisé

### 6.1 Machine à états de la commande

```
Commande créée
      ↓
Paiement sécurisé (argent bloqué en escrow)
      ↓
Paiement confirmé + Vendeur notifié
      ↓
Commande préparée
      ↓
Expédiée
      ↓
En transit
      ↓
Livrée
      ↓
Confirmation acheteur OU Timeout automatique
      ↓
Argent transféré au portefeuille vendeur
      ↓
Commande terminée
```

### 6.2 Principes du paiement sécurisé

**Flux correct :**
- Acheteur → **Plateforme (Escrow)** → Vendeur

**PAS DIRECT :**
- Acheteur → Vendeur ❌

**Processus détaillé :**

1. **Acheteur paie** : L'argent est versé à la plateforme
2. **Blocage en escrow** : Les fonds sont placés en "solde sécurisé" (pending_balance)
3. **Vendeur notifié** : "Paiement confirmé. Préparez votre commande"
4. **Vendeur expédie**
5. **Acheteur reçoit**
6. **Acheteur confirme** : Clique "Colis reçu"
7. **Libération des fonds** : Commission plateforme déduite (ex: 5%) → reste versé au portefeuille disponible du vendeur

### 6.3 Transfert automatique après timeout

**Important :** La validation automatique intervient 10 jours après la LIVRAISON, pas après l'achat.

- J+0 : Paiement
- J+X : Colis livré
- J+10 après livraison : Libération automatique (sauf litige actif)

7. Gestion des litiges et retours

Le système doit prévoir plusieurs états problématiques pour une commande.

7. Gestion des litiges et retours

### 7.1 Centre de litiges

L'acheteur peut signaler un problème via le bouton « Signaler un problème ».

**Motifs possibles :**
- Colis non reçu
- Mauvais produit
- Produit endommagé
- Produit différent de l'annonce
- Produit incomplet
- Autre problème

**Éléments de preuve :**
- Photos
- Vidéos
- Commentaire détaillé
- Documents additionnels

### 7.2 Processus de litige

1. **Acheteur ouvre un litige** → Transaction passe en litige
2. **Blocage du paiement** → L'argent en escrow reste gelé
3. **Transfert automatique suspendu** → Le timer de 10 jours s'arrête
4. **Vendeur peut répondre/contester**
5. **Plateforme (admin) examine et décide**

### 7.3 Résolutions possibles

- **Remboursement intégral** : Acheteur remboursé, vendeur ne reçoit rien
- **Remboursement partiel** : Compensation aux deux parties
- **Retour obligatoire** : Acheteur renvoie le produit, remboursement après réception
- **Remplacement du produit** : Vendeur envoie un nouveau produit
- **Paiement au vendeur** : Le litige est rejeté, argent versé normalement

### 7.4 Système de retour simplifié

Pour les retours standards (acceptés par le vendeur) :
- L'acheteur demande un retour
- Le vendeur peut **accepter** ou **contester**
- Si accepté : acheteur renvoie le produit et reçoit un remboursement
- La plateforme intervient en cas de désaccord
8. Vérification d'identité et profil vendeur

### 8.1 Niveaux de compte

**Compte Standard :**
- Naviguer sur la plateforme
- Acheter certains produits
- Contacter les vendeurs
- Utiliser le panier

**Vendeur Vérifié :**
- Vendre des produits
- Configurer la livraison
- Recevoir les paiements
- Afficher un badge "✓ Identité vérifiée"

### 8.2 Documents d'identité acceptés

- Carte nationale d'identité
- Passeport
- Permis de conduire

**Protection :** 
- Les documents restent **PRIVÉS** et ne sont jamais affichés publiquement
- Chiffrement des données sensibles
- Règles de conservation adaptées à la légalité du pays
- Accès administrateur restreint

### 8.3 Processus de vérification

1. Vendeur soumet un document d'identité
2. Optionnel : selfie de vérification
3. Admin valide le document
4. Badge "✓ Identité vérifiée" affiché sur le profil
5. Accès au compte vendeur activé

9. Portefeuille et retraits

### 9.1 Vue d'ensemble du portefeuille

Chaque utilisateur possède un portefeuille affichant :

**Soldes :**
- **Solde disponible** : argent prêt à être retiré
- **Solde en attente** (pending) : argent bloqué en escrow dans les transactions actives
- **Argent en cours de retrait** : demandes de retrait en traitement
- **Total gagné** : cumul de tous les revenus
- **Total dépensé** : cumul de tous les achats (pour les acheteurs)

**Actions principales :**
- Déposer (recharge de compte)
- Retirer
- Consulter l'historique

### 9.2 Configuration des retraits

**Minimum de retrait :** 2 500 FCFA

**Frais de retrait :** 5 %

**Affichage obligatoire avant confirmation :**
```
Retrait demandé : 10 000 FCFA
Frais (5%) :      500 FCFA
Montant net :     9 500 FCFA
```

### 9.3 Règles critiques

- Les retraits concernent **UNIQUEMENT** le solde disponible
- L'argent en attente ne peut JAMAIS être retiré
- Chaque transaction a un **identifiant unique**
- Chaque mouvement est enregistré avec date, montant, type

### 9.4 Gestion des devises multiples

**Important :** NE PAS faire simplement `1 USD = X FCFA` en dur dans le code.

**À mettre en place :**
- Service de taux de change en temps réel
- Enregistrement du taux utilisé AU MOMENT de la transaction
- Historique du taux utilisé et de sa date
- Montant converti enregistré

**Exemple :**
```
Transaction
- Montant original : 50 000 XOF
- Devise : XOF
- Taux utilisé : 1 USD = 600 XOF
- Date du taux : 2026-08-15
- Montant converti : 83,33 USD
```

**Précision monétaire :** Utiliser une arithmétique décimale exacte, JAMAIS de calculs flottants pour l'argent.
10. Système de réputation et profil vendeur

Chaque vendeur dispose d'un profil public affichant :

**Métriques de confiance :**
- Note globale (★★★★★)
- Nombre de ventes
- Nombre de commandes complétées
- Taux d'annulation (%)
- Taux de litiges ouverts (%)
- Temps moyen de réponse aux messages
- Statut de vérification (✓ Identité vérifiée)

**Informations supplémentaires :**
- Description du vendeur
- Historique des produits
- Commentaires des acheteurs
- Produits les plus vendus
11. Assistants IA spécialisés

### 11.1 Assistant Utilisateur (Chat Support)

**Objectif :** Aider les acheteurs et utilisateurs généraux.

**Domaines de compétence :**
- Recherche et exploration de produits
- Compréhension des fiches produits
- Suivi des commandes
- Questions sur les paiements
- Questions sur le portefeuille
- Assistance au retour/remboursement
- Règles et conditions de la plateforme
- Résolution des problèmes généraux

**Contrainte critique :** 
- NE JAMAIS inventer une information
- Consulter les données réelles du compte utilisateur (avec permissions appropriées)
- Exemple : Au lieu d'inventer, dire "Votre commande #AF-8492 est actuellement en transit. Dernière mise à jour : ..."

### 11.2 Agent Vendeur (Vendeur Assistant)

**Objectif :** Aider les vendeurs à optimiser leur activité.

**Fonctionnalités :**
- Créer une fiche produit complète et optimisée
- Améliorer les descriptions de produits
- Analyser les ventes et les tendances
- Aider à répondre aux clients (IA-assisted)
- Gérer les stocks
- Proposer des promotions
- Identifier les produits performants/sous-performants
- Conseils sur les prix compétitifs
- Gestion des images et photos

### 11.3 Spécialisation Afima (vs. modèles généraux)

**Différence clé :** Tu n'as besoin d'un chatbot "meilleur que Gemini" sur tout.
Tu as besoin d'un chatbot **spécialisé dans Afima** qui connaît :
- Les produits en base
- Les commandes de l'utilisateur
- Les règles commerciales
- Les workflows de la plateforme
- L'historique des transactions
- Les statuts de vérification
- Les politiques de retour

C'est plus utile qu'une IA généraliste.
12. Création de boutiques en ligne personnalisées

### 12.1 Condition d'accès

Lorsqu'un utilisateur possède **plus de 10 produits**, il peut créer une **boutique professionnelle personnalisée**.

### 12.2 Modèle d'abonnement

```
Offre Boutique

Mois 1-3 :    2 €/mois    (Offre de lancement)
Mois 4+ :     6 €/mois    (Tarif régulier)
```

### 12.3 Fonctionnalités incluses

- Boutique personnalisée avec sous-domaine
- Identifiant unique (ex: `vendeur.afima.com`)
- Catalogue de produits
- Panier d'achat
- Gestion des commandes
- Système de paiement intégré
- Configuration de livraison
- Statistiques et analytics
- Assistant IA dédié

### 12.4 Domaine personnalisé

L'utilisateur peut connecter son propre domaine :
- `www.maboutique.com`
- Le compte reste lié et géré par Afima
- L'administrateur reste Afima

### 12.5 Architecture

```
AFIMA (Maître)
│
├── Compte vendeur (Gestion centrale)
│
├── Produits
│
├── Commandes
│
├── Portefeuille
│
└── Boutique personnalisée (Optional)
       │
       ├── Accueil
       ├── Catalogue
       ├── Fiche produit
       ├── Panier
       ├── Commande
       ├── Contact
       └── Pages personnalisées
```

13. Éditeur No-Code (Afima Builder)

### 13.1 Concept

Inspiré de Shopify, permettre aux vendeurs de créer leurs pages sans connaissances techniques.

### 13.2 Composants disponibles

**Structure :**
- Créer des pages
- Ajouter des sections
- Définir des grilles et layouts

**Contenu :**
- Texte et titres
- Images et galeries
- Vidéos
- Boutons
- Formulaires
- Listes de produits
- Code HTML/CSS/JS custom (avec restrictions)

### 13.3 Personnalisation

- Modifier les couleurs
- Modifier les polices et typographie
- Modifier la mise en page
- Animations simples
- Responsive design

### 13.4 Templates

- Modèles prêts à l'emploi
- Sections réutilisables
- Exemples d'inspiration

### 13.5 Assistance IA

- L'IA peut modifier et créer des pages automatiquement
- Génération de contenu basée sur les produits
- Suggestions de layout optimisées
14. Agent Coding (Code Generator pour boutiques)

### 14.1 Concept

Pour les utilisateurs ayant une boutique, le chatbot IA devient un **Agent Coding**.
Permet de générer, modifier et maintenir du code personnalisé.

### 14.2 Capacités

L'IA peut générer et modifier :
- **HTML** : Structure et markup
- **CSS** : Styles et mise en page
- **JavaScript** : Interactivité

**Exemples de requêtes :**
- "Crée-moi une page d'accueil moderne pour ma boutique."
- "Ajoute une animation de défilement."
- "Change la couleur du bouton d'achat en rouge."
- "Crée un slider de produits."

### 14.3 Code utilisateur personnalisé

L'utilisateur peut également :
- Écrire du code directement
- Modifier le code généré
- Télécharger/exporter le code
- Versionner ses modifications

### 14.4 Sécurité CRITIQUE

Le code personnalisé doit être exécuté dans un environnement **fortement isolé**.

**Accès INTERDIT au code côté navigateur :**
- Mots de passe
- Clés secrètes (API keys)
- Base de données
- Systèmes de paiement
- Données privées d'autres utilisateurs
- Tokens d'authentification

**Opérations sensibles = Côté serveur :**
- Validation des données
- Transactions monétaires
- Accès à la base de données
- Authentification
- Vérification des permissions

**Architecture sécurisée requise :**
- Sandbox pour le code utilisateur
- Limitation des ressources (CPU, mémoire)
- Timeouts sur l'exécution
- Logs des exécutions
- Isolation des données par boutique

15. Sécurité générale de la plateforme

Afima doit intégrer les mesures de sécurité suivantes :

### 15.1 Authentification et comptes

- Authentification sécurisée (OAuth 2.0 / JWT recommandé)
- Mot de passe fort obligatoire
- Authentification multi-facteurs (2FA/MFA) recommandée
- Sessions sécurisées avec timeouts
- Gestion des tokens

### 15.2 Données sensibles

- Chiffrement des documents d'identité (AES-256)
- Chiffrement des données de paiement
- Chiffrement end-to-end des messages (optionnel)
- Hachage sécurisé des mots de passe (bcrypt/Argon2)
- Pas de stockage de numéros de carte entiers

### 15.3 Transactions et paiements

- Validation de toutes les transactions
- Détection des comportements suspects
- Vérification des montants
- Enregistrement de tous les mouvements monétaires
- Isolement des clés API de paiement

### 15.4 Journalisation (Audit Trail)

Enregistrer TOUTES les opérations sensibles :
- Création/modification de comptes
- Changements de mots de passe
- Vérifications d'identité
- Transactions monétaires
- Modifications de portefeuille
- Retraits
- Litiges
- Actions administrateur
- Accès aux données sensibles

### 15.5 Protection contre les fraudes

- Système anti-fraude (détection d'anomalies)
- Vérification des transactions suspectes
- Limitation des tentatives de paiement échouées
- Détection des multiples comptes d'une même personne
- Monitoring des patterns anormaux

### 15.6 Signalement et modération

- Système de signalement pour les produits
- Système de signalement pour les utilisateurs
- System de signalement pour les messages
- Queue de modération pour l'équipe
- Suppression rapide du contenu dangereux
- Bannissement des utilisateurs abusifs

### 15.7 Sauvegardes et récupération

- Sauvegardes régulières (quotidiennes minimum)
- Sauvegardes hors-site
- Tests de récupération périodiques
- Stratégie de récupération en cas de sinistre
- Rétention des logs d'audit

### 15.8 Conformité légale

- Respect du RGPD (si EU)
- Respect des lois locales par pays
- Politique de confidentialité claire
- Conditions d'utilisation claires
- Droit à l'oubli (Data Deletion)
- Export de données utilisateur (Data Portability)
16. Priorités de développement et MVP

### 16.1 PHASE 1 — MVP (Minimum Viable Product)

**Critère :** Sécuriser l'argent, les commandes et les utilisateurs en priorité absolue.

**Fonctionnalités ESSENTIELLES :**
1. Comptes utilisateurs sécurisés
2. Système de produits (création, édition, recherche)
3. Fiches produits complètes
4. Messagerie entre acheteur/vendeur
5. Panier d'achat
6. Système de commandes
7. Paiement sécurisé avec escrow (CRITÈRE #1)
8. Confirmation de réception et libération des fonds
9. Portefeuille utilisateur
10. Retrait d'argent
11. Retours et remboursements basiques
12. Vérification d'identité des vendeurs
13. Gestion des litiges simples
14. Système anti-fraude basique

**Timeline :** 2-3 mois

### 16.2 PHASE 2 — Consolidation et assistants

**Ajouts :**
1. Système de réputation avancé
2. Litiges détaillés avec centre de modération
3. Protection anti-fraude améliorée
4. Chatbot Afima spécialisé
5. Agent vendeur IA
6. Notifications avancées
7. Analytics basique pour vendeurs
8. Rapport d'activité pour admins

**Timeline :** 1-2 mois après Phase 1

### 16.3 PHASE 3 — Boutiques et personnalisation

**Ajouts :**
1. Système de boutiques en ligne
2. Abonnement à la boutique
3. Sous-domaines pour boutiques
4. Éditeur No-Code
5. Templates de boutique
6. Assistant IA pour pages
7. Connexion de domaines personnalisés
8. Agent Coding pour HTML/CSS/JS

**Timeline :** 2-3 mois après Phase 2

### 16.4 PHASE 4 — Advanced features

**Ajouts :**
1. Promotions et coupons
2. Programmes de fidélité
3. Campagnes marketing
4. APIs ouvertes pour intégrations tierces
5. Webhooks pour événements
6. Reporting avancé
7. Optimisations de performance
8. Mise à l'échelle globale

**Timeline :** Ongoing