# ARCHITECTURE TECHNIQUE — SYSTÈME DE WALLET ET ESCROW

**Rôle :** Architecture logiciel pour le système de Portefeuille Virtuel (Wallet) avec Séquestre (Escrow) pour la marketplace Afima.

**Objectif :** Concevoir la logique métier, la base de données et les flux API de manière indépendante de l'agrégateur de paiement final (FedaPay, Paystack, CinetPay, etc.).

---

## 1. Principes fondamentaux

### 1.1 Flux monétaire sécurisé

```
Acheteur paie → Plateforme (ESCROW) → Vendeur
```

**PAS DIRECT :**
```
Acheteur → Vendeur ❌
```

### 1.2 États de l'argent du vendeur

L'argent d'un vendeur existe dans **3 états** distincts :

1. **pending_balance** : En escrow, bloqué dans une commande
2. **available_balance** : Disponible pour retrait
3. **withdrawn_balance** : Retiré vers le compte bancaire/Mobile Money

---

## 2. Schéma de base de données

### 2.1 Table USERS

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  is_vendor BOOLEAN DEFAULT FALSE,
  is_verified_seller BOOLEAN DEFAULT FALSE,
  verification_status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Table WALLETS

```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  pending_balance DECIMAL(15,2) DEFAULT 0.00,
  available_balance DECIMAL(15,2) DEFAULT 0.00,
  withdrawn_balance DECIMAL(15,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'XOF',
  total_earned DECIMAL(15,2) DEFAULT 0.00,
  total_spent DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indice pour performance
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
```

### 2.3 Table PRODUCTS

```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  vendor_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  category VARCHAR(100),
  status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_products_vendor_id ON products(vendor_id);
```

### 2.4 Table ORDERS

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  buyer_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INT NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  exchange_rate DECIMAL(10,6) DEFAULT 1.00,
  exchange_rate_date TIMESTAMP,
  status ENUM(
    'created',
    'payment_pending',
    'payment_confirmed',
    'preparing',
    'shipped',
    'in_transit',
    'delivered',
    'confirmed',
    'completed',
    'cancelled'
  ) DEFAULT 'created',
  dispute_status ENUM('none', 'open', 'under_review', 'resolved') DEFAULT 'none',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (buyer_id) REFERENCES users(id),
  FOREIGN KEY (vendor_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_orders_buyer_id ON orders(buyer_id);
CREATE INDEX idx_orders_vendor_id ON orders(vendor_id);
CREATE INDEX idx_orders_status ON orders(status);
```

### 2.5 Table WALLET_TRANSACTIONS

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY,
  wallet_id UUID NOT NULL,
  order_id UUID,
  type ENUM(
    'order_payment',
    'escrow_release',
    'commission_deduction',
    'refund',
    'withdrawal_request',
    'withdrawal_completed',
    'deposit',
    'fee_charged'
  ) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  description VARCHAR(255),
  status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
  from_balance_type VARCHAR(50),  -- 'pending', 'available'
  to_balance_type VARCHAR(50),    -- 'pending', 'available', 'withdrawn'
  reference_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_order_id ON wallet_transactions(order_id);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
```

### 2.6 Table PAYOUT_REQUESTS

```sql
CREATE TABLE payout_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'XOF',
  payment_method_id UUID NOT NULL,
  status ENUM(
    'pending',
    'approved',
    'processing',
    'completed',
    'failed',
    'cancelled'
  ) DEFAULT 'pending',
  external_transaction_id VARCHAR(100),
  error_message TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)
);

CREATE INDEX idx_payout_requests_user_id ON payout_requests(user_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
```

### 2.7 Table PAYMENT_METHODS

```sql
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  method_type ENUM('mobile_money', 'bank_account', 'card') NOT NULL,
  provider VARCHAR(100),  -- 'FedaPay', 'Paystack', etc.
  account_number VARCHAR(255) ENCRYPTED,
  account_holder VARCHAR(255),
  country_code VARCHAR(2),
  status ENUM('active', 'inactive', 'deleted') DEFAULT 'active',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);
```

### 2.8 Table DISPUTES

```sql
CREATE TABLE disputes (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE,
  initiated_by UUID NOT NULL,  -- buyer_id ou vendor_id
  reason VARCHAR(100),
  description TEXT,
  status ENUM('open', 'under_review', 'resolved', 'closed') DEFAULT 'open',
  resolution ENUM(
    'full_refund',
    'partial_refund',
    'vendor_payment',
    'replacement',
    'custom'
  ),
  resolution_notes TEXT,
  resolved_by UUID,  -- admin_id
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (initiated_by) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

CREATE INDEX idx_disputes_order_id ON disputes(order_id);
CREATE INDEX idx_disputes_status ON disputes(status);
```

---

## 3. Machine à états (State Machine)

### 3.1 Cycle de vie complet d'une transaction

```
┌─────────────────────────────────────────────────────────┐
│                  COMMANDE CRÉÉE                         │
│              (Acheteur crée la commande)                │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              PAIEMENT EN ATTENTE                        │
│          (Acheteur entre le paiement)                  │
│   Argent ENS ESCROW: pending_balance du vendeur +      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│           PAIEMENT CONFIRMÉ                            │
│    (Vérification provider + débit réussi)             │
│    Vendeur reçoit notification:                        │
│    "Paiement confirmé. Préparez votre commande"       │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│             COMMANDE PRÉPARÉE                          │
│         (Vendeur prépare le colis)                    │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                 EXPÉDIÉE                               │
│         (Vendeur crée le bordereau)                   │
│         Acheteur reçoit suivi (tracking)              │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│              EN TRANSIT                                │
│        (Suivi du prestataire de livraison)            │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│                 LIVRÉE                                 │
│   (Le livreur confirme la livraison)                  │
│   Timer de 10 jours commence                          │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ├─────────────────────────────────┐
                   │                                 │
                   ▼                                 ▼
    ┌──────────────────────────┐      ┌──────────────────────────┐
    │  LITIGE OUVERT?          │      │ ACHETEUR CONFIRME REÇU   │
    │ (Acheteur signale prob)  │      │  (Dans les 10 jours)     │
    └──────────────┬───────────┘      └──────────┬───────────────┘
                   │                              │
                   ▼                              ▼
    ┌──────────────────────────┐      ┌──────────────────────────┐
    │  LITIGE EN COURS         │      │ ESCROW RELEASE           │
    │ (Paiement bloqué)        │      │ (Commission déduite)     │
    │ (Timer stoppé)           │      │ available_balance = +    │
    │ (Admin examine)          │      │ pending_balance = -      │
    └──────────────┬───────────┘      └──────────┬───────────────┘
                   │                              │
                   ▼                              ▼
    ┌──────────────────────────┐      ┌──────────────────────────┐
    │  LITIGE RÉSOLU           │      │     COMMANDE            │
    │ (Admin décide)           │      │    CONFIRMÉE             │
    │                          │      │ (Prête pour retrait)     │
    │ • Full refund            │      └──────────┬───────────────┘
    │ • Partial refund         │                  │
    │ • Vendor payment         │                  ▼
    │ • Replacement            │      ┌──────────────────────────┐
    └──────────────┬───────────┘      │    COMMANDE TERMINÉE     │
                   │                  │  (Vendeur peut retirer)  │
                   │                  └──────────────────────────┘
                   │
                   ▼
    ┌──────────────────────────┐
    │  TERMINATION DISPUTE     │
    │  (Selon la résolution)   │
    └──────────────────────────┘

TIMEOUT AUTOMATIQUE (10j après livraison)
Si acheteur N'a PAS confirmé ET aucun litige:
  → Validation automatique
  → Escrow release
  → État COMMANDE TERMINÉE
```

### 3.2 États possibles d'une commande

| État | Description | Argent du vendeur |
|------|-------------|------------------|
| `created` | Vient d'être créée | Aucun |
| `payment_pending` | Paiement en cours | Aucun |
| `payment_confirmed` | Paiement reçu | pending_balance |
| `preparing` | Vendeur prépare | pending_balance |
| `shipped` | Colis expédié | pending_balance |
| `in_transit` | En route | pending_balance |
| `delivered` | Reçu par acheteur | pending_balance + timer 10j |
| `confirmed` | Acheteur a confirmé | Commission déduite → available_balance |
| `completed` | Transaction finie | Prêt pour retrait |
| `cancelled` | Annulée | Remboursé acheteur |

---

## 4. Fonctions critiques (Pseudo-code)

### 4.1 creditPendingBalance(vendorId, amount, orderId)

```pseudo
FONCTION creditPendingBalance(vendorId, amount, orderId):
  
  // Vérifications préalables
  SI NOT EXISTS(users WHERE id = vendorId):
    LANCER EXCEPTION "Vendor not found"
  
  SI NOT EXISTS(orders WHERE id = orderId):
    LANCER EXCEPTION "Order not found"
  
  // Démarrer une transaction DB
  COMMENCER TRANSACTION
  TRY:
    // 1. Verrouiller la ligne du wallet (pessimistic locking)
    wallet = SELECT * FROM wallets 
             WHERE user_id = vendorId 
             FOR UPDATE
    
    // 2. Créer la transaction en DB
    transaction = CRÉER wallet_transaction {
      wallet_id: wallet.id,
      order_id: orderId,
      type: 'order_payment',
      amount: amount,
      status: 'pending',
      from_balance_type: null,
      to_balance_type: 'pending'
    }
    
    // 3. Créditer le pending_balance
    UPDATE wallets 
    SET pending_balance = pending_balance + amount,
        total_earned = total_earned + amount,
        updated_at = NOW()
    WHERE id = wallet.id
    
    // 4. Marquer la transaction comme complétée
    UPDATE wallet_transactions 
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = transaction.id
    
    // 5. Mettre à jour la commande
    UPDATE orders 
    SET status = 'payment_confirmed',
        updated_at = NOW()
    WHERE id = orderId
    
    VALIDER TRANSACTION
    
    RETOURNER {
      success: TRUE,
      transaction_id: transaction.id,
      new_pending_balance: wallet.pending_balance + amount
    }
    
  CATCH EXCEPTION e:
    ANNULER TRANSACTION
    LANCER EXCEPTION e
```

### 4.2 releaseEscrow(orderId, deductCommission = 0.05)

```pseudo
FONCTION releaseEscrow(orderId, deductCommission = 0.05):
  
  // 1. Récupérer la commande et le wallet
  order = SELECT * FROM orders WHERE id = orderId
  
  SI order.status NOT IN ['delivered', 'confirmed']:
    LANCER EXCEPTION "Order not in valid state for escrow release"
  
  SI order.dispute_status == 'open':
    LANCER EXCEPTION "Cannot release escrow while dispute is open"
  
  wallet = SELECT * FROM wallets 
           WHERE user_id = order.vendor_id 
           FOR UPDATE
  
  COMMENCER TRANSACTION
  TRY:
    // 2. Calculer les montants
    escrow_amount = order.total_amount
    commission = escrow_amount * deductCommission
    net_amount = escrow_amount - commission
    
    // 3. Déduire du pending_balance
    UPDATE wallets 
    SET pending_balance = pending_balance - escrow_amount
    WHERE id = wallet.id
    
    // 4. Créer transaction 1: Retrait du pending
    txn_release = CRÉER wallet_transaction {
      wallet_id: wallet.id,
      order_id: orderId,
      type: 'escrow_release',
      amount: escrow_amount,
      status: 'completed',
      from_balance_type: 'pending',
      to_balance_type: 'available'
    }
    
    // 5. Créer transaction 2: Déduction commission
    txn_commission = CRÉER wallet_transaction {
      wallet_id: wallet.id,
      order_id: orderId,
      type: 'commission_deduction',
      amount: commission,
      status: 'completed',
      description: "Platform commission (5%)"
    }
    
    // 6. Créditer l'available_balance du net
    UPDATE wallets 
    SET available_balance = available_balance + net_amount,
        updated_at = NOW()
    WHERE id = wallet.id
    
    // 7. Marquer la commande comme complétée
    UPDATE orders 
    SET status = 'completed',
        updated_at = NOW()
    WHERE id = orderId
    
    VALIDER TRANSACTION
    
    RETOURNER {
      success: TRUE,
      escrow_amount: escrow_amount,
      commission_deducted: commission,
      net_released: net_amount
    }
    
  CATCH EXCEPTION e:
    ANNULER TRANSACTION
    LANCER EXCEPTION e
```

### 4.3 requestWithdrawal(vendorId, amount, paymentMethodId)

```pseudo
FONCTION requestWithdrawal(vendorId, amount, paymentMethodId):
  
  // Validations
  SI amount < 2500:
    LANCER EXCEPTION "Minimum withdrawal is 2500 FCFA"
  
  wallet = SELECT * FROM wallets 
           WHERE user_id = vendorId 
           FOR UPDATE
  
  SI wallet.available_balance < amount:
    LANCER EXCEPTION "Insufficient available balance"
  
  payment_method = SELECT * FROM payment_methods 
                   WHERE id = paymentMethodId 
                   AND user_id = vendorId
  
  SI NOT payment_method:
    LANCER EXCEPTION "Invalid payment method"
  
  COMMENCER TRANSACTION
  TRY:
    // 1. Calculer les frais
    fee = amount * 0.05  // 5% de frais
    net_amount = amount - fee
    
    // 2. Déduire du available_balance
    UPDATE wallets 
    SET available_balance = available_balance - amount,
        updated_at = NOW()
    WHERE id = wallet.id
    
    // 3. Créer la demande de retrait
    payout_request = CRÉER payout_requests {
      user_id: vendorId,
      amount: amount,
      payment_method_id: paymentMethodId,
      status: 'pending'
    }
    
    // 4. Créer la transaction
    txn = CRÉER wallet_transactions {
      wallet_id: wallet.id,
      type: 'withdrawal_request',
      amount: amount,
      status: 'pending',
      reference_id: payout_request.id,
      description: `Withdrawal to ${payment_method.method_type}`
    }
    
    VALIDER TRANSACTION
    
    RETOURNER {
      success: TRUE,
      payout_request_id: payout_request.id,
      amount_requested: amount,
      fees: fee,
      net_amount: net_amount,
      status: 'pending'
    }
    
  CATCH EXCEPTION e:
    ANNULER TRANSACTION
    LANCER EXCEPTION e
```

### 4.4 processPayout(payoutRequestId, provider = 'manual')

```pseudo
FONCTION processPayout(payoutRequestId, provider = 'manual'):
  
  payout_request = SELECT * FROM payout_requests 
                   WHERE id = payoutRequestId 
                   FOR UPDATE
  
  SI payout_request.status != 'pending':
    LANCER EXCEPTION "Payout request not in pending state"
  
  COMMENCER TRANSACTION
  TRY:
    // 1. Marquer comme en traitement
    UPDATE payout_requests 
    SET status = 'processing'
    WHERE id = payoutRequestId
    
    // 2. Appeler le provider approprié
    SI provider == 'manual':
      // Admin traite manuellement plus tard
      RETOURNER { status: 'processing', message: 'Awaiting manual processing' }
    
    SINON SI provider == 'fedapay':
      result = APPELER FedaPayAPI.transfer(
        amount: payout_request.amount,
        recipient: payment_method.account_number,
        description: "Withdrawal"
      )
    
    SINON SI provider == 'paystack':
      result = APPELER PaystackAPI.transfer(
        recipient_code: payment_method.paystack_recipient_code,
        amount: payout_request.amount
      )
    
    // 3. Selon le résultat
    SI result.success:
      UPDATE payout_requests 
      SET status = 'completed',
          external_transaction_id = result.transaction_id,
          processed_at = NOW()
      WHERE id = payoutRequestId
      
      UPDATE wallet_transactions 
      SET status = 'completed',
          completed_at = NOW()
      WHERE reference_id = payoutRequestId
      
      // Mettre à jour le withdrawn_balance
      wallet = SELECT * FROM wallets 
               WHERE user_id = payout_request.user_id
      UPDATE wallets 
      SET withdrawn_balance = withdrawn_balance + payout_request.amount
      WHERE id = wallet.id
      
    SINON:
      UPDATE payout_requests 
      SET status = 'failed',
          error_message = result.error
      WHERE id = payoutRequestId
      
      // Remettre l'argent dans available_balance
      UPDATE wallets 
      SET available_balance = available_balance + payout_request.amount
      WHERE user_id = payout_request.user_id
    
    VALIDER TRANSACTION
    RETOURNER result
    
  CATCH EXCEPTION e:
    ANNULER TRANSACTION
    LANCER EXCEPTION e
```

---

## 5. Gestion des erreurs et sécurité

### 5.1 Double dépense (Pessimistic Locking)

```
Le problème:
Deux retraits simultanés de 5000 FCFA depuis un solde de 7500 FCFA

Solution: Verrouillage pessimiste
```

Dans chaque fonction critique, utiliser :
```sql
SELECT * FROM wallets WHERE user_id = ? FOR UPDATE;
```

Cela **verrouille** la ligne jusqu'à la fin de la transaction, empêchant les lectures/écritures concurrentes.

### 5.2 Gestion des soldes insuffisants

```pseudo
SI wallet.available_balance < amount:
  LOG(user_id, 'withdrawal_failed', 'insufficient_balance')
  LANCER EXCEPTION "Insufficient balance"
  // Pas d'update, pas de transaction créée
```

### 5.3 Timeouts et Idempotence

**Chaque fonction doit être idempotente** (appelable plusieurs fois sans effet multiple) :

```pseudo
// Avant de créer une transaction
existing_txn = SELECT * FROM wallet_transactions 
               WHERE reference_id = externalId 
               AND status = 'completed'

SI existing_txn:
  RETOURNER existing_txn  // Déjà traitée
```

### 5.4 Audit Trail

Chaque transaction monétaire doit être enregistrée :

```sql
INSERT INTO audit_log (
  user_id, action, old_value, new_value, 
  timestamp, ip_address, user_agent
) VALUES (...)
```

### 5.5 Validation des montants

```pseudo
SI amount <= 0:
  LANCER EXCEPTION "Amount must be positive"

SI amount > MAX_TRANSACTION_AMOUNT:
  LANCER EXCEPTION "Amount exceeds maximum"

SI amount NOT INTEGER(cents):
  LANCER EXCEPTION "Amount must have max 2 decimals"
```

---

## 6. Intégration avec fournisseurs de paiement

### 6.1 Architecture modulaire (Adapter Pattern)

```
Interface PaymentProvider:
  - authorizePayment(amount, orderId)
  - transferFunds(recipientId, amount)
  - checkStatus(externalTransactionId)
  - refund(originalTransactionId)

Implementations:
  - FedaPayAdapter
  - PaystackAdapter
  - CinetPayAdapter
  - ManualAdapter (admin)
```

### 6.2 Webhook handling

L'API du fournisseur envoie des webhooks de confirmation :

```pseudo
FONCTION handlePaymentWebhook(webhookData):
  
  // 1. Vérifier la signature webhook
  SI NOT verifyWebhookSignature(webhookData):
    LANCER EXCEPTION "Invalid webhook signature"
  
  // 2. Récupérer la commande
  order = SELECT * FROM orders 
          WHERE external_payment_id = webhookData.transaction_id
  
  SI webhookData.status == 'success':
    APPELER creditPendingBalance(order.vendor_id, order.total_amount, order.id)
  
  SINON SI webhookData.status == 'failed':
    UPDATE orders SET status = 'cancelled' WHERE id = order.id
    ENVOYER NOTIFICATION acheteur: "Payment failed"
```

---

## 7. Cas d'usage complets

### 7.1 Cas normal : Achat → Livraison → Confirmation → Retrait

```
Jour 1 - Achat:
  1. Acheteur paie 50 000 FCFA
  2. creditPendingBalance(vendeur, 50000, order123)
  3. Wallet vendeur: pending=50000, available=0

Jour 3 - Livraison:
  4. Colis livré
  5. Acheteur clique "Colis reçu"
  6. releaseEscrow(order123, commission=0.05)
  7. Commission = 2 500 FCFA
  8. Net = 47 500 FCFA
  9. Wallet vendeur: pending=0, available=47500

Jour 5 - Retrait:
  10. Vendeur demande retrait de 47 500 FCFA
  11. Frais (5%) = 2 375 FCFA
  12. Net à recevoir = 45 125 FCFA
  13. processPayout via FedaPay
  14. Argent viré sur compte Mobile Money
  15. Wallet vendeur: withdrawn=47500
```

### 7.2 Cas problématique : Litige

```
Jour 1 - Achat:
  1. Paiement reçu, pending=50000

Jour 3 - Litige:
  2. Acheteur signale "Produit endommagé"
  3. Litige ouvert
  4. Timer de 10j BLOQUÉ
  5. Argent reste en pending

Jour 8 - Résolution:
  6. Admin examine les preuves
  7. Décide: Remboursement intégral
  8. Acheteur remboursé de 50000 FCFA
  9. Wallet vendeur: pending=0, available=0
  10. Litige fermé
```

---

## 8. Notes de déploiement

### 8.1 Environnements

- **DEV** : Adapter local (pas d'appels réels à FedaPay)
- **STAGING** : Appels réels à l'API Sandbox
- **PRODUCTION** : Appels réels à l'API Production

### 8.2 Monitoring

```
Métriques à suivre:
- Temps moyen de traitement d'une commande
- Taux d'erreur des transactions
- Volume des litiges
- Delais des retraits
- Soldes en suspens (pending + in_process)
```

### 8.3 Backups

Les tables de transactions sont **critiques** :
- Backup quotidien minimum
- Rétention 7 ans (légal)
- Chiffrement des backups

### 8.4 Performance

```sql
-- Indices essentiels
CREATE INDEX idx_wallet_transactions_wallet_status 
  ON wallet_transactions(wallet_id, status);

CREATE INDEX idx_orders_created_date 
  ON orders(created_at DESC);

CREATE INDEX idx_payout_requests_user_status 
  ON payout_requests(user_id, status);
```



future nom de domaine: https://afima.org