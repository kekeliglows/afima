const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// ── PANIER (localStorage) ──
function getCart() { return JSON.parse(localStorage.getItem('afima_cart') || '[]'); }
function saveCart(cart) { localStorage.setItem('afima_cart', JSON.stringify(cart)); }

function updateCartBadge() {
  const total = getCart().reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

// ── INIT ──
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut(); window.location.href = '../index.html';
  });
  document.getElementById('btnLogoutMobile')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut(); window.location.href = '../index.html';
  });

  updateCartBadge();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { showError(); return; }

  const { data: produit, error } = await supabaseClient
    .from('produits').select('*').eq('id', id).single();

  if (error || !produit) { showError(); return; }

  renderProduit(produit, session.user.id);
}

function renderProduit(p, userId) {
  document.getElementById('produitSkeleton').classList.add('hidden');
  document.getElementById('produitContent').classList.remove('hidden');

  // SEO dynamique
  document.title = `${p.titre} — afima`;

  document.getElementById('produitImg').src = p.image_url || 'https://placehold.co/600x600/f3f4f6/9ca3af?text=No+Image';
  document.getElementById('produitImg').alt = p.titre;
  document.getElementById('produitTitre').textContent = p.titre;
  document.getElementById('produitPrix').textContent = parseFloat(p.prix).toFixed(2) + ' €';
  document.getElementById('produitDescription').textContent = p.description || '';
  document.getElementById('produitDate').textContent = 'Publié le ' + new Date(p.created_at).toLocaleDateString('fr-FR');

  const badge = document.getElementById('produitBadge');
  if (p.stock > 0) {
    badge.textContent = p.stock + ' en stock';
    badge.className = 'produit-badge';
    document.getElementById('produitStock').textContent = p.stock + ' unité(s) disponible(s)';
  } else {
    badge.textContent = 'Rupture de stock';
    badge.className = 'produit-badge out';
    document.getElementById('btnAcheter').disabled = true;
    document.getElementById('btnPanier').disabled = true;
  }

  // Quantité
  const qtyInput = document.getElementById('qtyInput');
  qtyInput.max = p.stock;

  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (qtyInput.value > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    if (parseInt(qtyInput.value) < p.stock) qtyInput.value = parseInt(qtyInput.value) + 1;
  });

  // Ajouter au panier
  document.getElementById('btnPanier').addEventListener('click', () => {
    const qty = parseInt(qtyInput.value);
    const cart = getCart();
    const existing = cart.find(i => i.id === p.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, p.stock);
    } else {
      cart.push({ id: p.id, titre: p.titre, prix: p.prix, image_url: p.image_url, qty, stock: p.stock });
    }
    saveCart(cart);
    updateCartBadge();
    showMsg('Ajouté au panier !', 'success');
  });

  // Acheter maintenant
  document.getElementById('btnAcheter').addEventListener('click', async () => {
    const qty = parseInt(qtyInput.value);
    const btn = document.getElementById('btnAcheter');
    btn.disabled = true;

    try {
      await passerCommande(userId, [{ id: p.id, titre: p.titre, prix: p.prix, image_url: p.image_url, qty }]);
      showMsg('Commande passée avec succès !', 'success');
      setTimeout(() => window.location.href = 'commandes.html', 1200);
    } catch (err) {
      showMsg('Erreur : ' + err.message, 'error');
      btn.disabled = false;
    }
  });

  lucide.createIcons();
}

async function passerCommande(userId, items) {
  const total = items.reduce((s, i) => s + i.prix * i.qty, 0);

  const { data: commande, error: cmdError } = await supabaseClient
    .from('commandes')
    .insert([{ user_id: userId, total, statut: 'confirmee' }])
    .select().single();

  if (cmdError) throw cmdError;

  const lignes = items.map(i => ({
    commande_id: commande.id,
    produit_id:  i.id,
    titre:       i.titre,
    prix_unitaire: i.prix,
    quantite:    i.qty,
    image_url:   i.image_url
  }));

  const { error: lignesError } = await supabaseClient.from('commande_items').insert(lignes);
  if (lignesError) throw lignesError;

  // Décrémenter le stock
  for (const item of items) {
    const { data: prod } = await supabaseClient.from('produits').select('stock').eq('id', item.id).single();
    await supabaseClient.from('produits').update({ stock: Math.max(0, prod.stock - item.qty) }).eq('id', item.id);
  }
}

function showError() {
  document.getElementById('produitSkeleton').classList.add('hidden');
  document.getElementById('produitError').classList.remove('hidden');
}

function showMsg(text, type) {
  const box = document.getElementById('produit-message');
  box.textContent = text;
  box.className = `produit-msg ${type}`;
  setTimeout(() => box.className = 'produit-msg hidden', 3000);
}

init();
