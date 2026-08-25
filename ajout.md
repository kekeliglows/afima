# CHECKLIST RAPIDE — AFIMA

**Source de vérité :** Voir [Cahier des charges](Cahier%20des%20charges%20fonctionnel%20%E2%80%94%20Afima.md) pour les détails complets.

**Architecture technique :** Voir [futur.md](futur.md) pour le système Wallet/Escrow.

---

## 📋 Fonctionnalités à implémenter

### ✅ PHASE 1 — MVP (Sécuriser argent, commandes, utilisateurs)

- [ ] Comptes utilisateurs sécurisés
- [ ] Système de produits (CRUD)
- [ ] Fiches produits complètes
- [ ] Messagerie acheteur-vendeur
- [ ] Panier d'achat
- [ ] Commandes avec états
- [ ] Paiement sécurisé (Escrow)
- [ ] Confirmation de réception
- [ ] Portefeuille utilisateur
- [ ] Retrait d'argent
- [ ] Retours/remboursements basiques
- [ ] Vérification d'identité vendeurs
- [ ] Gestion des litiges simples
- [ ] Anti-fraude basique

### ⏳ PHASE 2 — Consolidation & IA

- [ ] Système de réputation avancé
- [ ] Centre de litiges détaillé
- [ ] Protection anti-fraude améliorée
- [ ] **Chatbot Afima** spécialisé
- [ ] **Agent Vendeur** IA
- [ ] Notifications avancées
- [ ] Analytics vendeurs
- [ ] Rapports admin

### 🎨 PHASE 3 — Boutiques & Personnalisation

- [ ] Système de boutiques (abonnement 2€/3m puis 6€/m)
- [ ] Sous-domaines pour boutiques
- [ ] **Éditeur No-Code** (Afima Builder)
- [ ] Templates de boutique
- [ ] Assistant IA pour pages
- [ ] Connexion de domaines personnalisés
- [ ] **Agent Coding** (HTML/CSS/JS)

### 🚀 PHASE 4 — Advanced

- [ ] Promotions et coupons
- [ ] Programmes de fidélité
- [ ] Campagnes marketing
- [ ] APIs ouvertes
- [ ] Webhooks
- [ ] Reporting avancé
- [ ] Optimisations perf

---

## 🔧 Configuration de livraison (IMPORTANT)

Chaque produit doit avoir une config complète :

- [ ] Mode (domicile / relais / transporteur / vendeur / retrait)
- [ ] Zone (ville / région / pays / sélection)
- [ ] Tarification (gratuit / fixe / distance / poids / zone)
- [ ] Délais (24h / 48h / 3-5j / custom)
- [ ] Infos supplémentaires (conditions, horaires, instructions)

---

## 💳 Paiement sécurisé (ESCROW)

**Flux :** Acheteur → Plateforme → Vendeur

**États de l'argent vendeur :**
- `pending_balance` : Bloqué en escrow
- `available_balance` : Prêt pour retrait
- `withdrawn_balance` : Retiré

**Timeline :**
- J+0 : Paiement reçu (pending_balance +)
- J+X : Colis livré
- J+10 ou confirmation : Libération (commission -5%, then available_balance +)

Voir [futur.md](futur.md) pour le schéma BD et les fonctions.

---

## 🛡️ Vérification d'identité

- Documents : Carte ID / Passeport / Permis
- Badge : ✓ Identité vérifiée
- Protection : **Privé, chiffré, jamais public**

---

## 💰 Portefeuille

- Minimum retrait : **2 500 FCFA**
- Frais retrait : **5%**
- Afficher net AVANT confirmation
- Gestion devises multi avec taux enregistrés
- Arithmétique décimale exacte (pas float)

---

## 🤖 Assistants IA (Non généralistes)

### Assistant Utilisateur
- Aide acheteurs
- Connaît les produits, commandes, paiements, règles
- Consulte données RÉELLES de l'utilisateur
- Ne jamais inventer

### Agent Vendeur
- Aide vendeurs
- Crée/améliore fiches
- Analyse ventes
- Gère stocks
- Propose promos

---

## 🏪 Boutiques en ligne

- **Accès :** 10+ produits
- **Abonnement :** 2€/3m → 6€/m
- **Features :** Sous-domaine, catalogue, panier, stats, IA
- **Domaine perso :** Optionnel

---

## 🎨 Éditeur No-Code (Afima Builder)

Inspiré Shopify :
- Pages & sections
- Texte, images, vidéos, boutons
- Couleurs, polices, layout
- Templates prêts à l'emploi
- IA peut générer/modifier

---

## 💻 Agent Coding (Code pour boutiques)

- Génère HTML/CSS/JavaScript
- Utilisateurs peuvent modifier
- **SÉCURITÉ CRITIQUE :**
  - ❌ Pas accès : mots de passe, clés, DB, paiements
  - ✅ Oui : Sandbox, timeouts, logs
  - ✅ Oui : Opérations sensibles côté serveur

---

## 🔒 Sécurité

- Authentication sécurisée (OAuth/JWT)
- Chiffrement données sensibles (AES-256)
- Journalisation audit (toutes opérations)
- Anti-fraude (détection anomalies)
- Signalement (produits, users, messages)
- Sauvegardes régulières

---

## 📞 Contacts & Support

- **Messagerie** : Contextuelle (produit lié)
- **Chatbot** : Spécialisé Afima (pas généraliste)
- **Centre de litiges** : Motifs, preuves (photos), admin résout
