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

  try {
    await supabaseClient.from('produits').update({ views: (produit.views || 0) + 1 }).eq('id', produit.id);
  } catch (err) {
    console.warn('Impossible de mettre à jour les vues du produit :', err.message);
  }

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
  const wishlistButton = document.getElementById('wishlistButton');
  if (wishlistButton) {
    const stored = JSON.parse(localStorage.getItem('afima_wishlist') || '[]');
    wishlistButton.classList.toggle('active', stored.includes(String(p.id)));
    wishlistButton.addEventListener('click', async () => {
      const current = JSON.parse(localStorage.getItem('afima_wishlist') || '[]');
      const ids = current.includes(String(p.id)) ? current.filter(id => id !== String(p.id)) : [...current, String(p.id)];
      localStorage.setItem('afima_wishlist', JSON.stringify(ids));
      wishlistButton.classList.toggle('active', ids.includes(String(p.id)));
      showMsg(ids.includes(String(p.id)) ? 'Ajouté aux favoris.' : 'Retiré des favoris.', 'success');
    });
  }
  document.getElementById('produitPrix').textContent = Currency.formatPrice(p.prix);
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

  initializeReviews(p, userId);
  lucide.createIcons();
}

function getLocalReviews(productId) {
  try {
    const all = JSON.parse(localStorage.getItem('afima_reviews') || '{}');
    return Array.isArray(all[productId]) ? all[productId] : [];
  } catch {
    return [];
  }
}

function saveLocalReviews(productId, reviews) {
  try {
    const all = JSON.parse(localStorage.getItem('afima_reviews') || '{}');
    all[productId] = reviews;
    localStorage.setItem('afima_reviews', JSON.stringify(all));
  } catch {
    // ignore
  }
}

async function initializeReviews(product, userId) {
  const container = document.getElementById('reviewsSection');
  if (!container) return;

  let reviews = [];
  let hasPurchased = false;

  try {
    const { data: purchaseData } = await supabaseClient.from('commande_items').select('commande_id, produit_id').eq('produit_id', product.id);
    const commandIds = (purchaseData || []).map(item => item.commande_id);
    if (commandIds.length > 0) {
      const { data: commandes } = await supabaseClient.from('commandes').select('id').eq('user_id', userId);
      hasPurchased = commandIds.some(id => (commandes || []).some(cmd => cmd.id === id));
    }
  } catch (err) {
    console.warn('Impossible de vérifier l’achat du produit :', err.message);
  }

  try {
    const { data, error } = await supabaseClient.from('reviews').select('*').eq('product_id', product.id).order('created_at', { ascending: false });
    if (!error && Array.isArray(data)) {
      reviews = data;
    } else {
      reviews = getLocalReviews(product.id);
    }
  } catch {
    reviews = getLocalReviews(product.id);
  }

  const hasReviewed = reviews.some(r => r.user_id === userId);
  const average = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  container.innerHTML = `
    <div class="reviews-header">
      <h2>Avis clients</h2>
      <div class="review-summary">${reviews.length > 0 ? `${average} / 5 · ${reviews.length} avis` : 'Aucun avis pour l’instant'}</div>
    </div>
    ${hasPurchased && !hasReviewed ? `
      <form class="review-form" id="reviewForm">
        <strong>Laisser un avis</strong>
        <div class="review-stars" id="reviewStars" role="radiogroup" aria-label="Notation">
          ${[1,2,3,4,5].map(v => `<button type="button" data-value="${v}" aria-label="${v} étoile${v > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
        <textarea id="reviewComment" maxlength="280" placeholder="Dites ce que vous avez pensé du produit..."></textarea>
        <button type="submit" id="reviewSubmit">Publier l’avis</button>
      </form>
    ` : ''}
    ${!hasPurchased && !hasReviewed ? `<p class="review-empty">Achetez ce produit pour pouvoir laisser un avis.</p>` : ''}
    ${hasReviewed ? `<p class="review-empty">Vous avez déjà laissé un avis pour ce produit.</p>` : ''}
    <div class="review-list">
      ${reviews.length > 0 ? reviews.map(review => `
        <div class="review-card">
          <strong>${'★'.repeat(Number(review.rating) || 0)}${'☆'.repeat(5 - (Number(review.rating) || 0))}</strong>
          <p>${(review.comment || 'Aucun commentaire').replace(/</g, '&lt;')}</p>
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

    try {
      const { error } = await supabaseClient.from('reviews').insert([reviewPayload]);
      if (error) throw error;
      reviews = [reviewPayload, ...reviews];
      showMsg('Avis publié avec succès.', 'success');
    } catch {
      reviews = [reviewPayload, ...reviews];
      saveLocalReviews(product.id, reviews);
      showMsg('Avis enregistré localement.', 'success');
    }

    initializeReviews(product, userId);
  });
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
