const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUserId = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showMsg(text, type) {
  const el = document.getElementById('litigeMsg');
  if (!el) return;
  el.textContent = text;
  el.className = 'litige-msg ' + (type === 'error' ? 'litige-msg-error' : 'litige-msg-success');
  el.classList.remove('hidden');
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

// ── MODE CRÉATION ──
function renderFormulaire(commandeItemId) {
  const content = document.getElementById('litige-content');
  content.innerHTML = `
    <h1 class="commandes-title"><i data-lucide="shield-alert"></i> Signaler un problème</h1>
    <form id="litigeForm" class="litige-form">
      <label for="litigeMotif">Motif</label>
      <select id="litigeMotif" required>
        <option value="">Choisissez un motif</option>
        <option value="Produit non reçu">Produit non reçu</option>
        <option value="Produit non conforme à la description">Produit non conforme à la description</option>
        <option value="Produit endommagé">Produit endommagé</option>
        <option value="Retard de livraison important">Retard de livraison important</option>
        <option value="Autre">Autre</option>
      </select>

      <label for="litigeDescription">Décrivez le problème</label>
      <textarea id="litigeDescription" rows="5" placeholder="Expliquez ce qui s'est passé, en détail." required></textarea>

      <p id="litigeMsg" class="litige-msg hidden"></p>

      <button type="submit" class="btn btn-primary" id="btnLitigeSubmit">Envoyer le signalement</button>
    </form>`;
  lucide.createIcons();

  document.getElementById('litigeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLitigeSubmit');
    btn.disabled = true;

    try {
      const motif = document.getElementById('litigeMotif').value;
      const description = document.getElementById('litigeDescription').value.trim();

      const litigeId = await Litiges.createLitige({
        supabaseClient,
        commandeItemId,
        motif,
        description
      });

      window.location.href = `litige.html?id=${encodeURIComponent(litigeId)}`;
    } catch (err) {
      showMsg('Erreur : ' + (err.message || 'impossible d\'envoyer le signalement.'), 'error');
      btn.disabled = false;
    }
  });
}

// ── MODE CONSULTATION ──
async function renderDetail(litigeId) {
  const content = document.getElementById('litige-content');

  let litige;
  try {
    litige = await Litiges.getLitige({ supabaseClient, litigeId });
  } catch (err) {
    content.innerHTML = `<div class="commandes-empty"><p>Litige introuvable, ou vous n'avez pas accès à celui-ci.</p></div>`;
    return;
  }

  const statut = Litiges.STATUTS[litige.statut] || { label: litige.statut, css: 'litige-inconnu' };
  const produit = litige.commande_items || {};
  const estAcheteur = litige.acheteur_id === currentUserId;
  const peutAjouterPreuve = ['ouvert', 'en_cours'].includes(litige.statut) &&
    (litige.acheteur_id === currentUserId || litige.vendeur_id === currentUserId);

  const date = new Date(litige.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  content.innerHTML = `
    <h1 class="commandes-title"><i data-lucide="shield-alert"></i> ${escapeHtml(litige.motif)}</h1>

    <div class="commande-card litige-detail-card">
      <div class="commande-item">
        <img class="commande-item-img"
             src="${escapeHtml(produit.image_url || 'https://placehold.co/56x56/f3f4f6/9ca3af?text=?')}"
             alt="${escapeHtml(produit.titre || '')}" loading="lazy">
        <div class="commande-item-info">
          <p class="commande-item-titre">${escapeHtml(produit.titre || '')}</p>
          <p class="commande-item-detail">Ouvert le ${date} · ${estAcheteur ? 'Vous êtes l\'acheteur' : 'Vous êtes le vendeur'}</p>
        </div>
        <span class="litige-statut ${statut.css}">${escapeHtml(statut.label)}</span>
      </div>

      <p class="litige-description">${escapeHtml(litige.description || 'Aucune description fournie.')}</p>

      ${litige.decision ? `
        <div class="litige-decision">
          <strong>Décision d'afima :</strong>
          <p>${escapeHtml(litige.decision)}</p>
        </div>` : ''}
    </div>

    <section id="litigeAdminSection" class="litige-admin-section hidden"></section>

    <section class="litige-preuves-section">
      <h2>Preuves</h2>
      <div id="litigePreuvesList" class="litige-preuves-list">
        ${litige.preuves.length === 0 ? '<p class="litige-preuves-vide">Aucune preuve envoyée pour l\'instant.</p>' : ''}
      </div>

      ${peutAjouterPreuve ? `
        <div class="litige-preuve-upload">
          <label for="litigePreuveFile" class="btn btn-outline">
            <i data-lucide="upload"></i> Ajouter une photo ou une vidéo
          </label>
          <input type="file" id="litigePreuveFile" accept="image/*,video/*" class="hidden">
          <p id="litigePreuveMsg" class="litige-msg hidden"></p>
        </div>` : ''}
    </section>`;

  lucide.createIcons();
  await renderPreuves(litige.preuves);
  await renderAdminSection(litige);

  const fileInput = document.getElementById('litigePreuveFile');
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const msgEl = document.getElementById('litigePreuveMsg');

    try {
      await Litiges.uploadPreuve({ supabaseClient, litigeId, userId: currentUserId, file });
      await renderDetail(litigeId); // recharge pour afficher la nouvelle preuve
    } catch (err) {
      msgEl.textContent = 'Erreur : ' + (err.message || 'envoi impossible.');
      msgEl.className = 'litige-msg litige-msg-error';
      msgEl.classList.remove('hidden');
    }
  });
}

async function renderAdminSection(litige) {
  const section = document.getElementById('litigeAdminSection');
  if (!section) return;

  const admin = await Litiges.isAdmin({ supabaseClient, userId: currentUserId });
  const enAttente = ['ouvert', 'en_cours'].includes(litige.statut);
  if (!admin || !enAttente) return;

  section.classList.remove('hidden');
  section.innerHTML = `
    <h2>Décision (admin)</h2>
    <form id="litigeAdminForm" class="litige-form">
      <label for="litigeAdminStatut">Résolution</label>
      <select id="litigeAdminStatut" required>
        <option value="">Choisissez une résolution</option>
        <option value="resolu_acheteur">En faveur de l'acheteur</option>
        <option value="resolu_vendeur">En faveur du vendeur</option>
        <option value="rejete">Rejeter le litige</option>
      </select>

      <label for="litigeAdminDecision">Motivation de la décision</label>
      <textarea id="litigeAdminDecision" rows="4" placeholder="Visible par l'acheteur et le vendeur." required></textarea>

      <p id="litigeAdminMsg" class="litige-msg hidden"></p>

      <button type="submit" class="btn btn-primary" id="btnLitigeAdminSubmit">Trancher le litige</button>
    </form>`;
  lucide.createIcons();

  document.getElementById('litigeAdminForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnLitigeAdminSubmit');
    btn.disabled = true;
    const msgEl = document.getElementById('litigeAdminMsg');

    try {
      await Litiges.resolveLitige({
        supabaseClient,
        litigeId: litige.id,
        statut: document.getElementById('litigeAdminStatut').value,
        decision: document.getElementById('litigeAdminDecision').value.trim(),
        resolvedBy: currentUserId
      });
      await renderDetail(litige.id); // recharge pour afficher la décision figée
    } catch (err) {
      msgEl.textContent = 'Erreur : ' + (err.message || 'impossible d\'enregistrer la décision.');
      msgEl.className = 'litige-msg litige-msg-error';
      msgEl.classList.remove('hidden');
      btn.disabled = false;
    }
  });
}

async function renderPreuves(preuves) {
  if (!preuves || preuves.length === 0) return;
  const container = document.getElementById('litigePreuvesList');

  const items = await Promise.all(preuves.map(async (p) => {
    try {
      const url = await Litiges.getPreuveUrl({ supabaseClient, filePath: p.file_path });
      return p.file_type === 'video'
        ? `<video class="litige-preuve-media" src="${url}" controls></video>`
        : `<a href="${url}" target="_blank" rel="noopener"><img class="litige-preuve-media" src="${url}" alt="Preuve"></a>`;
    } catch {
      return '';
    }
  }));

  container.innerHTML = items.filter(Boolean).join('');
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  const total = await Cart.getCartCount({ supabaseClient, userId: currentUserId });
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  const params = new URLSearchParams(window.location.search);
  const litigeId = params.get('id');
  const commandeItemId = params.get('commande_item_id');

  if (litigeId) {
    await renderDetail(litigeId);
  } else if (commandeItemId) {
    renderFormulaire(commandeItemId);
  } else {
    document.getElementById('litige-content').innerHTML =
      '<div class="commandes-empty"><p>Aucun litige ou commande spécifié.</p></div>';
  }
}

init();