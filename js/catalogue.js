const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let allProduits = [];
let currentUserId = null;
let wishlist = [];
let currentCurrency = Currency.getUserCurrency();

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

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  currentUserId = session?.user?.id || null;

  if (!session) {
    currentUserId = null;
  }

  // Badge panier
  const cart  = JSON.parse(localStorage.getItem('afima_cart') || '[]');
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  await loadProduits();
  await loadWishlist();
  bindCurrencySelector();

  document.getElementById('searchInput').addEventListener('input', renderProduits);
  document.getElementById('sortSelect').addEventListener('change', renderProduits);

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
}

async function loadProduits() {
  const { data, error } = await supabaseClient
    .from('produits').select('*').order('created_at', { ascending: false });

  const msgBox = document.getElementById('message-box');
  if (error) {
    msgBox.textContent = 'Erreur : ' + error.message;
    msgBox.classList.remove('hidden');
    document.getElementById('produits-grid').innerHTML = '';
    return;
  }
  allProduits = data || [];
  renderProduits();
}

function renderWishlist() {
  const section = document.getElementById('wishlistSection');
  if (!section) return;

  if (!wishlist.length) {
    section.innerHTML = '';
    return;
  }

  section.innerHTML = `
    <div class="wishlist-title">Vos favoris</div>
    <div class="wishlist-list">
      ${wishlist.map(item => `
        <div class="wishlist-pill">
          <span>${item.titre}</span>
          <button type="button" data-id="${item.id}" aria-label="Retirer des favoris">✕</button>
        </div>
      `).join('')}
    </div>
  `;

  section.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => toggleWishlist(btn.dataset.id));
  });
}

async function loadWishlist() {
  try {
    const ids = await Wishlist.getWishlistIds({ supabaseClient, userId: currentUserId });
    wishlist = allProduits.filter(p => ids.includes(String(p.id))).map(p => ({ id: p.id, titre: p.titre }));
  } catch {
    wishlist = [];
  }
  renderWishlist();
}

async function toggleWishlist(productId) {
  const product = allProduits.find(p => String(p.id) === String(productId));
  if (!product) return;

  const result = await Wishlist.toggleProductWishlist({ supabaseClient, userId: currentUserId, product, productId });
  const ids = result.ids || [];
  wishlist = allProduits.filter(p => ids.includes(String(p.id))).map(p => ({ id: p.id, titre: p.titre }));
  renderWishlist();
  renderProduits();
}

function bindCurrencySelector() {
  const selector = document.getElementById('currencySelect');
  if (!selector) return;
  selector.value = Currency.getUserCurrency();
  selector.addEventListener('change', (event) => {
    const code = event.target.value;
    Currency.setUserCurrency(code);
    currentCurrency = code;
    renderProduits();
  });
}

function renderProduits() {
  const query = document.getElementById('searchInput').value.toLowerCase().trim();
  const sort  = document.getElementById('sortSelect').value;
  const grid  = document.getElementById('produits-grid');

  let list = allProduits.filter(p =>
    p.titre.toLowerCase().includes(query) ||
    (p.description || '').toLowerCase().includes(query)
  );

  if (sort === 'prix-asc')  list.sort((a, b) => a.prix - b.prix);
  if (sort === 'prix-desc') list.sort((a, b) => b.prix - a.prix);

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <p>${query ? `Aucun résultat pour "<strong>${query}</strong>"` : 'Aucun produit disponible pour le moment.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const stockBadge = p.stock > 0
      ? `<span class="card-stock-badge">${p.stock} en stock</span>`
      : `<span class="card-stock-badge out">Rupture</span>`;
    const isFav = wishlist.some(item => item.id === p.id);
    return `
      <div class="produit-card">
        <div class="card-img-wrapper">
          <button class="wishlist-btn ${isFav ? 'active' : ''}" data-id="${p.id}" type="button" aria-label="Ajouter aux favoris">
            <i data-lucide="heart"></i>
          </button>
          <a href="produit.html?id=${p.id}" aria-label="Voir ${p.titre}">
            <img src="${p.image_url || 'https://placehold.co/400x300/f3f4f6/9ca3af?text=No+Image'}"
                 alt="${p.titre}" loading="lazy" width="400" height="200">
          </a>
        </div>
        <a href="produit.html?id=${p.id}" class="card-body" aria-label="Voir ${p.titre}">
          <p class="card-titre">${p.titre}</p>
          <p class="card-description">${p.description || ''}</p>
          <div class="card-footer">
            <span class="card-prix">${Currency.formatPrice(p.prix, Currency.getProductCurrencyCode(p), currentCurrency)}</span>
            ${stockBadge}
          </div>
        </a>
      </div>`;
  }).join('');

  grid.querySelectorAll('.wishlist-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleWishlist(btn.dataset.id));
  });
  lucide.createIcons();
}

init();
