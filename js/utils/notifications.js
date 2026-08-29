// ── NOTIFICATIONS ──
// Même convention que Cart/Litiges/Verification : { supabaseClient, ... } explicite.

const NOTIF_ICONS = {
  systeme: 'megaphone',
  commande: 'package',
  message: 'message-circle'
};

async function getNotifications({ supabaseClient, userId, limit = 20 }) {
  if (!userId || !supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

async function getUnreadCount({ supabaseClient, userId }) {
  if (!userId || !supabaseClient) return 0;
  const { count, error } = await supabaseClient
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) return 0;
  return count || 0;
}

async function markAsRead({ supabaseClient, notificationId }) {
  const { error } = await supabaseClient
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

async function markAllAsRead({ supabaseClient, userId }) {
  const { error } = await supabaseClient
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

// Petit "ding" à deux tonalités généré à la volée — pas de fichier audio
// à héberger, fonctionne hors-ligne, aucune dépendance externe.
function playNotificationSound() {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    const ctx = new AudioCtor();
    const now = ctx.currentTime;

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration + 0.02);
    };

    playTone(880, 0, 0.12);
    playTone(1174.66, 0.1, 0.18);
  } catch (e) {
    console.warn('Son de notification indisponible :', e.message);
  }
}

function subscribeToNotifications({ supabaseClient, userId, onInsert }) {
  if (!userId || !supabaseClient) return null;
  return supabaseClient
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, (payload) => {
      playNotificationSound();
      onInsert?.(payload.new);
    })
    .subscribe();
}

function escapeHtmlNotif(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatNotifDate(value) {
  try {
    const date = new Date(value);
    const diffMin = Math.round((Date.now() - date.getTime()) / 60000);
    if (diffMin < 1) return 'À l\'instant';
    if (diffMin < 60) return `il y a ${diffMin} min`;
    if (diffMin < 1440) return `il y a ${Math.round(diffMin / 60)} h`;
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  } catch { return ''; }
}

// Branche une cloche de notifications sur des éléments DOM existants.
// Attend dans la page :
//   #btnNotifBell   (bouton cloche)
//   #notifBadge     (badge du nombre non lus)
//   #notifDropdown  (panneau déroulant)
//   #notifList      (conteneur de la liste)
//   #btnMarkAllRead (optionnel : bouton "tout marquer comme lu")
function ensureNotifDom() {
  const existingBtn = document.getElementById('btnNotifBell');
  if (existingBtn) return;

  const wrapper = document.createElement('li');
  wrapper.className = 'notif-wrapper';
  wrapper.innerHTML = `
    <button type="button" class="btn btn-outline" id="btnNotifBell" aria-label="Notifications">
      <i data-lucide="bell"></i>
      <span class="notif-badge hidden" id="notifBadge">0</span>
    </button>
    <div class="notif-dropdown hidden" id="notifDropdown">
      <div class="notif-dropdown-header">
        <span>Notifications</span>
        <button type="button" id="btnMarkAllRead">Tout marquer comme lu</button>
      </div>
      <div id="notifList" class="notif-list">
        <p class="notif-empty">Chargement...</p>
      </div>
    </div>
  `;

  const navLinks = document.getElementById('navLinks');
  if (navLinks) {
    navLinks.appendChild(wrapper);
  } else {
    const header = document.querySelector('header nav');
    if (header) {
      const ul = header.querySelector('ul, .header_btn');
      if (ul) {
        ul.appendChild(wrapper);
      } else {
        document.body.insertAdjacentElement('beforeend', wrapper);
      }
    } else {
      document.body.insertAdjacentElement('beforeend', wrapper);
    }
  }

  if (window.lucide) window.lucide.createIcons();
}

function initNotifBell({ supabaseClient, userId }) {
  ensureNotifDom();

  const btn = document.getElementById('btnNotifBell');
  const dropdown = document.getElementById('notifDropdown');
  const badge = document.getElementById('notifBadge');
  const list = document.getElementById('notifList');
  const btnMarkAll = document.getElementById('btnMarkAllRead');
  if (!btn || !dropdown || !badge || !list || !userId || !supabaseClient) return;
  if (btn.dataset.notifBound === 'true') return;
  btn.dataset.notifBound = 'true';

  async function refreshBadge() {
    const count = await getUnreadCount({ supabaseClient, userId });
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.toggle('hidden', count === 0);
  }

  async function renderList() {
    const notifs = await getNotifications({ supabaseClient, userId });

    if (notifs.length === 0) {
      list.innerHTML = '<p class="notif-empty">Aucune notification.</p>';
      return;
    }

    list.innerHTML = notifs.map(n => `
      <a class="notif-item ${n.read ? '' : 'unread'}" href="${n.link ? escapeHtmlNotif(n.link) : '#'}" data-id="${escapeHtmlNotif(n.id)}">
        <i data-lucide="${NOTIF_ICONS[n.type] || 'bell'}"></i>
        <div class="notif-item-text">
          <div class="notif-item-titre">${escapeHtmlNotif(n.titre)}</div>
          ${n.message ? `<div class="notif-item-msg">${escapeHtmlNotif(n.message)}</div>` : ''}
          <div class="notif-item-date">${formatNotifDate(n.created_at)}</div>
        </div>
      </a>
    `).join('');

    if (window.lucide) window.lucide.createIcons();

    list.querySelectorAll('.notif-item').forEach(el => {
      el.addEventListener('click', async () => {
        try { await markAsRead({ supabaseClient, notificationId: el.dataset.id }); }
        catch (e) { console.warn('markAsRead :', e.message); }
      });
    });
  }

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const willOpen = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (willOpen) {
      await renderList();
      await refreshBadge();
    }
  });

  document.addEventListener('click', (e) => {
    if (!dropdown.classList.contains('hidden') && !dropdown.contains(e.target) && !btn.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  btnMarkAll?.addEventListener('click', async () => {
    try {
      await markAllAsRead({ supabaseClient, userId });
      await renderList();
      await refreshBadge();
    } catch (e) { console.warn('markAllAsRead :', e.message); }
  });

  refreshBadge();
  subscribeToNotifications({
    supabaseClient,
    userId,
    onInsert: () => {
      refreshBadge();
      if (!dropdown.classList.contains('hidden')) renderList();
    }
  });
}

function autoInitNotifications() {
  if (!window.supabaseClient || typeof window.supabaseClient.auth?.getSession !== 'function') {
    return;
  }

  window.supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error || !data?.session?.user?.id) return;
    initNotifBell({
      supabaseClient: window.supabaseClient,
      userId: data.session.user.id
    });
  }).catch((err) => {
    console.warn('Notifications: impossible d’obtenir la session utilisateur.', err);
  });
}

window.Notifications = {
  ICONS: NOTIF_ICONS,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  playNotificationSound,
  subscribeToNotifications,
  initNotifBell,
  autoInitNotifications
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoInitNotifications, { once: true });
} else {
  autoInitNotifications();
}
