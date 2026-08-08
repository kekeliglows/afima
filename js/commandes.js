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

function fmt(n) { return Currency.formatPrice(n); }

const STATUTS = {
  confirmee: { label: 'Confirmée',   icon: 'check-circle', css: 'statut-confirmee' },
  en_cours:  { label: 'En cours',    icon: 'truck',        css: 'statut-en-cours'  },
  livree:    { label: 'Livrée',      icon: 'package-check',css: 'statut-livree'    },
  annulee:   { label: 'Annulée',     icon: 'x-circle',     css: 'statut-annulee'   },
};

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  // Badge panier
  const cart = JSON.parse(localStorage.getItem('afima_cart') || '[]');
  const total = cart.reduce((s, i) => s + i.qty, 0);
  const badge = document.getElementById('cartBadge');
  if (badge && total > 0) { badge.textContent = total; badge.classList.remove('hidden'); }

  await loadCommandes(session.user.id);
}

async function loadCommandes(userId) {
  const list = document.getElementById('commandes-list');

  const { data, error } = await supabaseClient
    .from('commandes')
    .select('*, commande_items(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  // Supprimer skeleton
  document.getElementById('cmdSkeleton')?.remove();

  if (error) {
    list.innerHTML = `<p style="color:#dc2626;font-weight:600;padding:20px">Erreur : ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `
      <div class="commandes-empty">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        <p>Vous n'avez pas encore de commandes.</p>
        <a href="catalogue.html" class="btn btn-primary">Parcourir le catalogue</a>
      </div>`;
    lucide.createIcons();
    return;
  }

  list.innerHTML = data.map(cmd => {
    const statut = STATUTS[cmd.statut] || STATUTS.confirmee;
    const date   = new Date(cmd.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const items  = cmd.commande_items || [];

    const itemsHtml = items.map(item => `
      <div class="commande-item">
        <img class="commande-item-img"
             src="${item.image_url || 'https://placehold.co/56x56/f3f4f6/9ca3af?text=?'}"
             alt="${item.titre}" loading="lazy">
        <div class="commande-item-info">
          <p class="commande-item-titre">${item.titre}</p>
          <p class="commande-item-detail">Qté : ${item.quantite} × ${fmt(item.prix_unitaire)}</p>
        </div>
        <button class="btn-review" type="button" onclick="window.location.href='produit.html?id=${item.produit_id}&review=1'">Laisser un avis</button>
        <span class="commande-item-prix">${fmt(item.prix_unitaire * item.quantite)}</span>
      </div>
    `).join('');

    return `
      <div class="commande-card">
        <div class="commande-header">
          <span class="commande-id">#${cmd.id.slice(0, 8).toUpperCase()}</span>
          <span class="commande-date">
            <i data-lucide="calendar"></i> ${date}
          </span>
          <span class="commande-statut ${statut.css}">
            <i data-lucide="${statut.icon}"></i> ${statut.label}
          </span>
        </div>
        <div class="commande-items">${itemsHtml}</div>
        <div class="commande-footer">
          <span class="commande-total-label">Total commande</span>
          <span class="commande-total-val">${fmt(cmd.total)}</span>
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();
}

init();
