/**
 * AFIMA — Edge Function : Webhook Kkiapay
 *
 * Cette fonction reçoit la confirmation de paiement de Kkiapay,
 * vérifie la signature HMAC, puis appelle la RPC mark_order_paid()
 * pour confirmer la commande et créditer le wallet du vendeur.
 *
 * DÉPLOIEMENT :
 *   supabase functions deploy kkiapay-webhook
 *
 * VARIABLE D'ENVIRONNEMENT REQUISE (à configurer dans Supabase > Edge Functions > Secrets) :
 *   KKIAPAY_SECRET_KEY = ta_cle_secrete_kkiapay  ← NE JAMAIS mettre côté client
 *
 * KKIAPAY — Configuration du webhook :
 *   URL : https://<project>.supabase.co/functions/v1/kkiapay-webhook
 *   Événement : payment.success
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Clé secrète Kkiapay (depuis les secrets Supabase — jamais en dur) ──
// TODO : Remplace "ta_cle_secrete_kkiapay" par ta vraie clé secrète dans
//        les secrets Supabase (Settings > Edge Functions > Secrets).
const KKIAPAY_SECRET_KEY = Deno.env.get('KKIAPAY_SECRET_KEY') ?? '';

// ── Client Supabase avec le service role key (accès complet) ──
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

serve(async (req: Request) => {
  // Kkiapay envoie des POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // ── Vérification de la signature Kkiapay ──
  // Kkiapay inclut une signature HMAC-SHA256 dans le header X-Kkiapay-Signature.
  // Si KKIAPAY_SECRET_KEY n'est pas encore définie, on laisse passer en mode dev.
  const signature = req.headers.get('x-kkiapay-signature') ?? '';
  if (KKIAPAY_SECRET_KEY) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(KKIAPAY_SECRET_KEY),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const rawBody = JSON.stringify(body);
    const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expected) {
      console.error('Signature Kkiapay invalide');
      return new Response('Unauthorized', { status: 401 });
    }
  }

  // ── Récupérer les données du paiement ──
  // La structure du payload Kkiapay : { transactionId, status, data: { ... } }
  const status        = body.status as string;
  const transactionId = body.transactionId as string;
  // L'identifiant de commande Afima est passé dans le champ "data" à l'ouverture du widget
  const commandeId    = (body.data as Record<string, string>)?.commande_id;

  if (status !== 'SUCCESS') {
    // Paiement échoué ou annulé — rien à faire, le stock a déjà été restitué côté client
    return new Response('OK', { status: 200 });
  }

  if (!commandeId) {
    console.error('commande_id manquant dans le payload Kkiapay');
    return new Response('Bad Request', { status: 400 });
  }

  // ── Confirmer la commande et créditer le wallet vendeur ──
  const { error } = await supabaseAdmin.rpc('mark_order_paid', {
    p_commande_id:         commandeId,
    p_kkiapay_transaction: transactionId,
  });

  if (error) {
    console.error('Erreur mark_order_paid :', error.message);
    return new Response('Internal Error', { status: 500 });
  }

  console.log(`Commande ${commandeId} confirmée — transaction Kkiapay ${transactionId}`);
  return new Response('OK', { status: 200 });
});
