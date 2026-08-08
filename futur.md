Rôle : Tu es un architecte logiciel senior et développeur Full-Stack spécialisé dans le e-commerce et les marketplaces.

Objectif : Concevoir la logique métier, la base de données et les flux API pour un système de Portefeuille Virtuel (Wallet) avec Séquestre (Escrow) pour la marketplace afima, indépendamment de l'agrégateur de paiement final.

Fonctionnement du système à modéliser :

Paiement & Blocage : L'acheteur règle une commande. L'argent est crédité sur un Solde en attente (pending_balance) du vendeur. Le vendeur ne peut pas retirer cet argent.

Validation & Transfert interne : Une fois le colis livré, l'acheteur clique sur le bouton "J'ai bien reçu mon colis". Le système déduit automatiquement la commission de la plateforme (ex: 5%) et transfère le reste du pending_balance vers le Solde disponible (available_balance) du vendeur.

Validation automatique (Sécurité) : Si l'acheteur ne valide pas sous 5 jours après la confirmation de livraison par le livreur, la validation est exécutée automatiquement par un job (Cron job).

Demande de retrait (Payout Request) : Le vendeur peut demander à tout moment le virement de tout ou partie de son available_balance vers son moyen de paiement (numéro Mobile Money ou banque). La demande génère un statut PENDING_PAYOUT.

Exécution du retrait (Abstrait) : Prévoir une interface / couche d'abstraction pour l'exécution du virement, afin de pouvoir switcher facilement entre un traitement manuel par l'administrateur ou une automatisation via API (FedaPay, Paystack, CinetPay, etc.) plus tard.

Ce que tu dois générer :

Schéma de Base de Données : Définis les tables nécessaires (ex: wallets, wallet_transactions, payout_requests, orders) avec leurs champs, clés étrangères et statuts (ex: pending, available, withdrawn, processing, completed).

Machine à états (State Machine) : Le cycle de vie d'une transaction de bout en bout (de l'achat au retrait final).

Logique Backend (Pseudo-code ou Node.js/Python/PHP) : Les fonctions clés :

creditPendingBalance(vendorId, amount, orderId)

releaseEscrow(orderId)

requestWithdrawal(vendorId, amount, paymentMethodDetails)

processPayout(payoutRequestId) (conçue comme un hook modulaire).

Cas d'erreurs et Sécurité : Gestion des solde insuffisants, verrouillage de ligne (pessimistic locking / verrous) pour éviter la double dépense si deux demandes de retrait sont faites en même temps.



