const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUserId = null;
let activeConversation = null;
let conversations = [];

initHamburger();
initMessages();

async function initMessages() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
  document.getElementById('convSearch')?.addEventListener('input', filterConversations);
  document.getElementById('chatInputForm')?.addEventListener('submit', sendMessage);
  document.getElementById('chatBack')?.addEventListener('click', () => switchChat(null));

  await loadConversations();
  subscribeRealtime();
}

async function loadConversations() {
  const { data, error } = await sb
    .from('messages')
    .select(`*, sender:sender_id(*), recipient:recipient_id(*)`)
    .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const grouped = data.reduce((acc, message) => {
    const otherId = message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    const key = otherId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(message);
    return acc;
  }, {});

  conversations = Object.entries(grouped).map(([otherId, messages]) => {
    const last = messages[messages.length - 1];
    const other = last.sender_id === currentUserId ? last.recipient : last.sender;
    const unread = messages.filter(m => m.recipient_id === currentUserId && !m.read).length;
    return {
      otherId,
      otherName: other?.nom || other?.email || 'Utilisateur',
      otherAvatar: other?.avatar_url || null,
      lastMessage: last.content,
      lastDate: last.created_at,
      unread,
      messages,
    };
  }).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));

  renderConversations(conversations);
}

function renderConversations(list) {
  const container = document.getElementById('convList');
  const unreadTotal = document.getElementById('unreadTotal');
  if (!container) return;

  const totalUnread = list.reduce((sum, item) => sum + item.unread, 0);
  unreadTotal.textContent = totalUnread > 0 ? totalUnread : '';
  unreadTotal.classList.toggle('hidden', totalUnread === 0);

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-conv"><p>Aucune conversation pour le moment.</p></div>';
    return;
  }

  container.innerHTML = list.map(conv => {
    const activeClass = activeConversation?.otherId === conv.otherId ? 'active' : '';
    return `
      <div class="conv-item ${activeClass}" data-id="${conv.otherId}" tabindex="0">
        <div class="conv-avatar">${conv.otherAvatar ? `<img src="${conv.otherAvatar}" alt="Avatar">` : conv.otherName.slice(0,2).toUpperCase()}</div>
        <div class="conv-info">
          <div class="conv-name">${conv.otherName}</div>
          <div class="conv-last">${conv.lastMessage || 'Démarrez la conversation.'}</div>
        </div>
        <div class="conv-meta">
          <span class="conv-time">${formatTime(conv.lastDate)}</span>
          ${conv.unread ? `<span class="conv-unread">${conv.unread}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  container.querySelectorAll('.conv-item').forEach(item => {
    item.addEventListener('click', () => selectConversation(item.dataset.id));
  });
}

function filterConversations(event) {
  const query = event.target.value.trim().toLowerCase();
  const filtered = conversations.filter(conv => conv.otherName.toLowerCase().includes(query) || conv.lastMessage.toLowerCase().includes(query));
  renderConversations(filtered);
}

function selectConversation(otherId) {
  activeConversation = conversations.find(conv => conv.otherId === otherId);
  if (!activeConversation) return;
  renderChat();
  switchChat(otherId);
}

function switchChat(otherId) {
  const chatActive = document.getElementById('chatActive');
  const chatEmpty = document.getElementById('chatEmpty');
  if (!otherId) {
    activeConversation = null;
    chatActive?.classList.add('hidden');
    chatEmpty?.classList.remove('hidden');
    return;
  }
  chatEmpty?.classList.add('hidden');
  chatActive?.classList.remove('hidden');
}

function renderChat() {
  if (!activeConversation) return;
  document.getElementById('chatTopbarName').textContent = activeConversation.otherName;
  document.getElementById('chatTopbarSub').textContent = 'Dernier message le ' + formatDate(activeConversation.lastDate);
  if (activeConversation.otherAvatar) {
    const avatarEl = document.getElementById('chatTopbarAvatar');
    avatarEl.innerHTML = `<img src="${activeConversation.otherAvatar}" alt="Avatar">`;
  }

  document.getElementById('chatTopbarProduct').classList.add('hidden');
  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = activeConversation.messages.map(msg => {
    const isMine = msg.sender_id === currentUserId;
    return `
      <div class="msg-bubble ${isMine ? 'mine' : 'other'}">
        <div class="msg-text">${escapeHtml(msg.content)}</div>
        <div class="msg-meta">${formatTime(msg.created_at)}</div>
      </div>`;
  }).join('');

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage(event) {
  event.preventDefault();
  if (!activeConversation) return;

  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  const otherId = activeConversation.otherId;
  const message = {
    sender_id: currentUserId,
    recipient_id: otherId,
    content: text,
    read: false,
  };

  const { error } = await sb.from('messages').insert([message]);
  if (error) {
    console.error(error);
    return;
  }

  input.value = '';
}

function subscribeRealtime() {
  sb.channel('public:messages')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const newMsg = payload.new;
      if (!newMsg) return;

      if (newMsg.sender_id === currentUserId || newMsg.recipient_id === currentUserId) {
        loadConversations();
      }
    })
    .subscribe();
}

function logout() {
  sb.auth.signOut().then(() => { window.location.href = 'index.html'; });
}

function initHamburger() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
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
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function formatTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[tag]));
}
