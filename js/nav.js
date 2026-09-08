/**
 * nav.js — Menu responsive unifié Afima
 *
 * Ce script gère :
 *  - L'ouverture/fermeture du menu mobile (classe .open)
 *  - L'overlay cliquable derrière le menu
 *  - Le marquage automatique du lien actif (.active-nav)
 *  - La mise à jour des badges mobiles (panier, messages)
 *  - La fermeture sur Echap et sur resize > 768px
 *  - Le blocage du scroll body quand le menu est ouvert
 *
 * À charger AVANT les scripts spécifiques à chaque page.
 * Dépend uniquement du DOM — aucune dépendance externe.
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // INIT (une fois le DOM prêt)
  // ─────────────────────────────────────────────
  function init() {
    const toggle   = document.getElementById('navToggle');
    const menu     = document.getElementById('mobileMenu');
    const overlay  = document.getElementById('navOverlay');

    if (!toggle || !menu) return; // page sans header (login, signup…)

    // ── Ouvrir / fermer ──────────────────────────
    toggle.addEventListener('click', () => {
      const isOpen = menu.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });

    // ── Fermer en cliquant sur l'overlay ─────────
    overlay?.addEventListener('click', closeMenu);

    // ── Fermer sur Echap ─────────────────────────
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });

    // ── Fermer sur resize > 768px ─────────────────
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) closeMenu();
    });

    // ── Fermer en cliquant sur un lien du menu ───
    menu.querySelectorAll('a.mobile-link').forEach((link) => {
      link.addEventListener('click', () => {
        // Petit délai pour laisser la navigation se lancer avant la fermeture
        setTimeout(closeMenu, 80);
      });
    });

    // ── Marquer le lien actif ─────────────────────
    markActiveLinks();

    // ── Synchroniser les badges mobiles ──────────
    syncMobileBadges();
  }

  // ─────────────────────────────────────────────
  // OPEN / CLOSE
  // ─────────────────────────────────────────────
  function openMenu() {
    const toggle  = document.getElementById('navToggle');
    const menu    = document.getElementById('mobileMenu');
    const overlay = document.getElementById('navOverlay');

    menu.classList.add('open');
    overlay?.classList.add('active');
    toggle?.setAttribute('aria-expanded', 'true');

    // Icônes hamburger → X
    toggle?.querySelector('.icon-menu')?.classList.add('hidden');
    toggle?.querySelector('.icon-close')?.classList.remove('hidden');

    // Bloquer le scroll du body
    document.body.style.overflow = 'hidden';

    // Focus sur le premier lien du menu (accessibilité)
    const firstLink = menu.querySelector('a.mobile-link, button.mobile-link');
    firstLink?.focus();
  }

  function closeMenu() {
    const toggle  = document.getElementById('navToggle');
    const menu    = document.getElementById('mobileMenu');
    const overlay = document.getElementById('navOverlay');

    menu?.classList.remove('open');
    overlay?.classList.remove('active');
    toggle?.setAttribute('aria-expanded', 'false');

    // Icônes X → hamburger
    toggle?.querySelector('.icon-menu')?.classList.remove('hidden');
    toggle?.querySelector('.icon-close')?.classList.add('hidden');

    // Restaurer le scroll
    document.body.style.overflow = '';
  }

  // ─────────────────────────────────────────────
  // LIEN ACTIF
  // Compare le href de chaque lien avec l'URL courante
  // ─────────────────────────────────────────────
  function markActiveLinks() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // Desktop
    document.querySelectorAll('.header_btn a.btn').forEach((link) => {
      const linkPage = link.getAttribute('href')?.split('/').pop()?.split('?')[0] || '';
      if (linkPage && linkPage === currentPage) {
        link.classList.add('active-nav');
      }
    });

    // Mobile
    document.querySelectorAll('.mobile-menu a.mobile-link').forEach((link) => {
      const linkPage = link.getAttribute('href')?.split('/').pop()?.split('?')[0] || '';
      if (linkPage && linkPage === currentPage) {
        link.classList.add('active-nav');
      }
    });
  }

  // ─────────────────────────────────────────────
  // SYNC BADGES MOBILES
  // Copie les compteurs desktop (panier, messages)
  // dans leurs équivalents dans le menu mobile
  // ─────────────────────────────────────────────
  function syncMobileBadges() {
    // Observer les mutations sur les badges desktop pour les refléter sur mobile
    const targets = [
      { desktopId: 'cartBadge',  mobileId: 'mobileCartBadge'  },
      { desktopId: 'msgBadge',   mobileId: 'mobileMsgBadge'   },
      { desktopId: 'notifBadge', mobileId: 'mobileNotifBadge' },
    ];

    targets.forEach(({ desktopId, mobileId }) => {
      const desktop = document.getElementById(desktopId);
      const mobile  = document.getElementById(mobileId);
      if (!desktop || !mobile) return;

      // Sync initiale
      syncBadge(desktop, mobile);

      // Observer les changements
      new MutationObserver(() => syncBadge(desktop, mobile)).observe(desktop, {
        childList: true,
        characterData: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
      });
    });
  }

  function syncBadge(source, target) {
    const hidden = source.classList.contains('hidden');
    const count  = source.textContent.trim();
    target.textContent = count;
    target.classList.toggle('hidden', hidden || !count || count === '0');
  }

  // ─────────────────────────────────────────────
  // LANCEMENT
  // ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposer closeMenu globalement (utile pour certains scripts)
  window.NavMenu = { open: openMenu, close: closeMenu };
})();
