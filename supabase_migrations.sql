-- ============================================================
-- AFIMA — MIGRATIONS SUPABASE
-- À exécuter dans l'éditeur SQL de ton projet Supabase :
-- https://supabase.com/dashboard/project/_/sql
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- 1. COLONNES MANQUANTES — TABLE produits
-- ──────────────────────────────────────────────────────────────

ALTER TABLE produits
  ADD COLUMN IF NOT EXISTS etat          TEXT    DEFAULT 'neuf'     CHECK (etat IN ('neuf', 'occasion')),
  ADD COLUMN IF NOT EXISTS categorie     TEXT,
  ADD COLUMN IF NOT EXISTS mode_livraison TEXT   DEFAULT 'vendeur'  CHECK (mode_livraison IN ('domicile','relais','transporteur','vendeur','retrait','personnalise')),
  ADD COLUMN IF NOT EXISTS zone_livraison TEXT   DEFAULT 'ville'    CHECK (zone_livraison IN ('ville','region','pays','selection')),
  ADD COLUMN IF NOT EXISTS frais_livraison_type TEXT DEFAULT 'gratuit' CHECK (frais_livraison_type IN ('gratuit','fixe','distance','poids','zone')),
  ADD COLUMN IF NOT EXISTS frais_livraison NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delai_livraison TEXT  DEFAULT '3-5j'     CHECK (delai_livraison IN ('24h','48h','3-5j','custom')),
  ADD COLUMN IF NOT EXISTS delai_custom   TEXT,
  ADD COLUMN IF NOT EXISTS politique_retour TEXT,
  ADD COLUMN IF NOT EXISTS devise         TEXT   DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS vues           INTEGER DEFAULT 0;

-- Index pour les filtres catalogue
CREATE INDEX IF NOT EXISTS idx_produits_categorie ON produits(categorie);
CREATE INDEX IF NOT EXISTS idx_produits_etat      ON produits(etat);


-- ──────────────────────────────────────────────────────────────
-- 2. TABLE wallets (portefeuille vendeur)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  pending_balance   NUMERIC(15,2) DEFAULT 0.00,
  available_balance NUMERIC(15,2) DEFAULT 0.00,
  withdrawn_balance NUMERIC(15,2) DEFAULT 0.00,
  total_earned      NUMERIC(15,2) DEFAULT 0.00,
  total_spent       NUMERIC(15,2) DEFAULT 0.00,
  currency          TEXT DEFAULT 'XOF',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);

-- RLS wallets : chaque vendeur ne voit que son propre wallet
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_self" ON wallets;
CREATE POLICY "wallet_self" ON wallets
  FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 3. TABLE wallet_transactions
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  order_id          UUID,
  type              TEXT NOT NULL CHECK (type IN (
    'order_payment','escrow_release','commission_deduction',
    'refund','withdrawal_request','withdrawal_completed',
    'deposit','fee_charged'
  )),
  amount            NUMERIC(15,2) NOT NULL,
  currency          TEXT DEFAULT 'XOF',
  description       TEXT,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','cancelled')),
  from_balance_type TEXT,
  to_balance_type   TEXT,
  reference_id      TEXT UNIQUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_order_id  ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_status    ON wallet_transactions(status);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_txn_self" ON wallet_transactions;
CREATE POLICY "wallet_txn_self" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets w WHERE w.id = wallet_id AND w.user_id = auth.uid())
  );


-- ──────────────────────────────────────────────────────────────
-- 4. TABLE payment_methods (moyens de paiement pour retraits)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type    TEXT NOT NULL CHECK (method_type IN ('mobile_money','bank_account','card')),
  provider       TEXT,          -- ex: 'MTN Money', 'Moov', 'Wave', 'FedaPay'
  account_number TEXT NOT NULL, -- chiffré côté applicatif avant stockage
  account_holder TEXT,
  country_code   TEXT,
  is_default     BOOLEAN DEFAULT FALSE,
  status         TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','deleted')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_self" ON payment_methods;
CREATE POLICY "pm_self" ON payment_methods
  FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 5. TABLE payout_requests (demandes de retrait)
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payout_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID NOT NULL REFERENCES auth.users(id),
  amount                   NUMERIC(15,2) NOT NULL,
  fee                      NUMERIC(15,2) DEFAULT 0,
  net_amount               NUMERIC(15,2),
  currency                 TEXT DEFAULT 'XOF',
  payment_method_id        UUID REFERENCES payment_methods(id),
  status                   TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','completed','failed','cancelled')),
  external_transaction_id  TEXT,
  error_message            TEXT,
  requested_at             TIMESTAMPTZ DEFAULT NOW(),
  processed_at             TIMESTAMPTZ
);

ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pr_self" ON payout_requests;
CREATE POLICY "pr_self" ON payout_requests
  FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 6. RPC — increment_product_views
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_product_views(p_produit_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE produits SET vues = COALESCE(vues, 0) + 1 WHERE id = p_produit_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 7. RPC — has_purchased_product
-- Retourne TRUE si l'utilisateur connecté a une commande
-- 'livree' ou 'confirmee' contenant ce produit.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION has_purchased_product(p_produit_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM commande_items ci
    JOIN commandes c ON c.id = ci.commande_id
    WHERE ci.produit_id = p_produit_id
      AND c.user_id    = auth.uid()
      AND c.statut     IN ('livree','confirmee','completed')
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 8. RPC — get_seller_stats
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_seller_stats(p_user_id UUID)
RETURNS TABLE (
  nb_produits BIGINT,
  ventes      BIGINT,
  revenu      NUMERIC,
  ca_mois     NUMERIC,
  ruptures    BIGINT,
  vues        BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT p.id)                                          AS nb_produits,
    COUNT(DISTINCT ci.id)
      FILTER (WHERE c.statut IN ('confirmee','livree','completed')) AS ventes,
    COALESCE(SUM(ci.prix_unitaire * ci.quantite)
      FILTER (WHERE c.statut IN ('confirmee','livree','completed')), 0) AS revenu,
    COALESCE(SUM(ci.prix_unitaire * ci.quantite)
      FILTER (WHERE c.statut IN ('confirmee','livree','completed')
              AND date_trunc('month', c.created_at) = date_trunc('month', NOW())), 0) AS ca_mois,
    COUNT(DISTINCT p.id) FILTER (WHERE p.stock = 0)              AS ruptures,
    COALESCE(SUM(p.vues), 0)                                      AS vues
  FROM produits p
  LEFT JOIN commande_items ci ON ci.produit_id = p.id
  LEFT JOIN commandes c ON c.id = ci.commande_id
  WHERE p.user_id = p_user_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 9. RPC — create_pending_order
-- Crée une commande, réserve le stock atomiquement.
-- Appelé par panier.js AVANT l'ouverture du widget Kkiapay.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION create_pending_order(
  p_cart    JSONB,   -- [{"id": "<produit_id>", "qty": 2}, ...]
  p_address JSONB    -- {pays, ville, quartier, rue, telephone, nom_destinataire}
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_commande_id  UUID;
  v_total        NUMERIC := 0;
  v_item         JSONB;
  v_produit      RECORD;
  v_qty          INT;
BEGIN
  -- Créer la commande en statut initial
  INSERT INTO commandes (user_id, statut, adresse_livraison, total)
  VALUES (auth.uid(), 'en_attente_paiement', p_address, 0)
  RETURNING id INTO v_commande_id;

  -- Parcourir le panier et réserver le stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_cart)
  LOOP
    v_qty := (v_item->>'qty')::INT;

    -- Verrouiller la ligne produit pour éviter la double dépense
    SELECT * INTO v_produit FROM produits
    WHERE id = (v_item->>'id')::UUID
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produit introuvable : %', (v_item->>'id');
    END IF;

    IF v_produit.stock < v_qty THEN
      RAISE EXCEPTION 'Stock insuffisant pour "%". Disponible : %, demandé : %',
        v_produit.titre, v_produit.stock, v_qty;
    END IF;

    -- Déduire le stock
    UPDATE produits SET stock = stock - v_qty WHERE id = v_produit.id;

    -- Créer la ligne de commande
    INSERT INTO commande_items (
      commande_id, produit_id, titre, image_url,
      prix_unitaire, quantite, vendeur_id
    ) VALUES (
      v_commande_id, v_produit.id, v_produit.titre, v_produit.image_url,
      v_produit.prix, v_qty, v_produit.user_id
    );

    v_total := v_total + (v_produit.prix * v_qty);
  END LOOP;

  -- Mettre à jour le total
  UPDATE commandes SET total = v_total WHERE id = v_commande_id;

  RETURN jsonb_build_object('commande_id', v_commande_id, 'total', v_total);
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 10. RPC — cancel_pending_order
-- Appelé si le paiement Kkiapay échoue ou est annulé.
-- Restitue le stock et annule la commande.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cancel_pending_order(p_commande_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- Vérifier que la commande appartient bien à l'appelant
  IF NOT EXISTS (
    SELECT 1 FROM commandes
    WHERE id = p_commande_id
      AND user_id = auth.uid()
      AND statut = 'en_attente_paiement'
  ) THEN
    RAISE EXCEPTION 'Commande introuvable ou déjà traitée.';
  END IF;

  -- Restituer le stock pour chaque article
  FOR v_item IN
    SELECT produit_id, quantite FROM commande_items WHERE commande_id = p_commande_id
  LOOP
    UPDATE produits SET stock = stock + v_item.quantite WHERE id = v_item.produit_id;
  END LOOP;

  -- Annuler la commande
  UPDATE commandes SET statut = 'annulee' WHERE id = p_commande_id;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 11. RPC — mark_order_paid
-- !! APPELÉE PAR LA EDGE FUNCTION WEBHOOK KKIAPAY !!
-- NE PAS exposer côté client.
-- Confirme le paiement et crédite le pending_balance vendeur.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION mark_order_paid(
  p_commande_id          UUID,
  p_kkiapay_transaction  TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item   RECORD;
  v_wallet RECORD;
BEGIN
  -- Vérifier statut
  IF NOT EXISTS (
    SELECT 1 FROM commandes
    WHERE id = p_commande_id AND statut = 'en_attente_paiement'
  ) THEN
    RAISE EXCEPTION 'Commande introuvable ou déjà confirmée.';
  END IF;

  -- Confirmer la commande
  UPDATE commandes
  SET statut = 'confirmee',
      kkiapay_transaction_id = p_kkiapay_transaction,
      paid_at = NOW()
  WHERE id = p_commande_id;

  -- Pour chaque vendeur impliqué, créditer le pending_balance
  FOR v_item IN
    SELECT DISTINCT vendeur_id,
      SUM(prix_unitaire * quantite) AS montant
    FROM commande_items
    WHERE commande_id = p_commande_id
    GROUP BY vendeur_id
  LOOP
    -- Créer le wallet si inexistant
    INSERT INTO wallets (user_id) VALUES (v_item.vendeur_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_item.vendeur_id FOR UPDATE;

    UPDATE wallets
    SET pending_balance = pending_balance + v_item.montant,
        total_earned    = total_earned    + v_item.montant,
        updated_at      = NOW()
    WHERE user_id = v_item.vendeur_id;

    INSERT INTO wallet_transactions (
      wallet_id, order_id, type, amount, status,
      to_balance_type, description
    ) VALUES (
      v_wallet.id, p_commande_id, 'order_payment', v_item.montant,
      'completed', 'pending',
      'Paiement commande #' || LEFT(p_commande_id::TEXT, 8)
    );
  END LOOP;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 12. RPC — release_escrow
-- Appelée quand l'acheteur confirme la réception
-- OU automatiquement 10j après livraison (via pg_cron ou Edge Function).
-- Commission plateforme : 5%.
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION release_escrow(p_commande_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item        RECORD;
  v_wallet      RECORD;
  v_commission  NUMERIC;
  v_net         NUMERIC;
BEGIN
  UPDATE commandes SET statut = 'completed' WHERE id = p_commande_id;

  FOR v_item IN
    SELECT DISTINCT vendeur_id,
      SUM(prix_unitaire * quantite) AS montant
    FROM commande_items
    WHERE commande_id = p_commande_id
    GROUP BY vendeur_id
  LOOP
    v_commission := ROUND(v_item.montant * 0.05, 2);
    v_net        := v_item.montant - v_commission;

    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_item.vendeur_id FOR UPDATE;

    UPDATE wallets
    SET pending_balance   = pending_balance   - v_item.montant,
        available_balance = available_balance + v_net,
        updated_at        = NOW()
    WHERE user_id = v_item.vendeur_id;

    INSERT INTO wallet_transactions (wallet_id, order_id, type, amount, status, from_balance_type, to_balance_type, description)
    VALUES (v_wallet.id, p_commande_id, 'escrow_release', v_item.montant, 'completed', 'pending', 'available',
            'Libération escrow commande #' || LEFT(p_commande_id::TEXT, 8));

    INSERT INTO wallet_transactions (wallet_id, order_id, type, amount, status, description)
    VALUES (v_wallet.id, p_commande_id, 'commission_deduction', v_commission, 'completed',
            'Commission Afima 5%');
  END LOOP;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 13. RPC — decide_verification (admin KYC)
-- ──────────────────────────────────────────────────────────────
-- NOTE : cette RPC existe probablement déjà dans ton projet.
-- Vérifie avant de l'exécuter.

CREATE OR REPLACE FUNCTION decide_verification(
  p_verif_id    UUID,
  p_statut      TEXT,   -- 'approuve' | 'rejete'
  p_motif_rejet TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Vérifier que l'appelant est admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Accès refusé.';
  END IF;

  UPDATE verifications_vendeur
  SET statut = p_statut,
      motif_rejet = p_motif_rejet,
      decided_at = NOW()
  WHERE id = p_verif_id;

  -- Si approuvé, mettre à jour le profil vendeur
  IF p_statut = 'approuve' THEN
    UPDATE profiles
    SET is_verified_seller = TRUE
    WHERE id = (SELECT user_id FROM verifications_vendeur WHERE id = p_verif_id);
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- 14. COLONNES manquantes — TABLE commandes
-- ──────────────────────────────────────────────────────────────

ALTER TABLE commandes
  ADD COLUMN IF NOT EXISTS kkiapay_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS paid_at                TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adresse_livraison       JSONB;

-- Assurer que le champ statut accepte tous les états du CDC
-- (si c'est un CHECK constraint existant, adapte selon ta migration)
-- ALTER TABLE commandes DROP CONSTRAINT IF EXISTS commandes_statut_check;
-- ALTER TABLE commandes ADD CONSTRAINT commandes_statut_check
--   CHECK (statut IN ('en_attente_paiement','confirmee','en_preparation',
--                     'expediee','en_transit','livree','confirmee_acheteur',
--                     'completed','annulee'));


-- ──────────────────────────────────────────────────────────────
-- 15. TABLE commande_items — colonnes manquantes
-- ──────────────────────────────────────────────────────────────

ALTER TABLE commande_items
  ADD COLUMN IF NOT EXISTS vendeur_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS titre      TEXT,
  ADD COLUMN IF NOT EXISTS image_url  TEXT;

CREATE INDEX IF NOT EXISTS idx_commande_items_vendeur ON commande_items(vendeur_id);


-- ──────────────────────────────────────────────────────────────
-- 16. TABLE profiles — colonne is_verified_seller
-- ──────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_verified_seller BOOLEAN DEFAULT FALSE;


-- ──────────────────────────────────────────────────────────────
-- 17. Edge Function — Webhook Kkiapay
-- ──────────────────────────────────────────────────────────────
-- À créer dans : supabase/functions/kkiapay-webhook/index.ts
-- Voir le fichier supabase/functions/kkiapay-webhook/index.ts
-- créé par ce projet.
-- Cette fonction reçoit le webhook Kkiapay, vérifie la signature,
-- puis appelle mark_order_paid(commande_id, transaction_id).


-- ──────────────────────────────────────────────────────────────
-- FIN DES MIGRATIONS
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
-- 18. TABLE notifications
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'systeme'
             CHECK (type IN ('systeme','commande','message','litige','paiement','verification')),
  titre      TEXT NOT NULL,
  message    TEXT,
  link       TEXT,        -- URL relative, ex: "commandes.html" ou "litige.html?id=..."
  read       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user_id    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notif_user_read  ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notif_created    ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_self" ON notifications;
CREATE POLICY "notif_self" ON notifications
  FOR ALL USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 19. TRIGGERS — Créer automatiquement des notifications
-- ──────────────────────────────────────────────────────────────

-- 19a. Notification pour l'acheteur quand le statut de sa commande change
CREATE OR REPLACE FUNCTION notify_commande_statut()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_titre  TEXT;
  v_msg    TEXT;
  v_link   TEXT;
BEGIN
  IF OLD.statut = NEW.statut THEN RETURN NEW; END IF;

  v_link := 'commandes.html';

  CASE NEW.statut
    WHEN 'confirmee'         THEN v_titre := 'Commande confirmée'; v_msg := 'Votre paiement a été reçu. Le vendeur prépare votre commande.';
    WHEN 'en_preparation'    THEN v_titre := 'Commande en préparation'; v_msg := 'Le vendeur prépare votre colis.';
    WHEN 'expediee'          THEN v_titre := 'Commande expédiée'; v_msg := 'Votre colis a été expédié.';
    WHEN 'en_transit'        THEN v_titre := 'Commande en transit'; v_msg := 'Votre colis est en route.';
    WHEN 'livree'            THEN v_titre := 'Commande livrée'; v_msg := 'Votre colis a été livré. Confirmez la réception pour libérer le paiement.';
    WHEN 'annulee'           THEN v_titre := 'Commande annulée'; v_msg := 'Votre commande a été annulée.';
    WHEN 'completed'         THEN v_titre := 'Commande terminée'; v_msg := 'La transaction est terminée. Merci pour votre achat !';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO notifications(user_id, type, titre, message, link)
  VALUES (NEW.user_id, 'commande', v_titre, v_msg, v_link);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commande ON commandes;
CREATE TRIGGER trg_notify_commande
  AFTER UPDATE OF statut ON commandes
  FOR EACH ROW EXECUTE FUNCTION notify_commande_statut();


-- 19b. Notification pour le vendeur quand une nouvelle commande est passée
CREATE OR REPLACE FUNCTION notify_vendeur_nouvelle_commande()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_vendeur UUID;
BEGIN
  -- Notifier chaque vendeur distinct impliqué
  FOR v_vendeur IN
    SELECT DISTINCT vendeur_id FROM commande_items WHERE commande_id = NEW.id
  LOOP
    IF v_vendeur IS NOT NULL THEN
      INSERT INTO notifications(user_id, type, titre, message, link)
      VALUES (
        v_vendeur, 'commande',
        'Nouvelle commande reçue',
        'Un acheteur vient de passer une commande. Consultez votre tableau de bord.',
        'dashboard.html'
      );
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_vendeur ON commandes;
CREATE TRIGGER trg_notify_vendeur
  AFTER INSERT ON commandes
  FOR EACH ROW EXECUTE FUNCTION notify_vendeur_nouvelle_commande();


-- 19c. Notification quand un litige est ouvert (pour le vendeur)
CREATE OR REPLACE FUNCTION notify_litige_ouvert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Notifier le vendeur
  INSERT INTO notifications(user_id, type, titre, message, link)
  VALUES (
    NEW.vendeur_id, 'litige',
    'Litige ouvert',
    'Un acheteur a signalé un problème avec l''une de vos commandes.',
    'litiges.html?id=' || NEW.id::TEXT
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_litige ON litiges;
CREATE TRIGGER trg_notify_litige
  AFTER INSERT ON litiges
  FOR EACH ROW EXECUTE FUNCTION notify_litige_ouvert();


-- 19d. Notification quand un litige est résolu (acheteur + vendeur)
CREATE OR REPLACE FUNCTION notify_litige_resolu()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.statut = NEW.statut THEN RETURN NEW; END IF;
  IF NEW.statut NOT IN ('resolu_acheteur','resolu_vendeur','rejete') THEN RETURN NEW; END IF;

  -- Notifier l'acheteur
  INSERT INTO notifications(user_id, type, titre, message, link)
  VALUES (NEW.acheteur_id, 'litige', 'Litige résolu', 'Une décision a été rendue pour votre litige.',
          'litiges.html?id=' || NEW.id::TEXT);

  -- Notifier le vendeur
  INSERT INTO notifications(user_id, type, titre, message, link)
  VALUES (NEW.vendeur_id, 'litige', 'Litige résolu', 'Une décision a été rendue pour le litige.',
          'litiges.html?id=' || NEW.id::TEXT);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_litige_resolu ON litiges;
CREATE TRIGGER trg_notify_litige_resolu
  AFTER UPDATE OF statut ON litiges
  FOR EACH ROW EXECUTE FUNCTION notify_litige_resolu();


-- 19e. Notification paiement reçu (vendeur — après escrow credit)
CREATE OR REPLACE FUNCTION notify_paiement_vendeur()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Déclenché sur wallet_transactions de type escrow_release (argent disponible)
  IF NEW.type = 'escrow_release' AND NEW.status = 'completed' THEN
    INSERT INTO notifications(user_id, type, titre, message, link)
    SELECT w.user_id, 'paiement',
           'Paiement disponible',
           'Des fonds ont été libérés sur votre portefeuille.',
           'wallet.html'
    FROM wallets w WHERE w.id = NEW.wallet_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_paiement ON wallet_transactions;
CREATE TRIGGER trg_notify_paiement
  AFTER INSERT ON wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION notify_paiement_vendeur();


-- ──────────────────────────────────────────────────────────────
-- FIN DES MIGRATIONS NOTIFICATIONS
-- ──────────────────────────────────────────────────────────────


-- ──────────────────────────────────────────────────────────────
-- 20. RPC — request_withdrawal (appelée par wallet.js)
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION request_withdrawal(
  p_amount            NUMERIC,
  p_payment_method_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet RECORD;
  v_fee    NUMERIC;
  v_net    NUMERIC;
BEGIN
  IF p_amount < 2500 THEN
    RAISE EXCEPTION 'Montant minimum : 2 500 FCFA';
  END IF;

  SELECT * INTO v_wallet FROM wallets
  WHERE user_id = auth.uid() FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portefeuille introuvable.';
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'Solde disponible insuffisant (disponible : % FCFA).', v_wallet.available_balance;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM payment_methods
    WHERE id = p_payment_method_id AND user_id = auth.uid() AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Moyen de paiement invalide.';
  END IF;

  v_fee := ROUND(p_amount * 0.05, 2);
  v_net := p_amount - v_fee;

  -- Déduire du solde disponible
  UPDATE wallets
  SET available_balance = available_balance - p_amount,
      updated_at        = NOW()
  WHERE id = v_wallet.id;

  -- Créer la demande de retrait
  INSERT INTO payout_requests(user_id, amount, fee, net_amount, payment_method_id, status)
  VALUES (auth.uid(), p_amount, v_fee, v_net, p_payment_method_id, 'pending');

  -- Créer la transaction wallet
  INSERT INTO wallet_transactions(wallet_id, type, amount, status, from_balance_type, description)
  VALUES (v_wallet.id, 'withdrawal_request', p_amount, 'pending', 'available',
          'Retrait demandé — en attente de traitement');
END;
$$;
