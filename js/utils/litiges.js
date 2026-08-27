const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── HAMBURGER ──
const navToggle  = document.getElementById('navToggle');
const mobileMenu = document.getElementById('mobileMenu');
navToggle?.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('hidden') === false;
  navToggle.querySelector('.icon-menu')?.classList.toggle('hidden', open);
  navToggle.querySelector('.icon-close')?.classList.toggle('hidden', !open);
  navToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', e => {
  if (mobileMenu && !mobileMenu.classList.contains('hidden') &&
      !navToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
    mobileMenu.classList.add('hidden');
    navToggle.querySelector('.icon-menu')?.classList.remove('hidden');
    navToggle.querySelector('.icon-close')?.classList.add('hidden');
    navToggle.setAttribute('aria-expanded', 'false');
  }
});

async function renderLitiges(userId) {
  const litiges = await Litiges.getMesLitiges({ supabaseClient, userId });
  const list = document.getElementById('litiges-list');

  if (litiges.length === 0) {
    list.innerHTML = `
      <div class="commandes-empty">
        <p>Vous n'avez aucun litige en cours. Tant mieux !</p>
        <a href="commandes.html" class="btn btn-primary">Voir mes commandes</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  list.innerHTML = litiges.map(l => {
    const statut = Litiges.STATUTS[l.statut] || { label: l.statut, css: 'litige-inconnu' };
    const date = new Date(l.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const role = l.acheteur_id === userId ? 'En tant qu\'acheteur' : 'En tant que vendeur';
    const produit = l.commande_items || {};

    return `
      <a class="commande-card litige-card" href="litige.html?id=${encodeURIComponent(l.id)}">
        <div class="commande-item">
          <img class="commande-item-img"
               src="${escapeHtml(produit.image_url || 'https://placehold.co/56x56/f3f4f6/9ca3af?text=?')}"
               alt="${escapeHtml(produit.titre || '')}" loading="lazy">
          <div class="commande-item-info">
            <p class="commande-item-titre">${escapeHtml(l.motif)}</p>
            <p class="commande-item-detail">${escapeHtml(produit.titre || '')} · ${role} · ${date}</p>
          </div>
          <span class="litige-statut ${statut.css}">${escapeHtml(statut.label)}</span>
        </div>
      </a>`;
  }).join('');

  lucide.createIcons();
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  const total = await Cart.getCartCount({ supabaseClient, userId: session.user.id });
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  await renderLitiges(session.user.id);
}

init();
// ── LITIGES (centre de résolution) ──
// Toutes les fonctions attendent { supabaseClient, ... } explicitement,
// même convention que Cart et Wishlist.

const LITIGE_STATUTS = {
  ouvert:            { label: 'Ouvert',              css: 'litige-ouvert'   },
  en_cours:          { label: 'En cours d\'examen',  css: 'litige-en-cours' },
  resolu_acheteur:   { label: 'Résolu en faveur de l\'acheteur', css: 'litige-resolu' },
  resolu_vendeur:    { label: 'Résolu en faveur du vendeur',     css: 'litige-resolu' },
  rejete:            { label: 'Rejeté',              css: 'litige-rejete'   },
};

// Ouvre un litige. Le serveur (RPC) vérifie que l'appelant est bien
// l'acheteur de la commande et calcule vendeur_id lui-même.
async function createLitige({ supabaseClient, commandeItemId, motif, description }) {
  const { data, error } = await supabaseClient.rpc('create_litige', {
    p_commande_item_id: commandeItemId,
    p_motif: motif,
    p_description: description || null
  });
  if (error) throw error;
  return data; // uuid du litige créé
}

// Litiges où l'utilisateur connecté est acheteur OU vendeur.
async function getMesLitiges({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from('litiges')
    .select('id, motif, statut, created_at, acheteur_id, vendeur_id, commande_items(titre, image_url)')
    .or(`acheteur_id.eq.${userId},vendeur_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data;
}

// Détail d'un litige + ses preuves. RLS garantit que seuls les deux
// parties et un admin peuvent le lire.
async function getLitige({ supabaseClient, litigeId }) {
  const { data: litige, error } = await supabaseClient
    .from('litiges')
    .select('*, commande_items(titre, image_url, prix_unitaire, quantite)')
    .eq('id', litigeId)
    .single();
  if (error) throw error;

  const { data: preuves, error: preuvesError } = await supabaseClient
    .from('litige_preuves')
    .select('id, uploaded_by, file_path, file_type, created_at')
    .eq('litige_id', litigeId)
    .order('created_at', { ascending: true });
  if (preuvesError) throw preuvesError;

  return { ...litige, preuves: preuves || [] };
}

async function uploadPreuve({ supabaseClient, litigeId, userId, file }) {
  const path = `${litigeId}/${userId}/${Date.now()}_${file.name}`;

  const { error: uploadError } = await supabaseClient
    .storage.from('litiges')
    .upload(path, file);
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabaseClient
    .from('litige_preuves')
    .insert([{
      litige_id: litigeId,
      uploaded_by: userId,
      file_path: path,
      file_type: file.type.startsWith('video') ? 'video' : 'image'
    }]);
  if (insertError) throw insertError;
}

async function getPreuveUrl({ supabaseClient, filePath }) {
  const { data, error } = await supabaseClient
    .storage.from('litiges')
    .createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ── Admin uniquement (RLS refuse silencieusement sinon) ──
async function isAdmin({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return false;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (error || !data) return false;
  return data.role === 'admin';
}

async function getLitigesOuverts({ supabaseClient }) {
  const { data, error } = await supabaseClient
    .from('litiges')
    .select('id, motif, statut, created_at, commande_items(titre, image_url)')
    .in('statut', ['ouvert', 'en_cours'])
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  return data;
}

async function resolveLitige({ supabaseClient, litigeId, statut, decision, resolvedBy }) {
  const { error } = await supabaseClient
    .from('litiges')
    .update({ statut, decision, resolved_by: resolvedBy, resolved_at: new Date().toISOString() })
    .eq('id', litigeId);
  if (error) throw error;
}

window.Litiges = {
  STATUTS: LITIGE_STATUTS,
  createLitige,
  getMesLitiges,
  getLitige,
  uploadPreuve,
  getPreuveUrl,
  isAdmin,
  getLitigesOuverts,
  resolveLitige
};