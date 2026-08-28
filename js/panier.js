
// Clé publique Kkiapay (PAS la clé secrète — celle-ci ne doit jamais
// apparaître côté client). Passer à false en production.
const KKIAPAY_PUBLIC_KEY = 'REMPLACE_PAR_TA_CLE_PUBLIQUE_KKIAPAY';
const KKIAPAY_SANDBOX = true;

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

// ── PANIER (stocké côté serveur dans panier_items, voir js/utils/cart.js) ──
let currentUserId = null;
function fmt(priceEUR) { return Currency.formatPrice(priceEUR); }

function updateBadge(cart) {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

async function renderCart() {
  const cart = await Cart.getCartItems({ supabaseClient, userId: currentUserId });
  const container = document.getElementById('panierItems');
  const empty     = document.getElementById('panierEmpty');
  const recap     = document.getElementById('panierRecap');
  const btnCmd    = document.getElementById('btnCommander');

  updateBadge(cart);

  if (cart.length === 0) {
    container.innerHTML = '';
    container.appendChild(empty);
    empty.classList.remove('hidden');
    recap.style.opacity = '0.4';
    recap.style.pointerEvents = 'none';
    btnCmd.disabled = true;
    document.getElementById('recapSousTotal').textContent = fmt(0);
    document.getElementById('recapTotal').textContent = fmt(0);
    return;
  }

  empty.classList.add('hidden');
  recap.style.opacity = '';
  recap.style.pointerEvents = '';
  btnCmd.disabled = false;

  container.innerHTML = cart.map((item) => `
    <div class="panier-item" data-cart-id="${escapeHtml(item.cartItemId)}">
      <img class="panier-item-img"
           src="${escapeHtml(item.image_url || 'https://placehold.co/80x80/f3f4f6/9ca3af?text=?')}"
           alt="${escapeHtml(item.titre)}" loading="lazy">
      <div class="panier-item-info">
        <a href="produit.html?id=${encodeURIComponent(item.id)}" class="panier-item-titre">${escapeHtml(item.titre)}</a>
        <p class="panier-item-prix-unit">${fmt(item.prix)} / unité</p>
      </div>
      <div class="panier-item-controls">
        <div class="qty-control">
          <button type="button" data-action="minus" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Diminuer">
            <i data-lucide="minus"></i>
          </button>
          <span>${item.qty}</span>
          <button type="button" data-action="plus" data-cart-id="${escapeHtml(item.cartItemId)}" data-max="${item.stock}" aria-label="Augmenter">
            <i data-lucide="plus"></i>
          </button>
        </div>
        <span class="panier-item-total">${fmt(item.prix * item.qty)}</span>
        <button class="btn-supprimer" data-action="remove" data-cart-id="${escapeHtml(item.cartItemId)}" aria-label="Supprimer">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const cartItemId = btn.dataset.cartId;
      const item = cart.find(i => i.cartItemId === cartItemId);
      if (!item) { btn.disabled = false; return; }

      try {
        if (btn.dataset.action === 'minus') {
          await Cart.updateCartItemQty({ supabaseClient, cartItemId, qty: item.qty - 1 });
        } else if (btn.dataset.action === 'plus') {
          const max = parseInt(btn.dataset.max, 10) || item.qty;
          await Cart.updateCartItemQty({ supabaseClient, cartItemId, qty: Math.min(item.qty + 1, max) });
        } else if (btn.dataset.action === 'remove') {
          await Cart.removeCartItem({ supabaseClient, cartItemId });
        }
        await renderCart();
        lucide.createIcons();
      } catch (err) {
        showMsg('Erreur : ' + (err.message || 'action impossible sur le panier.'), 'error');
        btn.disabled = false;
      }
    });
  });

  const sousTotal = cart.reduce((s, i) => s + i.prix * i.qty, 0);
  document.getElementById('recapSousTotal').textContent = fmt(sousTotal);
  document.getElementById('recapTotal').textContent = fmt(sousTotal);

  lucide.createIcons();
}

// ── ADRESSE LIVRAISON ──
async function initAdresse() {
  const modal = document.getElementById('adresseModal');
  const btnOpen = document.getElementById('btnChangeAddr');
  const btnClose = document.getElementById('closeAdresseModal');
  const form = document.getElementById('adresseForm');
  const countrySelect = document.getElementById('addrCountry');

  Object.entries(LocationService.COUNTRIES).forEach(([code, data]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = data.name;
    countrySelect.appendChild(opt);
  });

  const detectedCountry = await LocationService.detectCountry();
  if (detectedCountry && LocationService.COUNTRIES[detectedCountry]) {
    countrySelect.value = detectedCountry;
    const phoneInput = document.getElementById('addrPhone');
    phoneInput.placeholder = LocationService.COUNTRIES[detectedCountry].dial + ' 00 00 00 00';
  }

  renderAdresseDisplay();
  renderSavedAddresses();

  btnOpen?.addEventListener('click', () => modal.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => modal.classList.add('hidden'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const address = {
      id: Date.now().toString(),
      country: document.getElementById('addrCountry').value,
      countryName: LocationService.COUNTRIES[document.getElementById('addrCountry').value]?.name || '',
      city: document.getElementById('addrCity').value.trim(),
      area: document.getElementById('addrArea').value.trim(),
      street: document.getElementById('addrStreet').value.trim(),
      phone: document.getElementById('addrPhone').value.trim(),
      name: document.getElementById('addrName').value.trim(),
      isDefault: document.getElementById('addrDefault').checked
    };

    if (address.isDefault) LocationService.setDefaultAddress(address.id);
    LocationService.saveAddress(address);

    renderAdresseDisplay();
    renderSavedAddresses();
    modal.classList.add('hidden');
    form.reset();
    lucide.createIcons();
  });
}

function renderAdresseDisplay() {
  const addr = LocationService.getDefaultAddress();
  const display = document.getElementById('adresseDisplay');

  if (!addr) {
    display.innerHTML = '<p class="adresse-empty">Aucune adresse enregistrée</p>';
    return;
  }

  display.innerHTML = `
    <p class="adresse-name">${escapeHtml(addr.name || 'Destinataire')}</p>
    <p>${escapeHtml(addr.street ? addr.street + ', ' : '')}${escapeHtml(addr.area ? addr.area + ', ' : '')}${escapeHtml(addr.city)}</p>
    <p>${escapeHtml(addr.countryName)}</p>
    <p class="adresse-phone"><i data-lucide="phone"></i> ${escapeHtml(addr.phone)}</p>
  `;
  lucide.createIcons();
}

function renderSavedAddresses() {
  const addresses = LocationService.getSavedAddresses();
  const container = document.getElementById('savedAddresses');
  const list = document.getElementById('addressList');

  if (addresses.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = addresses.map(addr => `
    <div class="address-card ${addr.isDefault ? 'selected' : ''}" data-id="${escapeHtml(addr.id)}">
      <div class="address-card-info">
        <strong>${escapeHtml(addr.name || 'Adresse')}</strong>${addr.isDefault ? '<span class="address-card-badge">Par défaut</span>' : ''}<br>
        ${escapeHtml(addr.city)}, ${escapeHtml(addr.countryName)}<br>
        ${escapeHtml(addr.phone)}
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.address-card').forEach(card => {
    card.addEventListener('click', () => {
      LocationService.setDefaultAddress(card.dataset.id);
      renderAdresseDisplay();
      renderSavedAddresses();
      document.getElementById('adresseModal').classList.add('hidden');
    });
  });
}

// ── PAIEMENT KKIAPAY ──
function payerAvecKkiapay(commandeId, total, session) {
  return new Promise((resolve, reject) => {
    const successHandler = (response) => {
      window.removeKkiapayListener('success', successHandler);
      window.removeKkiapayListener('failed', failedHandler);
      resolve(response); // { transactionId: ... }
    };
    const failedHandler = () => {
      window.removeKkiapayListener('success', successHandler);
      window.removeKkiapayListener('failed', failedHandler);
      reject(new Error('PAIEMENT_ECHOUE'));
    };

    window.addKkiapayListener('success', successHandler);
    window.addKkiapayListener('failed', failedHandler);

    window.openKkiapayWidget({
      amount: Math.round(total), // Kkiapay attend un montant en entier (XOF)
      key: KKIAPAY_PUBLIC_KEY,
      sandbox: KKIAPAY_SANDBOX,
      email: session.user.email,
      data: JSON.stringify({ commande_id: commandeId }),
      position: 'center'
    });
  });
}

// ── INIT ──
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  await renderCart();
  initAdresse();

  document.getElementById('btnCommander').addEventListener('click', async () => {
    const cart = await Cart.getCartItems({ supabaseClient, userId: currentUserId });
    if (cart.length === 0) return;

    const addr = LocationService.getDefaultAddress();
    if (!addr) {
      showMsg('Veuillez ajouter une adresse de livraison.', 'error');
      document.getElementById('adresseModal').classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btnCommander');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader"></i> Création de la commande...';
    lucide.createIcons();

    let commandeId = null;

    try {
      // 1) Réservation atomique du stock + création de la commande
      //    (le prix vient de la BDD, pas du panier client)
      const cartPayload = cart.map(i => ({ id: i.id, qty: i.qty }));
      const { data: result, error: rpcError } = await supabaseClient
        .rpc('create_pending_order', { p_cart: cartPayload, p_address: addr });

      if (rpcError) throw rpcError;
      commandeId = result.commande_id;
      const total = result.total;

      // 2) Ouverture du paiement Kkiapay
      btn.innerHTML = '<i data-lucide="loader"></i> Ouverture du paiement...';
      lucide.createIcons();
      await payerAvecKkiapay(commandeId, total, session);

      // 3) Le widget confirme le succès, mais la confirmation RÉELLE
      //    et la libération de l'escrow se font côté serveur via le
      //    webhook Kkiapay -> Edge Function -> RPC mark_order_paid()
      await Cart.clearCart({ supabaseClient, userId: currentUserId });
      showMsg('Paiement reçu ! Confirmation en cours...', 'success');
      setTimeout(() => window.location.href = 'commandes.html', 1200);

    } catch (err) {
      // paiement échoué / annulé / erreur réseau → on libère le stock réservé
      if (commandeId) {
        await supabaseClient.rpc('cancel_pending_order', { p_commande_id: commandeId });
      }
      showMsg('Erreur : ' + (err.message || 'le paiement a échoué.'), 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check-circle"></i> Confirmer la commande';
      lucide.createIcons();
    }
  });
}

function showMsg(text, type) {
  const box = document.getElementById('panier-message');
  box.textContent = text;
  box.className = `panier-msg ${type}`;
}

init();