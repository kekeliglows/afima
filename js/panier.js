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

// ── PANIER ──
function getCart() { return JSON.parse(localStorage.getItem('afima_cart') || '[]'); }
function saveCart(cart) { localStorage.setItem('afima_cart', JSON.stringify(cart)); }

function fmt(priceEUR) { return Currency.formatPrice(priceEUR); }

function updateBadge(cart) {
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (!badge) return;
  badge.textContent = total;
  badge.classList.toggle('hidden', total === 0);
}

function renderCart() {
  const cart = getCart();
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

  container.innerHTML = cart.map((item, idx) => `
    <div class="panier-item" data-idx="${idx}">
      <img class="panier-item-img"
           src="${item.image_url || 'https://placehold.co/80x80/f3f4f6/9ca3af?text=?'}"
           alt="${item.titre}" loading="lazy">
      <div class="panier-item-info">
        <a href="produit.html?id=${item.id}" class="panier-item-titre">${item.titre}</a>
        <p class="panier-item-prix-unit">${fmt(item.prix)} / unité</p>
      </div>
      <div class="panier-item-controls">
        <div class="qty-control">
          <button type="button" data-action="minus" data-idx="${idx}" aria-label="Diminuer">
            <i data-lucide="minus"></i>
          </button>
          <span>${item.qty}</span>
          <button type="button" data-action="plus" data-idx="${idx}" aria-label="Augmenter">
            <i data-lucide="plus"></i>
          </button>
        </div>
        <span class="panier-item-total">${fmt(item.prix * item.qty)}</span>
        <button class="btn-supprimer" data-action="remove" data-idx="${idx}" aria-label="Supprimer">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cart = getCart();
      const idx  = parseInt(btn.dataset.idx);
      if (btn.dataset.action === 'minus') {
        if (cart[idx].qty > 1) cart[idx].qty--;
        else cart.splice(idx, 1);
      } else if (btn.dataset.action === 'plus') {
        if (cart[idx].qty < cart[idx].stock) cart[idx].qty++;
      } else if (btn.dataset.action === 'remove') {
        cart.splice(idx, 1);
      }
      saveCart(cart);
      renderCart();
      lucide.createIcons();
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

  // Peupler les pays
  Object.entries(LocationService.COUNTRIES).forEach(([code, data]) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = data.name;
    countrySelect.appendChild(opt);
  });

  // Détection automatique du pays
  const detectedCountry = await LocationService.detectCountry();
  if (detectedCountry && LocationService.COUNTRIES[detectedCountry]) {
    countrySelect.value = detectedCountry;
    const phoneInput = document.getElementById('addrPhone');
    phoneInput.placeholder = LocationService.COUNTRIES[detectedCountry].dial + ' 00 00 00 00';
  }

  // Afficher l'adresse par défaut
  renderAdresseDisplay();

  // Charger les adresses sauvegardées
  renderSavedAddresses();

  // Ouvrir modal
  btnOpen?.addEventListener('click', () => modal.classList.remove('hidden'));
  btnClose?.addEventListener('click', () => modal.classList.add('hidden'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  // Soumission formulaire
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

    if (address.isDefault) {
      LocationService.setDefaultAddress(address.id);
    }
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
    <p class="adresse-name">${addr.name || 'Destinataire'}</p>
    <p>${addr.street ? addr.street + ', ' : ''}${addr.area ? addr.area + ', ' : ''}${addr.city}</p>
    <p>${addr.countryName}</p>
    <p class="adresse-phone"><i data-lucide="phone"></i> ${addr.phone}</p>
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
    <div class="address-card ${addr.isDefault ? 'selected' : ''}" data-id="${addr.id}">
      <div class="address-card-info">
        <strong>${addr.name || 'Adresse'}</strong>${addr.isDefault ? '<span class="address-card-badge">Par défaut</span>' : ''}<br>
        ${addr.city}, ${addr.countryName}<br>
        ${addr.phone}
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

// ── INIT ──
async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  renderCart();
  initAdresse();

  document.getElementById('btnCommander').addEventListener('click', async () => {
    const cart = getCart();
    if (cart.length === 0) return;

    // Vérifier adresse
    const addr = LocationService.getDefaultAddress();
    if (!addr) {
      showMsg('Veuillez ajouter une adresse de livraison.', 'error');
      document.getElementById('adresseModal').classList.remove('hidden');
      return;
    }

    const btn = document.getElementById('btnCommander');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader"></i> Traitement...';
    lucide.createIcons();

    try {
      const total = cart.reduce((s, i) => s + i.prix * i.qty, 0);

      const { data: commande, error: cmdError } = await supabaseClient
        .from('commandes')
        .insert([{ 
          user_id: session.user.id, 
          total, 
          statut: 'confirmee',
          adresse_livraison: addr
        }])
        .select().single();

      if (cmdError) throw cmdError;

      const lignes = cart.map(i => ({
        commande_id:   commande.id,
        produit_id:    i.id,
        titre:         i.titre,
        prix_unitaire: i.prix,
        quantite:      i.qty,
        image_url:     i.image_url
      }));

      const { error: lignesError } = await supabaseClient.from('commande_items').insert(lignes);
      if (lignesError) throw lignesError;

      for (const item of cart) {
        const { data: prod, error: stockErr } = await supabaseClient.from('produits').select('stock').eq('id', item.id).single();
        if (stockErr) throw stockErr;
        const { error: updateErr } = await supabaseClient.from('produits').update({ stock: Math.max(0, prod.stock - item.qty) }).eq('id', item.id);
        if (updateErr) throw updateErr;
      }

      localStorage.removeItem('afima_cart');
      showMsg('Commande confirmée ! Redirection...', 'success');
      setTimeout(() => window.location.href = 'commandes.html', 1200);

    } catch (err) {
      showMsg('Erreur : ' + err.message, 'error');
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
