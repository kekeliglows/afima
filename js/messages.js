const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentUserId = null;
let activeConversation = null;
let conversations = [];

// ============ VARIABLES POUR VOCAL ============
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// ============ VARIABLES POUR PRÉSENCE ============
let presenceChannel = null;

initHamburger();
initMessages();

// ============ INITIALISATION ============
async function initMessages() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      // Sur desktop, on enlève les classes hidden-mobile pour tout le monde
      document.getElementById('chatSidebar')?.classList.remove('hidden-mobile');
      document.getElementById('chatArea')?.classList.remove('hidden-mobile');
    } else {
      // Sur mobile, si une conversation est active, on cache la sidebar
      if (activeConversation) {
        document.getElementById('chatSidebar')?.classList.add('hidden-mobile');
        document.getElementById('chatArea')?.classList.remove('hidden-mobile');
      } else {
        document.getElementById('chatSidebar')?.classList.remove('hidden-mobile');
        document.getElementById('chatArea')?.classList.add('hidden-mobile');
      }
    }
    // Dans initMessages(), après les autres écouteurs
    window.addEventListener('resize', handleResize);
  });
  function handleResize() {
  const isMobile = window.innerWidth <= 768;
  const sidebar = document.getElementById('chatSidebar');
  const area = document.getElementById('chatArea');

  if (!isMobile) {
    // Desktop : tout afficher
    sidebar?.classList.remove('hidden-mobile');
    area?.classList.remove('hidden-mobile');
  } else {
    // Mobile : adapter à l'état courant
    if (activeConversation) {
      sidebar?.classList.add('hidden-mobile');
      area?.classList.remove('hidden-mobile');
    } else {
      sidebar?.classList.remove('hidden-mobile');
      area?.classList.add('hidden-mobile');
    }
  }
}
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
  document.getElementById('convSearch')?.addEventListener('input', filterConversations);
  document.getElementById('chatInputForm')?.addEventListener('submit', sendMessage);
  document.getElementById('chatBack')?.addEventListener('click', () => switchChat(null));

  // Bouton vocal
  const voiceBtn = document.getElementById('chatVoiceBtn');
  if (voiceBtn) {
    voiceBtn.addEventListener('mousedown', startVoiceRecording);
    voiceBtn.addEventListener('mouseup', cancelRecording);
    voiceBtn.addEventListener('mouseleave', cancelRecording);
    voiceBtn.addEventListener('touchstart', startVoiceRecording);
    voiceBtn.addEventListener('touchend', cancelRecording);
  }

  // Gestion du statut "en train d'écrire"
  const input = document.getElementById('chatInput');
  if (input) {
    input.addEventListener('focus', () => updatePresenceStatus('typing'));
    input.addEventListener('blur', () => updatePresenceStatus('online'));
  }

  await loadConversations();
  await markAllReceivedAsDelivered();
  await openConversationFromUrl();
  subscribeRealtime();
}

// ============ MARQUER TOUS LES REÇUS COMME DÉLIVRÉS ============
async function markAllReceivedAsDelivered() {
  const { error } = await sb
    .from('messages')
    .update({ delivered: true })
    .eq('recipient_id', currentUserId)
    .eq('delivered', false);
  if (error) console.warn('Erreur mise à jour delivered :', error.message);
}

// ============ OUVERTURE DEPUIS L'URL ============
async function openConversationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const toId = params.get('to');
  if (!toId || toId === currentUserId) return;

  const existing = conversations.find(conv => conv.otherId === toId);
  if (existing) {
    await selectConversation(toId);
    return;
  }

  let otherName = 'Vendeur';
  let otherAvatar = null;
  try {
    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', toId)
      .maybeSingle();
    if (profile) otherName = profile.full_name || otherName;
    otherAvatar = profile?.avatar_url || null;
  } catch (err) {
    console.warn('Nom du vendeur non disponible :', err.message);
  }

  activeConversation = {
    otherId: toId,
    otherName,
    otherAvatar,
    lastMessage: null,
    lastDate: new Date().toISOString(),
    unread: 0,
    messages: []
  };

  renderChat();
  switchChat(toId);
  subscribeToPresence(toId); // Démarrer la présence pour cette nouvelle conversation
}

// ============ CHARGER LES CONVERSATIONS ============
async function loadConversations() {
  const { data, error } = await sb
    .from('messages')
    .select(`
      *,
      sender:sender_id ( id, full_name, avatar_url ),
      recipient:recipient_id ( id, full_name, avatar_url )
    `);

  if (error) {
    console.error(error);
    return;
  }

  const grouped = data.reduce((acc, message) => {
    const otherId = message.sender_id === currentUserId ? message.recipient_id : message.sender_id;
    if (!acc[otherId]) acc[otherId] = [];
    acc[otherId].push(message);
    return acc;
  }, {});

  conversations = Object.entries(grouped).map(([otherId, messages]) => {
    const last = messages[messages.length - 1];
    const other = last.sender_id === currentUserId ? last.recipient : last.sender;
    const unread = messages.filter(m => m.recipient_id === currentUserId && !m.read).length;
    return {
      otherId,
      otherName: other?.full_name || 'Utilisateur',
      otherAvatar: other?.avatar_url || null,
      lastMessage: last.content,
      lastDate: last.created_at,
      unread,
      messages,
    };
  }).sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));

  renderConversations(conversations);

  if (activeConversation) {
    const refreshed = conversations.find(c => c.otherId === activeConversation.otherId);
    if (refreshed) {
      activeConversation = refreshed;
      renderChat();
    }
  }
}

// ============ RENDU DE LA LISTE ============
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
    const nameSafe = escapeHtml(conv.otherName);
    const avatarHtml = conv.otherAvatar
      ? `<img src="${escapeHtml(conv.otherAvatar)}" alt="Avatar">`
      : escapeHtml(conv.otherName.slice(0, 2).toUpperCase());
    return `
      <div class="conv-item ${activeClass}" data-id="${escapeHtml(conv.otherId)}" tabindex="0">
        <div class="conv-avatar">${avatarHtml}</div>
        <div class="conv-info">
          <div class="conv-name">${nameSafe}</div>
          <div class="conv-last">${escapeHtml(conv.lastMessage || 'Démarrez la conversation.')}</div>
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

// ============ FILTRE ============
function filterConversations(event) {
  const query = event.target.value.trim().toLowerCase();
  const filtered = conversations.filter(conv =>
    conv.otherName.toLowerCase().includes(query) ||
    (conv.lastMessage && conv.lastMessage.toLowerCase().includes(query))
  );
  renderConversations(filtered);
}

// ============ SÉLECTIONNER UNE CONVERSATION ============
async function selectConversation(otherId) {
  activeConversation = conversations.find(conv => conv.otherId === otherId);
  if (!activeConversation) return;
  renderChat();
  switchChat(otherId);
  subscribeToPresence(otherId);
  await markAsRead(otherId);

  // --- GESTION MOBILE ---
  if (window.innerWidth <= 768) {
    document.getElementById('chatSidebar')?.classList.add('hidden-mobile');
    document.getElementById('chatArea')?.classList.remove('hidden-mobile');
  }
}

// ============ MARQUER COMME LU ============
async function markAsRead(otherId) {
  const unreadIds = (activeConversation?.messages || [])
    .filter(m => m.recipient_id === currentUserId && !m.read)
    .map(m => m.id);

  if (unreadIds.length === 0) return;

  const { error } = await sb
    .from('messages')
    .update({ read: true, delivered: true })
    .in('id', unreadIds);

  if (error) {
    console.warn('Impossible de marquer les messages comme lus :', error.message);
    return;
  }

  activeConversation.messages.forEach(m => {
    if (unreadIds.includes(m.id)) {
      m.read = true;
      m.delivered = true;
    }
  });
  activeConversation.unread = 0;
  renderConversations(conversations);
  renderChat();
}

// ============ PRÉSENCE / STATUT EN DIRECT ============
function subscribeToPresence(otherId) {
  // Se désabonner de l'ancien canal
  if (presenceChannel) {
    sb.removeChannel(presenceChannel);
    presenceChannel = null;
  }

  presenceChannel = sb.channel(`presence:${otherId}`, {
    config: { presence: { key: currentUserId } }
  });

  presenceChannel.on('presence', { event: 'sync' }, () => {
    const state = presenceChannel.presenceState();
    let displayStatus = 'En ligne';
    let found = false;

    for (const [userId, presences] of Object.entries(state)) {
      if (userId !== currentUserId && presences.length > 0) {
        const status = presences[0].presence?.status || 'online';
        found = true;
        if (status === 'typing') displayStatus = '✏️ En train d\'écrire...';
        else if (status === 'recording') displayStatus = '🎤 Enregistre un vocal...';
        else if (status === 'online') displayStatus = '🟢 En ligne';
        break;
      }
    }

    if (activeConversation && activeConversation.otherId === otherId) {
      document.getElementById('chatTopbarSub').textContent = displayStatus;
    }
  });

  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await presenceChannel.track({ status: 'online' });
    }
  });
}

async function updatePresenceStatus(status) {
  if (!presenceChannel) return;
  try {
    await presenceChannel.track({ status });
  } catch (e) {
    console.warn('Erreur mise à jour présence :', e.message);
  }
}

// ============ BASCULE ENTRE VIDE / ACTIF ============
function switchChat(otherId) {
  const chatActive = document.getElementById('chatActive');
  const chatEmpty = document.getElementById('chatEmpty');
  const sidebar = document.getElementById('chatSidebar');
  const area = document.getElementById('chatArea');

  if (!otherId) {
    activeConversation = null;
    chatActive?.classList.add('hidden');
    chatEmpty?.classList.remove('hidden');
    if (presenceChannel) {
      sb.removeChannel(presenceChannel);
      presenceChannel = null;
    }

    // --- GESTION MOBILE : réafficher la sidebar ---
    if (window.innerWidth <= 768) {
      sidebar?.classList.remove('hidden-mobile');
      area?.classList.add('hidden-mobile');
    }
    return;
  }

  chatEmpty?.classList.add('hidden');
  chatActive?.classList.remove('hidden');

  // --- GESTION MOBILE : on ne cache pas la sidebar ici, c'est fait dans selectConversation ---
}

// ============ RENDU DU CHAT (avec statuts et audio) ============
function renderChat() {
  if (!activeConversation) return;
  document.getElementById('chatTopbarName').textContent = activeConversation.otherName;
  document.getElementById('chatTopbarSub').textContent = 'Dernier message le ' + formatDate(activeConversation.lastDate);

  const avatarEl = document.getElementById('chatTopbarAvatar');
  avatarEl.innerHTML = activeConversation.otherAvatar
    ? `<img src="${escapeHtml(activeConversation.otherAvatar)}" alt="Avatar">`
    : '';

  document.getElementById('chatTopbarProduct').classList.add('hidden');

  const messagesContainer = document.getElementById('chatMessages');
  messagesContainer.innerHTML = activeConversation.messages.map(msg => {
    const isMine = msg.sender_id === currentUserId;
    let statusHtml = '';
    if (isMine) {
      if (msg.read) {
        statusHtml = '<i data-lucide="check-check" style="color: #34b7f1; width: 14px; height: 14px;"></i>';
      } else if (msg.delivered) {
        statusHtml = '<i data-lucide="check-check" style="color: #9ca3af; width: 14px; height: 14px;"></i>';
      } else {
        statusHtml = '<i data-lucide="check" style="color: #9ca3af; width: 14px; height: 14px;"></i>';
      }
    }

    let contentHtml = '';
    if (msg.type === 'audio') {
      contentHtml = `<audio controls src="${escapeHtml(msg.content)}" style="max-width: 200px; height: 40px;"></audio>`;
    } else {
      contentHtml = `<div class="msg-text">${escapeHtml(msg.content)}</div>`;
    }

    return `
      <div class="msg-bubble ${isMine ? 'mine' : 'other'}">
        ${contentHtml}
        <div class="msg-meta">
          ${formatTime(msg.created_at)}
          ${statusHtml}
        </div>
      </div>`;
  }).join('');

  lucide.createIcons();
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============ ENVOYER UN MESSAGE (TEXTE) ============
async function sendMessage(event) {
  event.preventDefault();
  if (!activeConversation) return;

  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  if (text.length > 1000) {
    alert('Message trop long (1000 caractères maximum).');
    return;
  }

  const message = {
    sender_id: currentUserId,
    recipient_id: activeConversation.otherId,
    content: text,
    type: 'text',
    read: false,
    delivered: false,
  };

  const { error } = await sb.from('messages').insert([message]);
  if (error) {
    console.error(error);
    return;
  }

  input.value = '';
  // Après avoir envoyé, on repasse en ligne
  await updatePresenceStatus('online');
}

// ============ ENREGISTREMENT VOCAL ============
async function startVoiceRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const fileName = `voice_${currentUserId}_${Date.now()}.webm`;

      const { error: uploadError } = await sb.storage
        .from('voice-notes')
        .upload(fileName, audioBlob);

      if (uploadError) {
        console.error('Erreur upload vocal :', uploadError);
        alert('Erreur lors de l\'envoi du vocal. Veuillez réessayer.');
        return;
      }

      const { data: { publicUrl } } = sb.storage
        .from('voice-notes')
        .getPublicUrl(fileName);

      await sendAudioMessage(publicUrl);

      stream.getTracks().forEach(track => track.stop());
      document.getElementById('chatVoiceBtn')?.classList.remove('recording');
      isRecording = false;
      await updatePresenceStatus('online');
    };

    mediaRecorder.start();
    isRecording = true;
    document.getElementById('chatVoiceBtn')?.classList.add('recording');
    await updatePresenceStatus('recording');

  } catch (err) {
    console.error('Erreur microphone :', err);
    alert('Autorisez l\'accès au microphone pour envoyer un vocal.');
  }
}

async function sendAudioMessage(audioUrl) {
  if (!activeConversation) return;

  const message = {
    sender_id: currentUserId,
    recipient_id: activeConversation.otherId,
    content: audioUrl,
    type: 'audio',
    read: false,
    delivered: false,
  };

  const { error } = await sb.from('messages').insert([message]);
  if (error) console.error(error);
}

function cancelRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    document.getElementById('chatVoiceBtn')?.classList.remove('recording');
    isRecording = false;
    audioChunks = [];
    updatePresenceStatus('online');
  }
}

// ============ TEMPS RÉEL ============
function subscribeRealtime() {
  sb.channel('messages-recues')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `recipient_id=eq.${currentUserId}`
    }, async (payload) => {
      const msg = payload.new;
      if (!msg.delivered) {
        await sb.from('messages').update({ delivered: true }).eq('id', msg.id);
      }
      loadConversations();
    })
    .subscribe();

  sb.channel('messages-envoyees')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `sender_id=eq.${currentUserId}`
    }, () => loadConversations())
    .subscribe();
}

// ============ DÉCONNEXION ============
function logout() {
  sb.auth.signOut().then(() => { window.location.href = '../index.html'; });
}

// ============ MENU HAMBURGER ============
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

// ============ UTILITAIRES ============
function formatTime(value) {
  const date = new Date(value);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[tag]));
}