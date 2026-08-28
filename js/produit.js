
// ── SUPPRIMEZ TOUS LES IMPORTS EN HAUT ──
// Ne pas utiliser : import { supabaseClient } from './supabase.js';
// Les variables sont déjà globales via les scripts chargés dans le HTML

// ── ÉCHAPPEMENT HTML (anti-XSS) ──
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── HAMBURGER ── (INTACT, NON MODIFIÉ)
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

// ── PANIER (stocké côté serveur dans panier_items, voir js/utils/cart.js) ──
let currentUserId = null;

async function updateCartBadge() {
  const total = await Cart.getCartCount({ supabaseClient, userId: currentUserId });
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

// ── INIT ──
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut(); window.location.href = '../index.html';
  });
  document.getElementById('btnLogoutMobile')?.addEventListener('click', async () => {
    await supabaseClient.auth.signOut(); window.location.href = '../index.html';
  });

  await updateCartBadge();

  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { showError(); return; }

  const { data: produit, error } = await supabaseClient
    .from('produits').select('*').eq('id', id).single();

  if (error || !produit) { showError(); return; }

  // Incrémentation atomique des vues (n'importe jamais le blocage de l'affichage)
  supabaseClient.rpc('increment_product_views', { p_produit_id: produit.id })
    .then(({ error: viewErr }) => {
      if (viewErr) console.warn('Impossible de mettre à jour les vues du produit :', viewErr.message);
    });

  renderProduit(produit, session.user.id);
}

function bindProductCurrencySelector() {
  const selector = document.getElementById('currencySelect');
  if (!selector) return;
  selector.value = Currency.getUserCurrency();
  selector.addEventListener('change', (event) => {
    Currency.setUserCurrency(event.target.value);
    document.getElementById('produitPrix').textContent = Currency.formatPrice(currentProduit.prix, Currency.getProductCurrencyCode(currentProduit), Currency.getUserCurrency());
  });
}

let currentProduit = null;

function renderProduit(p, userId) {
  currentProduit = p;
  document.getElementById('produitSkeleton').classList.add('hidden');
  document.getElementById('produitContent').classList.remove('hidden');

  document.title = `${p.titre} — afima`;

  document.getElementById('produitImg').src = p.image_url || 'https://placehold.co/600x600/f3f4f6/9ca3af?text=No+Image';
  document.getElementById('produitImg').alt = p.titre;
  document.getElementById('produitTitre').textContent = p.titre;
  const wishlistButton = document.getElementById('wishlistButton');
  if (wishlistButton) {
    const syncFavoriteState = async () => {
      const ids = await Wishlist.getWishlistIds({ supabaseClient, userId });
      wishlistButton.classList.toggle('active', ids.includes(String(p.id)));
    };

    syncFavoriteState();
    wishlistButton.addEventListener('click', async () => {
      const result = await Wishlist.toggleProductWishlist({ supabaseClient, userId, product: p, productId: p.id });
      wishlistButton.classList.toggle('active', result.isFavorite);
      showMsg(result.isFavorite ? 'Ajouté aux favoris.' : 'Retiré des favoris.', 'success');
    });
  }
  document.getElementById('produitPrix').textContent = Currency.formatPrice(p.prix, Currency.getProductCurrencyCode(p), Currency.getUserCurrency());
  bindProductCurrencySelector();
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

  const qtyInput = document.getElementById('qtyInput');
  qtyInput.max = p.stock;

  document.getElementById('qtyMinus').addEventListener('click', () => {
    if (qtyInput.value > 1) qtyInput.value = parseInt(qtyInput.value) - 1;
  });
  document.getElementById('qtyPlus').addEventListener('click', () => {
    if (parseInt(qtyInput.value) < p.stock) qtyInput.value = parseInt(qtyInput.value) + 1;
  });

  // Ajouter au panier
  document.getElementById('btnPanier').addEventListener('click', async () => {
    try {
      await ajouterAuPanier(p, parseInt(qtyInput.value));
      showMsg('Ajouté au panier !', 'success');
    } catch (err) {
      showMsg('Erreur : ' + (err.message || 'impossible d\'ajouter au panier.'), 'error');
    }
  });

  // Acheter maintenant : on ajoute au panier puis on va directement au
  // paiement — panier.html gère déjà l'adresse + l'escrow + Kkiapay,
  // pas besoin de dupliquer ce flux ici.
  document.getElementById('btnAcheter').addEventListener('click', async () => {
    try {
      await ajouterAuPanier(p, parseInt(qtyInput.value));
      window.location.href = 'panier.html';
    } catch (err) {
      showMsg('Erreur : ' + (err.message || 'impossible d\'ajouter au panier.'), 'error');
    }
  });

  initializeReviews(p, userId);
  lucide.createIcons();
}

async function ajouterAuPanier(p, qty) {
  await Cart.addToCart({ supabaseClient, userId: currentUserId, produit: p, qty });
  await updateCartBadge();
}

async function initializeReviews(product, userId) {
  const container = document.getElementById('reviewsSection');
  if (!container) return;

  let reviews = [];
  let hasPurchased = false;

  try {
    const { data, error } = await supabaseClient.rpc('has_purchased_product', { p_produit_id: product.id });
    if (!error) hasPurchased = !!data;
  } catch (err) {
    console.warn('Impossible de vérifier l\'achat du produit :', err.message);
  }

  const { data: reviewData, error: reviewError } = await supabaseClient
    .from('reviews').select('*').eq('product_id', product.id).order('created_at', { ascending: false });

  if (!reviewError && Array.isArray(reviewData)) {
    reviews = reviewData;
  } else {
    console.warn('Impossible de charger les avis :', reviewError?.message);
  }

  const hasReviewed = reviews.some(r => r.user_id === userId);
  const average = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  container.innerHTML = `
    <div class="reviews-header">
      <h2>Avis clients</h2>
      <div class="review-summary">${reviews.length > 0 ? `${average} / 5 · ${reviews.length} avis` : 'Aucun avis pour l\'instant'}</div>
    </div>
    ${hasPurchased && !hasReviewed ? `
      <form class="review-form" id="reviewForm">
        <strong>Laisser un avis</strong>
        <div class="review-stars" id="reviewStars" role="radiogroup" aria-label="Notation">
          ${[1,2,3,4,5].map(v => `<button type="button" data-value="${v}" aria-label="${v} étoile${v > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <textarea id="reviewComment" maxlength="280" placeholder="Dites ce que vous avez pensé du produit..."></textarea>
        <button type="submit" id="reviewSubmit">Publier l'avis</button>
      </form>
    ` : ''}
    ${!hasPurchased && !hasReviewed ? `<p class="review-empty">Achetez ce produit pour pouvoir laisser un avis.</p>` : ''}
    ${hasReviewed ? `<p class="review-empty">Vous avez déjà laissé un avis pour ce produit.</p>` : ''}
    <div class="review-list">
      ${reviews.length > 0 ? reviews.map(review => `
        <div class="review-card">
          <strong>${'★'.repeat(Number(review.rating) || 0)}${'☆'.repeat(5 - (Number(review.rating) || 0))}</strong>
          <p>${escapeHtml(review.comment || 'Aucun commentaire')}</p>
          <div class="review-meta">${new Date(review.created_at).toLocaleDateString('fr-FR')} · ${review.user_id === userId ? 'Vous' : 'Client'}</div>
        </div>
      `).join('') : '<p class="review-empty">Soyez le premier à donner votre avis.</p>'}
    </div>
  `;

  const stars = container.querySelectorAll('.review-stars button');
  let selectedRating = 0;

  stars.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedRating = Number(btn.dataset.value);
      stars.forEach(b => b.classList.toggle('active', Number(b.dataset.value) <= selectedRating));
    });
  });

  const form = container.querySelector('#reviewForm');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const comment = container.querySelector('#reviewComment').value.trim();
    const submitBtn = container.querySelector('#reviewSubmit');

    if (!selectedRating) {
      showMsg('Choisissez une note de 1 à 5 étoiles.', 'error');
      return;
    }
    if (!comment) {
      showMsg('Ajoutez un commentaire avant de publier.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Publication...';

    const reviewPayload = {
      product_id: product.id,
      user_id: userId,
      rating: selectedRating,
      comment,
      created_at: new Date().toISOString()
    };

    const { error } = await supabaseClient.from('reviews').insert([reviewPayload]);
    if (error) {
      // Pas de secours localStorage : un avis invisible aux autres est
      // pire qu'un message d'erreur honnête.
      showMsg('Erreur lors de la publication de l\'avis. Réessayez.', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publier l\'avis';
      return;
    }

    showMsg('Avis publié avec succès.', 'success');
    initializeReviews(product, userId);
  });
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