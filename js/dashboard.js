// supabaseClient est exposé par js/supabase.js (window.supabaseClient)
const sb = window.supabaseClient;

let allProduits = [];
let deleteTargetId = null;
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

function formatPriceValue(value) {
  if (typeof window.Currency?.formatPrice === 'function') {
    return window.Currency.formatPrice(value);
  }
  const numericValue = Number(value) || 0;
  return `${numericValue.toLocaleString('fr-FR')} FCFA`;
}

// ── HAMBURGER ──

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  currentUserId = session.user.id;

  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  const { data: profile } = await sb.from('profiles').select('full_name').eq('id', currentUserId).single();
  const displayName = profile?.full_name || session.user.email.split('@')[0];
  startGreetingRefresh('dashWelcome', displayName);

  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = getFormattedDate();

  await loadStats();
  await loadProduits();
  await loadCommandesVendeur();

  if (window.Notifications?.initNotifBell) {
    window.Notifications.initNotifBell({ supabaseClient: sb, userId: currentUserId });
  }

  document.getElementById('dashSearch').addEventListener('input', e => renderTable(e.target.value));
}

async function loadStats() {
    try {
        const { data, error } = await sb.rpc('get_seller_stats', {
            p_user_id: currentUserId
        });
        if (error) throw error;
        const stats = data && data[0] ? data[0] : {
            nb_produits: 0, ventes: 0, revenu: 0, ca_mois: 0, ruptures: 0, vues: 0
        };
        document.getElementById('statProduits').textContent = stats.nb_produits;
        document.getElementById('statVentes').textContent   = stats.ventes;
        document.getElementById('statRevenu').textContent   = formatPriceValue(stats.revenu);
        document.getElementById('statCaMois').textContent   = formatPriceValue(stats.ca_mois);
        document.getElementById('statRupture').textContent  = stats.ruptures;
        document.getElementById('statVues').textContent     = stats.vues;
    } catch (err) {
        console.warn('Erreur chargement statistiques :', err.message);
        showMsg('Impossible de charger les statistiques.', 'error');
    }
}

async function loadCommandesVendeur() {
  const container = document.getElementById('commandesVendeurList');
  if (!container) return;

  // Commandes où le vendeur a au moins un article
  const { data, error } = await sb
    .from('commande_items')
    .select('commande_id, titre, image_url, prix_unitaire, quantite, commandes(id, statut, created_at, adresse_livraison, user_id)')
    .eq('vendeur_id', currentUserId)
    .order('commande_id', { ascending: false });

  if (error) {
    container.innerHTML = `<p style="color:#dc2626;padding:16px">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }

  // Grouper par commande
  const commandesMap = new Map();
  (data || []).forEach(item => {
    const cmd = item.commandes;
    if (!cmd) return;
    if (!commandesMap.has(cmd.id)) commandesMap.set(cmd.id, { ...cmd, items: [] });
    commandesMap.get(cmd.id).items.push(item);
  });

  const commandes = Array.from(commandesMap.values());

  if (!commandes.length) {
    container.innerHTML = `<p style="padding:16px;color:#6b7280">Aucune commande reçue pour l'instant.</p>`;
    return;
  }

  const STATUTS_VENDEUR = {
    confirmee:          { label: 'Confirmée — à préparer',  next: 'en_preparation', nextLabel: 'Marquer En préparation' },
    en_preparation:     { label: 'En préparation',          next: 'expediee',       nextLabel: 'Marquer Expédiée' },
    expediee:           { label: 'Expédiée',                next: 'en_transit',     nextLabel: 'Marquer En transit' },
    en_transit:         { label: 'En transit',              next: null,             nextLabel: null },
    livree:             { label: 'Livrée',                  next: null,             nextLabel: null },
    confirmee_acheteur: { label: 'Réception confirmée',     next: null,             nextLabel: null },
    completed:          { label: 'Terminée',                next: null,             nextLabel: null },
    annulee:            { label: 'Annulée',                 next: null,             nextLabel: null },
    en_attente_paiement:{ label: 'En attente de paiement',  next: null,             nextLabel: null },
  };

  container.innerHTML = commandes.map(cmd => {
    const s = STATUTS_VENDEUR[cmd.statut] || { label: cmd.statut, next: null };
    const date = new Date(cmd.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
    const itemsHtml = cmd.items.map(it => `
      <div class="commande-item" style="pointer-events:none">
        <img class="commande-item-img" src="${escapeHtml(it.image_url || 'https://placehold.co/48x48')}" alt="${escapeHtml(it.titre || '')}" loading="lazy">
        <div class="commande-item-info">
          <p class="commande-item-titre">${escapeHtml(it.titre || '')}</p>
          <p class="commande-item-detail">Qté : ${it.quantite} × ${formatPriceValue(it.prix_unitaire)}</p>
        </div>
      </div>`).join('');
    const adresse = cmd.adresse_livraison
      ? escapeHtml([cmd.adresse_livraison.nom_destinataire, cmd.adresse_livraison.rue, cmd.adresse_livraison.ville].filter(Boolean).join(', '))
      : '—';

    return `
      <div class="commande-card" id="cmd-${escapeHtml(cmd.id)}">
        <div class="commande-header">
          <span class="commande-id">#${escapeHtml(cmd.id.slice(0, 8).toUpperCase())}</span>
          <span class="commande-date"><i data-lucide="calendar"></i> ${date}</span>
          <span class="commande-statut">${escapeHtml(s.label)}</span>
        </div>
        ${itemsHtml}
        <div class="commande-footer" style="gap:.5rem;flex-wrap:wrap">
          <span style="color:#6b7280;font-size:.85rem"><i data-lucide="map-pin" style="width:14px;height:14px"></i> ${adresse}</span>
          ${s.next ? `<button class="btn btn-primary" style="font-size:.85rem;padding:.4rem .9rem" data-cmd="${escapeHtml(cmd.id)}" data-next="${s.next}" onclick="avancerStatut(this)">
            <i data-lucide="arrow-right"></i> ${s.nextLabel}
          </button>` : ''}
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

async function avancerStatut(btn) {
  const commandeId = btn.dataset.cmd;
  const nextStatut = btn.dataset.next;
  btn.disabled = true;
  const { error } = await sb.from('commandes').update({ statut: nextStatut }).eq('id', commandeId);
  if (error) {
    showMsg('Erreur : ' + error.message, 'error');
    btn.disabled = false;
    return;
  }
  await loadCommandesVendeur();
}

async function loadProduits() {
  const { data, error } = await sb.from('produits').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
  if (error) { showMsg('Erreur : ' + error.message, 'error'); return; }
  allProduits = data || [];
  renderTable('');
}

function renderTable(query) {
  const tbody = document.getElementById('dashTableBody');
  const list  = allProduits.filter(p =>
    p.titre.toLowerCase().includes(query.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(query.toLowerCase())
  );

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:#6b7280;font-weight:500;">
      ${query ? 'Aucun résultat.' : 'Vous n\'avez pas encore de produits. <a href="ajouter-produit.html" style="color:#111;font-weight:700;">Publier un produit →</a>'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(p => {
    const stockClass = p.stock === 0 ? 'stock-out' : p.stock <= 3 ? 'stock-low' : 'stock-ok';
    const stockLabel = p.stock === 0 ? 'Rupture' : p.stock <= 3 ? `${p.stock} restant(s)` : `${p.stock} en stock`;
    const titreSafe = escapeHtml(p.titre);
    return `
      <tr>
        <td data-label="Produit">
          <div class="td-produit">
            <img class="td-img" src="${escapeHtml(p.image_url || 'https://placehold.co/48x48/f3f4f6/9ca3af?text=?')}" alt="${titreSafe}" loading="lazy">
            <span class="td-titre">${titreSafe}</span>
          </div>
        </td>
        <td data-label="Prix" class="td-prix">${formatPriceValue(p.prix)}</td>
        <td data-label="Stock"><span class="stock-badge ${stockClass}">${stockLabel}</span></td>
        <td data-label="Statut"><span class="stock-badge ${p.stock > 0 ? 'stock-ok' : 'stock-out'}">${p.stock > 0 ? 'En ligne' : 'Hors stock'}</span></td>
        <td data-label="Actions">
          <div class="td-actions">
            <button class="btn-icon" onclick="openEdit('${p.id}')" title="Modifier"><i data-lucide="pencil"></i></button>
            <button class="btn-icon danger" onclick="openDelete('${p.id}')" title="Supprimer"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
  lucide.createIcons();
}

// ── MODAL MODIFIER ──
function openEdit(id) {
  const p = allProduits.find(x => String(x.id) === String(id));
  if (!p) return;
  document.getElementById('editId').value          = p.id;
  document.getElementById('editTitre').value       = p.titre;
  document.getElementById('editDescription').value = p.description || '';
  document.getElementById('editPrix').value        = p.prix;
  document.getElementById('editStock').value       = p.stock;
  document.getElementById('editImageUrl').value    = p.image_url || '';
  document.getElementById('editModal').classList.remove('hidden');
}

function closeEdit() { document.getElementById('editModal').classList.add('hidden'); }

document.getElementById('editModalClose').addEventListener('click', closeEdit);
document.getElementById('editCancel').addEventListener('click', closeEdit);
document.getElementById('editModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeEdit(); });

document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('editSubmit');

  const id     = document.getElementById('editId').value;
  const titre  = document.getElementById('editTitre').value.trim();
  const prix   = parseInt(document.getElementById('editPrix').value, 10);
  const stock  = parseInt(document.getElementById('editStock').value, 10);

  if (!titre) { showMsg('Le titre est obligatoire.', 'error'); return; }
  if (isNaN(prix) || prix < 0) { showMsg('Prix invalide.', 'error'); return; }
  if (isNaN(stock) || stock < 0) { showMsg('Stock invalide.', 'error'); return; }

  btn.disabled = true;

  const payload = {
    titre,
    description: document.getElementById('editDescription').value.trim(),
    prix,
    stock,
    image_url: document.getElementById('editImageUrl').value.trim() || null,
  };

  // Filtre user_id en défense en profondeur — la vraie garantie vient
  // des policies RLS, mais ça évite un aller-retour serveur inutile
  // si jamais un id ne nous appartient pas.
  const { error } = await sb.from('produits').update(payload).eq('id', id).eq('user_id', currentUserId);

  btn.disabled = false;
  if (error) { showMsg('Erreur : ' + error.message, 'error'); return; }

  const idx = allProduits.findIndex(x => String(x.id) === String(id));
  if (idx !== -1) allProduits[idx] = { ...allProduits[idx], ...payload };

  closeEdit();
  renderTable(document.getElementById('dashSearch').value);
  showMsg('Produit modifié avec succès.', 'success');
});

// ── MODAL SUPPRIMER ──
function openDelete(id) {
  deleteTargetId = id;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDelete() { document.getElementById('deleteModal').classList.add('hidden'); deleteTargetId = null; }

document.getElementById('deleteModalClose').addEventListener('click', closeDelete);
document.getElementById('deleteCancel').addEventListener('click', closeDelete);
document.getElementById('deleteModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeDelete(); });

document.getElementById('deleteConfirm').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  const btn = document.getElementById('deleteConfirm');
  btn.disabled = true;

  const { error } = await sb.from('produits').delete().eq('id', deleteTargetId).eq('user_id', currentUserId);
  btn.disabled = false;
  if (error) { showMsg('Erreur : ' + error.message, 'error'); closeDelete(); return; }

  allProduits = allProduits.filter(p => String(p.id) !== String(deleteTargetId));
  closeDelete();
  renderTable(document.getElementById('dashSearch').value);
  showMsg('Produit supprimé.', 'success');

  document.getElementById('statProduits').textContent = allProduits.length;
});

function showMsg(text, type) {
  const box = document.getElementById('dashMessage');
  box.textContent = text;
  box.className = `dash-msg ${type}`;
  setTimeout(() => box.className = 'dash-msg hidden', 4000);
}

async function logout() { await sb.auth.signOut(); window.location.href = '../index.html'; }

init();