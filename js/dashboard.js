const SB_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SB_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SB_URL, SB_KEY);

let allProduits = [];
let deleteTargetId = null;

// ── HAMBURGER ──
initHamburger();

async function init() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const userId = session.user.id;

  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  // Profil nom et salutation dynamique
  const { data: profile } = await sb.from('profiles').select('full_name').eq('id', userId).single();
  const displayName = profile?.full_name || session.user.email.split('@')[0];
  startGreetingRefresh('dashWelcome', displayName);
  
  // Date du jour
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = getFormattedDate();

  await loadStats(userId);
  await loadProduits(userId);

  document.getElementById('dashSearch').addEventListener('input', e => renderTable(e.target.value));
}

async function loadStats(userId) {
  const { data: produits } = await sb.from('produits').select('id, stock').eq('user_id', userId);
  const { data: commandes } = await sb.from('commande_items')
    .select('quantite, prix_unitaire, commande_id, commandes!inner(user_id)')
    .eq('commandes.user_id', userId);

  const nbProduits = produits?.length || 0;
  const ruptures   = produits?.filter(p => p.stock === 0).length || 0;
  const ventes     = commandes?.reduce((s, i) => s + i.quantite, 0) || 0;
  const revenu     = commandes?.reduce((s, i) => s + i.prix_unitaire * i.quantite, 0) || 0;

  document.getElementById('statProduits').textContent = nbProduits;
  document.getElementById('statVentes').textContent   = ventes;
  document.getElementById('statRevenu').textContent   = revenu.toFixed(2) + ' €';
  document.getElementById('statRupture').textContent  = ruptures;
}

async function loadProduits(userId) {
  const { data, error } = await sb.from('produits').select('*').eq('user_id', userId).order('created_at', { ascending: false });
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
    return `
      <tr>
        <td data-label="Produit">
          <div class="td-produit">
            <img class="td-img" src="${p.image_url || 'https://placehold.co/48x48/f3f4f6/9ca3af?text=?'}" alt="${p.titre}" loading="lazy">
            <span class="td-titre">${p.titre}</span>
          </div>
        </td>
        <td data-label="Prix" class="td-prix">${parseFloat(p.prix).toFixed(2)} €</td>
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
  const p = allProduits.find(x => x.id === id);
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
  btn.disabled = true;

  const id = document.getElementById('editId').value;
  const { error } = await sb.from('produits').update({
    titre:       document.getElementById('editTitre').value,
    description: document.getElementById('editDescription').value,
    prix:        parseFloat(document.getElementById('editPrix').value),
    stock:       parseInt(document.getElementById('editStock').value),
    image_url:   document.getElementById('editImageUrl').value || null,
  }).eq('id', id);

  btn.disabled = false;
  if (error) { showMsg('Erreur : ' + error.message, 'error'); return; }

  const idx = allProduits.findIndex(x => x.id === id);
  if (idx !== -1) {
    allProduits[idx] = { ...allProduits[idx],
      titre: document.getElementById('editTitre').value,
      description: document.getElementById('editDescription').value,
      prix: parseFloat(document.getElementById('editPrix').value),
      stock: parseInt(document.getElementById('editStock').value),
      image_url: document.getElementById('editImageUrl').value || null,
    };
  }
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

  const { error } = await sb.from('produits').delete().eq('id', deleteTargetId);
  btn.disabled = false;
  if (error) { showMsg('Erreur : ' + error.message, 'error'); closeDelete(); return; }

  allProduits = allProduits.filter(p => p.id !== deleteTargetId);
  closeDelete();
  renderTable(document.getElementById('dashSearch').value);
  showMsg('Produit supprimé.', 'success');

  // Mettre à jour stat
  document.getElementById('statProduits').textContent = allProduits.length;
});

function showMsg(text, type) {
  const box = document.getElementById('dashMessage');
  box.textContent = text;
  box.className = `dash-msg ${type}`;
  setTimeout(() => box.className = 'dash-msg hidden', 4000);
}

async function logout() { await sb.auth.signOut(); window.location.href = '../index.html'; }

function initHamburger() {
  const toggle = document.getElementById('navToggle');
  const menu   = document.getElementById('mobileMenu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('hidden') === false;
    toggle.querySelector('.icon-menu')?.classList.toggle('hidden', open);
    toggle.querySelector('.icon-close')?.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (menu && !menu.classList.contains('hidden') && !toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      toggle.querySelector('.icon-menu')?.classList.remove('hidden');
      toggle.querySelector('.icon-close')?.classList.add('hidden');
    }
  });
}

init();
