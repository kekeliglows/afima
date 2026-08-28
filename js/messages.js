const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// =========================
//  ÉTAT GLOBAL
// =========================
let currentUserId = null;
let activeConversation = null;
let conversations = [];

// Sélection multiple
let selectedMessages = new Set();
let selectionMode = false;

// Enregistrement vocal
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let isCancellingRecording = false;
let audioContext = null;
let analyser = null;
let dataArray = null;
let animationId = null;

// Présence en temps réel
let presenceChannel = null;

// =========================
//  INITIALISATION
// =========================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initHamburger();
    initMessages();
  });
} else {
  initHamburger();
  initMessages();
}

async function initMessages() {
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    currentUserId = session.user.id;

    document.getElementById('btnLogout')?.addEventListener('click', logout);
    document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);
    document.getElementById('convSearch')?.addEventListener('input', filterConversations);
    document.getElementById('chatInputForm')?.addEventListener('submit', sendMessage);
    document.getElementById('chatBack')?.addEventListener('click', () => switchChat(null));

    // Gestion du microphone
    const voiceBtn = document.getElementById('chatVoiceBtn');
    if (voiceBtn) {
      voiceBtn.addEventListener('mousedown', startVoiceRecording);
      voiceBtn.addEventListener('mouseup', stopVoiceRecording);
      voiceBtn.addEventListener('mouseleave', cancelVoiceRecording);
      voiceBtn.addEventListener('touchstart', startVoiceRecording, { passive: false });
      voiceBtn.addEventListener('touchend', stopVoiceRecording);
    }

    // Gestion des pièces jointes
    const attachBtn = document.getElementById('chatAttachBtn');
    const fileInput = document.getElementById('fileInput');
    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', sendFileMessage);
    }

    // Indicateurs de saisie (typing)
    const input = document.getElementById('chatInput');
    if (input) {
      input.addEventListener('focus', () => updatePresenceStatus('typing'));
      input.addEventListener('blur', () => updatePresenceStatus('online'));
    }

    window.addEventListener('resize', handleResize);

    await loadConversations();
    await markAllReceivedAsDelivered();
    await openConversationFromUrl();
    subscribeRealtime();

  } catch (error) {
    console.error('Erreur initialisation :', error);
  }
}

// =========================
//  FILTRAGE DES MESSAGES MASQUÉS
// =========================
function isMessageHiddenForCurrentUser(msg) {
  const isMine = String(msg.sender_id) === String(currentUserId);
  if (msg.deleted_for_everyone) return true;
  if (isMine && msg.deleted_for_sender) return true;
  if (!isMine && msg.deleted_for_recipient) return true;
  return false;
}

// =========================
//  CHARGEMENT DES CONVERSATIONS
// =========================
async function loadConversations() {
  const { data, error } = await sb
    .from('messages')
    .select(`
      *,
      sender:sender_id ( id, full_name, avatar_url ),
      recipient:recipient_id ( id, full_name, avatar_url )
    `)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadConversations :', error);
    return;
  }

  const grouped = (data || []).reduce((acc, msg) => {
    const otherId = String(msg.sender_id) === String(currentUserId) ? msg.recipient_id : msg.sender_id;
    if (!acc[otherId]) acc[otherId] = [];
    acc[otherId].push(msg);
    return acc;
  }, {});

  conversations = Object.entries(grouped).map(([otherId, allMessages]) => {
    const visibleMessages = allMessages.filter(msg => !isMessageHiddenForCurrentUser(msg));

    const last = visibleMessages.length > 0 ? visibleMessages[visibleMessages.length - 1] : null;
    const lastRaw = allMessages[allMessages.length - 1];
    const otherProfile = lastRaw ? (String(lastRaw.sender_id) === String(currentUserId) ? lastRaw.recipient : lastRaw.sender) : null;
    const unread = visibleMessages.filter(m => String(m.recipient_id) === String(currentUserId) && !m.read).length;

    let preview = 'Démarrez la conversation.';
    if (last) {
      if (last.type === 'audio') preview = 'Message vocal';
      else if (last.type === 'image') preview = 'Image';
      else if (last.type === 'file') preview = 'Fichier';
      else preview = last.content || 'Message';
    }

    return {
      otherId,
      otherName: otherProfile?.full_name || 'Utilisateur',
      otherAvatar: otherProfile?.avatar_url || null,
      lastMessage: preview,
      lastDate: last?.created_at || new Date().toISOString(),
      unread,
      messages: visibleMessages
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

function renderConversations(list) {
  const container = document.getElementById('convList');
  const unreadTotal = document.getElementById('unreadTotal');
  if (!container) return;

  const totalUnread = list.reduce((sum, item) => sum + item.unread, 0);
  if (unreadTotal) {
    unreadTotal.textContent = totalUnread > 0 ? totalUnread : '';
    unreadTotal.classList.toggle('hidden', totalUnread === 0);
  }

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
      </div>
    `;
  }).join('');

  container.querySelectorAll('.conv-item').forEach(item => {
    item.addEventListener('click', () => selectConversation(item.dataset.id));
  });
}

function filterConversations(event) {
  const query = event.target.value.trim().toLowerCase();
  const filtered = conversations.filter(conv =>
    conv.otherName.toLowerCase().includes(query) ||
    (conv.lastMessage && conv.lastMessage.toLowerCase().includes(query))
  );
  renderConversations(filtered);
}

async function selectConversation(otherId) {
  selectedMessages.clear();
  selectionMode = false;
  activeConversation = conversations.find(c => c.otherId === otherId);
  if (!activeConversation) return;
  renderChat();
  switchChat(otherId);
  subscribeToPresence(otherId);
  await markAsRead(otherId);

  if (window.innerWidth <= 768) {
    document.getElementById('chatSidebar')?.classList.add('hidden-mobile');
    document.getElementById('chatArea')?.classList.remove('hidden-mobile');
  }
}

async function openConversationFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const toId = params.get('to');
  if (!toId || String(toId) === String(currentUserId)) return;

  const existing = conversations.find(c => c.otherId === toId);
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
    if (profile) {
      otherName = profile.full_name || otherName;
      otherAvatar = profile.avatar_url || null;
    }
  } catch (error) {
    console.warn('Profil indisponible :', error.message);
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
  subscribeToPresence(toId);
}

// =========================
//  AFFICHAGE DE LA ZONE DE CHAT
// =========================
async function renderChat() {
  const chatMessagesEl = document.getElementById('chatMessages');
  const chatTitleEl = document.getElementById('chatTopbarName');
  const chatAvatarEl = document.getElementById('chatTopbarAvatar');

  if (!activeConversation || !chatMessagesEl) return;

  if (chatTitleEl) chatTitleEl.textContent = activeConversation.otherName;
  if (chatAvatarEl) {
    chatAvatarEl.innerHTML = activeConversation.otherAvatar
      ? `<img src="${escapeHtml(activeConversation.otherAvatar)}" alt="Avatar">`
      : escapeHtml(activeConversation.otherName.slice(0, 2).toUpperCase());
  }

  const visibleMessages = (activeConversation.messages || []).filter(msg => !isMessageHiddenForCurrentUser(msg));

  if (visibleMessages.length === 0) {
    chatMessagesEl.innerHTML = '<div class="empty-chat-msg"><p>Aucun message dans cette conversation.</p></div>';
    updateWhatsappSelectionHeader();
    return;
  }

  // Le bucket voice-notes est privé : on résout les URLs signées de
  // toutes les pièces jointes AVANT de construire le HTML (une URL
  // signée ne peut pas être obtenue de façon synchrone).
  const mediaTypes = ['image', 'audio', 'file'];
  const signedUrls = {};
  await Promise.all(
    visibleMessages
      .filter(msg => mediaTypes.includes(msg.type) && msg.content)
      .map(async msg => {
        try {
          const { data, error } = await sb.storage.from('voice-notes').createSignedUrl(msg.content, 3600);
          if (!error && data) signedUrls[msg.id] = data.signedUrl;
        } catch (e) {
          console.warn('URL signée indisponible :', e.message);
        }
      })
  );

  chatMessagesEl.innerHTML = visibleMessages.map(msg => {
    const isMine = String(msg.sender_id) === String(currentUserId);
    const isSelected = selectedMessages.has(msg.id);

    // Conservation de l'alignement droite/gauche sans impacter le style CSS
    const alignStyle = isMine 
      ? 'align-self: flex-end; margin-left: auto; margin-right: 0;' 
      : 'align-self: flex-start; margin-right: auto; margin-left: 0;';

    const msgClass = (isMine ? 'msg-me' : 'msg-other') + (isSelected ? ' selected' : '');

    // Accusés de réception : 1 trait gris (envoyé), 2 traits gris (reçu), 2 traits bleus (lu)
    let statusIconHtml = '';
    if (isMine) {
      if (msg.read) {
        statusIconHtml = '<span class="msg-status-read" style="color: #34b7f1; font-weight: bold; margin-left: 3px;">✓✓</span>';
      } else if (msg.delivered) {
        statusIconHtml = '<span class="msg-status-delivered" style="color: currentColor; opacity: 0.6; margin-left: 3px;">✓✓</span>';
      } else {
        statusIconHtml = '<span class="msg-status-sent" style="color: currentColor; opacity: 0.6; margin-left: 3px;">✓</span>';
      }
    }

    let contentHtml = '';
    const mediaUrl = signedUrls[msg.id] || null;
    if (msg.type === 'image') {
      contentHtml = mediaUrl
        ? `<img src="${escapeHtml(mediaUrl)}" alt="Image" class="chat-img" onclick="window.open('${escapeHtml(mediaUrl)}', '_blank')">`
        : `<p style="margin:0;font-style:italic;">Image indisponible</p>`;
    } else if (msg.type === 'audio') {
      contentHtml = mediaUrl
        ? `<audio controls preload="metadata" src="${escapeHtml(mediaUrl)}"></audio>`
        : `<p style="margin:0;font-style:italic;">Vocal indisponible</p>`;
    } else if (msg.type === 'file') {
      contentHtml = mediaUrl
        ? `<a href="${escapeHtml(mediaUrl)}" target="_blank" rel="noopener">📄 Télécharger le fichier</a>`
        : `<p style="margin:0;font-style:italic;">Fichier indisponible</p>`;
    } else {
      contentHtml = `<p style="margin:0;">${escapeHtml(msg.content)}</p>`;
    }

    return `
      <div class="message-bubble ${msgClass}" data-id="${msg.id}" style="${alignStyle}">
        ${selectionMode ? `<input type="checkbox" class="msg-select-checkbox" ${isSelected ? 'checked' : ''} style="margin-right:8px;" />` : ''}
        <div class="msg-content">${contentHtml}</div>
        <div class="msg-meta">
          <span class="msg-time">${formatTime(msg.created_at)}</span>
          ${statusIconHtml}
          <button class="msg-delete-btn" onclick="event.stopPropagation(); openDeleteMenu('${msg.id}', ${isMine})">⋮</button>
        </div>
      </div>
    `;
  }).join('');

  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

  // Écouteurs pour sélection multiple
  chatMessagesEl.querySelectorAll('.message-bubble').forEach(el => {
    let pressTimer;
    const id = el.dataset.id;

    el.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => {
        selectionMode = true;
        toggleMessageSelection(id);
      }, 500);
    });
    el.addEventListener('touchend', () => clearTimeout(pressTimer));

    el.addEventListener('click', () => {
      if (selectionMode) {
        toggleMessageSelection(id);
      }
    });
    el.addEventListener('dblclick', () => {
      if (!selectionMode) {
        selectionMode = true;
        toggleMessageSelection(id);
      }
    });
  });

  updateWhatsappSelectionHeader();
}

// =========================
//  SÉLECTION MULTIPLE & ACTION BARRE
// =========================
function toggleMessageSelection(id) {
  if (selectedMessages.has(id)) {
    selectedMessages.delete(id);
  } else {
    selectedMessages.add(id);
  }
  if (selectedMessages.size === 0) {
    selectionMode = false;
  }
  renderChat();
}

function updateWhatsappSelectionHeader() {
  const chatArea = document.getElementById('chatArea');
  let bar = document.getElementById('whatsappSelectionHeader');

  if (selectedMessages.size === 0) {
    if (bar) bar.remove();
    selectionMode = false;
    return;
  }

  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'whatsappSelectionHeader';
    bar.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 60px;
      background: #075e54;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 1000;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    if (chatArea) {
      chatArea.style.position = 'relative';
      chatArea.appendChild(bar);
    }
  }

  const selectedList = Array.from(selectedMessages);
  const allMine = selectedList.every(id => {
    const msg = activeConversation?.messages.find(m => m.id === id);
    return msg && String(msg.sender_id) === String(currentUserId);
  });

  bar.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;">
      <button id="cancelSelHeaderBtn" style="background:none;border:none;color:white;font-size:20px;cursor:pointer;">✕</button>
      <span style="font-weight:600;font-size:16px;">${selectedMessages.size} sélectionné(s)</span>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="deleteForMeHeaderBtn" style="background:#dc2626;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Supprimer pour moi</button>
      ${allMine ? `<button id="deleteForEveryoneHeaderBtn" style="background:#b91c1c;color:white;border:none;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">Supprimer pour tous</button>` : ''}
    </div>
  `;

  document.getElementById('cancelSelHeaderBtn').onclick = () => {
    selectedMessages.clear();
    selectionMode = false;
    renderChat();
  };

  document.getElementById('deleteForMeHeaderBtn').onclick = () => deleteSelectedMessages('forMe');
  document.getElementById('deleteForEveryoneHeaderBtn')?.addEventListener('click', () => deleteSelectedMessages('forEveryone'));
}

async function deleteSelectedMessages(scope) {
  const ids = Array.from(selectedMessages);
  if (ids.length === 0) return;

  if (scope === 'forMe') {
    const updates = ids.map(id => {
      const msg = activeConversation?.messages.find(m => m.id === id);
      if (!msg) return null;
      const isMine = String(msg.sender_id) === String(currentUserId);
      const column = isMine ? 'deleted_for_sender' : 'deleted_for_recipient';
      return { id, column };
    }).filter(Boolean);

    await Promise.all(updates.map(({ id, column }) =>
      sb.from('messages').update({ [column]: true }).eq('id', id)
    ));
  } else {
    const mineIds = ids.filter(id => {
      const msg = activeConversation?.messages.find(m => m.id === id);
      return msg && String(msg.sender_id) === String(currentUserId);
    });

    if (mineIds.length === 0) {
      alert('Vous ne pouvez supprimer pour tout le monde que vos propres messages.');
      return;
    }

    if (!confirm(`Supprimer ${mineIds.length} message(s) pour tout le monde ?`)) return;

    await Promise.all(mineIds.map(id =>
      sb.from('messages')
        .update({ deleted_for_everyone: true, content: '' })
        .eq('id', id)
        .eq('sender_id', currentUserId)
    ));
  }

  selectedMessages.clear();
  selectionMode = false;
  await loadConversations();
}

// =========================
//  SUPPRESSION INDIVIDUELLE PERSISTANTE
// =========================
function openDeleteMenu(messageId, isMine) {
  const modal = document.createElement('div');
  modal.id = 'deleteModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML = `
    <div style="background:white;padding:24px;border-radius:16px;max-width:300px;width:100%;color:#000;">
      <h4 style="margin:0 0 12px;">Supprimer ce message ?</h4>
      <button id="deleteForMeBtn" style="display:block;width:100%;padding:12px;margin-bottom:8px;border:none;border-radius:8px;background:#f3f4f6;cursor:pointer;">Effacer pour moi</button>
      ${isMine ? `<button id="deleteForEveryoneBtn" style="display:block;width:100%;padding:12px;margin-bottom:8px;border:none;border-radius:8px;background:#fee2e2;color:#b91c1c;cursor:pointer;">Effacer pour tout le monde</button>` : ''}
      <button id="cancelDeleteBtn" style="display:block;width:100%;padding:12px;border:none;border-radius:8px;background:#e5e7eb;cursor:pointer;">Annuler</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('deleteForMeBtn').addEventListener('click', async () => {
    await deleteMessageForMe(messageId, isMine);
    modal.remove();
  });
  document.getElementById('deleteForEveryoneBtn')?.addEventListener('click', async () => {
    await deleteMessageForEveryone(messageId);
    modal.remove();
  });
  document.getElementById('cancelDeleteBtn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function deleteMessageForMe(messageId, isMine) {
  const column = isMine ? 'deleted_for_sender' : 'deleted_for_recipient';
  const { error } = await sb.from('messages').update({ [column]: true }).eq('id', messageId);
  if (error) {
    console.error('deleteForMe :', error);
    alert('Erreur lors de la suppression : ' + error.message);
    return;
  }
  await loadConversations();
}

async function deleteMessageForEveryone(messageId) {
  if (!confirm('Ce message sera supprimé pour tous. Continuer ?')) return;

  const msg = activeConversation?.messages.find(m => m.id === messageId);

  const { error } = await sb
    .from('messages')
    .update({ deleted_for_everyone: true, content: '' })
    .eq('id', messageId)
    .eq('sender_id', currentUserId);

  if (error) {
    console.error('deleteForEveryone :', error);
    alert('Erreur lors de la suppression : ' + error.message);
    return;
  }

  // Nettoyage optionnel du fichier Storage associé (content est
  // désormais directement le chemin dans le bucket privé)
  if (msg && (msg.type === 'audio' || msg.type === 'image' || msg.type === 'file') && msg.content) {
    try {
      await sb.storage.from('voice-notes').remove([msg.content]);
    } catch (err) {
      console.warn('Nettoyage du Storage ignoré :', err.message);
    }
  }

  await loadConversations();
}

// =========================
//  ENVOI DE MESSAGES & FICHIERS
// =========================
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
    console.error('sendMessage :', error);
    alert('Impossible d\'envoyer le message.');
    return;
  }

  input.value = '';
  await updatePresenceStatus('online');
}

async function sendFileMessage() {
  const fileInput = document.getElementById('fileInput');
  const file = fileInput.files[0];
  if (!file || !activeConversation) return;

  let fileType = 'file';
  if (file.type.startsWith('image/')) fileType = 'image';

  const safeName = file.name.replace(/[^\w.-]/g, '_');
  const filePath = `${currentUserId}/file_${Date.now()}_${safeName}`;

  try {
    const { error: uploadError } = await sb.storage
      .from('voice-notes')
      .upload(filePath, file, { contentType: file.type, cacheControl: '3600' });

    if (uploadError) {
      alert('Upload : ' + uploadError.message);
      return;
    }

    const message = {
      sender_id: currentUserId,
      recipient_id: activeConversation.otherId,
      content: filePath,
      type: fileType,
      read: false,
      delivered: false,
    };

    const { error: insertError } = await sb.from('messages').insert([message]);
    if (insertError) {
      alert('Erreur envoi : ' + insertError.message);
      return;
    }

    fileInput.value = '';
  } catch (err) {
    console.error('sendFileMessage :', err);
    alert('Erreur lors de l\'envoi du fichier.');
  }
}

async function sendAudioMessage(filePath) {
  if (!activeConversation) return;

  const message = {
    sender_id: currentUserId,
    recipient_id: activeConversation.otherId,
    content: filePath,
    type: 'audio',
    read: false,
    delivered: false,
  };

  const { error } = await sb.from('messages').insert([message]);
  if (error) {
    console.error('sendAudioMessage :', error);
    alert('Erreur envoi vocal.');
  }
}

// =========================
//  ENREGISTREMENT VOCAL & ÉGALISEUR
// =========================
async function startVoiceRecording() {
  if (isRecording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
    const mime = mimeTypes.find(t => MediaRecorder.isTypeSupported(t));
    mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);

    audioChunks = [];
    isCancellingRecording = false;

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const equalizer = document.getElementById('voiceEqualizer');
    if (equalizer) equalizer.style.display = 'flex';
    animateEqualizer();

    const voiceBtn = document.getElementById('chatVoiceBtn');
    const input = document.getElementById('chatInput');
    voiceBtn?.classList.add('recording');
    if (input) {
      input.placeholder = 'Enregistrement... (relâchez pour envoyer)';
      input.disabled = true;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stopEqualizer();
      if (equalizer) equalizer.style.display = 'none';
      if (input) {
        input.placeholder = 'Écrire un message...';
        input.disabled = false;
      }
      voiceBtn?.classList.remove('recording');

      if (isCancellingRecording) {
        stream.getTracks().forEach(t => t.stop());
        audioChunks = [];
        isRecording = false;
        isCancellingRecording = false;
        await updatePresenceStatus('online');
        return;
      }

      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunks, { type: mimeType });

      // CONTRÔLE ANTI-0 OCTET (Évite l'erreur HTTP 416)
      if (blob.size === 0) {
        console.warn('Vocal vide (0 octet). Envoi annulé.');
        stream.getTracks().forEach(t => t.stop());
        isRecording = false;
        await updatePresenceStatus('online');
        return;
      }

      const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'webm';
      const filePath = `${currentUserId}/voice_${Date.now()}.${ext}`;

      try {
        const { error: uploadError } = await sb.storage
          .from('voice-notes')
          .upload(filePath, blob, { contentType: blob.type || mimeType, cacheControl: '3600', upsert: true });

        if (uploadError) {
          console.error('Upload vocal :', uploadError);
          alert('Erreur d\'envoi du vocal : ' + uploadError.message);
        } else {
          await sendAudioMessage(filePath);
        }
      } catch (err) {
        console.error('Erreur traitement audio :', err);
      } finally {
        stream.getTracks().forEach(t => t.stop());
        isRecording = false;
        await updatePresenceStatus('online');
      }
    };

    mediaRecorder.start();
    isRecording = true;
    await updatePresenceStatus('recording');

  } catch (err) {
    console.error('Microphone :', err);
    alert('Autorisez l\'accès au microphone.');
    stopEqualizer();
    const equalizer = document.getElementById('voiceEqualizer');
    const input = document.getElementById('chatInput');
    if (equalizer) equalizer.style.display = 'none';
    if (input) {
      input.placeholder = 'Écrire un message...';
      input.disabled = false;
    }
    document.getElementById('chatVoiceBtn')?.classList.remove('recording');
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function cancelVoiceRecording() {
  if (mediaRecorder && isRecording && mediaRecorder.state !== 'inactive') {
    isCancellingRecording = true;
    mediaRecorder.stop();
  }
}

function animateEqualizer() {
  const bars = document.querySelectorAll('#voiceEqualizer .eq-bar');
  if (!analyser || !bars.length) return;

  analyser.getByteFrequencyData(dataArray);
  const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
  const normalized = Math.min(avg / 128, 1);

  bars.forEach(bar => {
    const height = 5 + normalized * 30 * (0.5 + Math.random() * 0.5);
    bar.style.height = `${Math.min(height, 40)}px`;
  });

  animationId = requestAnimationFrame(animateEqualizer);
}

function stopEqualizer() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  document.querySelectorAll('#voiceEqualizer .eq-bar').forEach(bar => {
    bar.style.height = '5px';
  });
}

// =========================
//  ACCUSÉS DE RÉCEPTION & PRÉSENCE
// =========================
async function markAllReceivedAsDelivered() {
  const { error } = await sb
    .from('messages')
    .update({ delivered: true })
    .eq('recipient_id', currentUserId)
    .eq('delivered', false);
  if (error) console.warn('delivered :', error.message);
}

async function markAsRead(otherId) {
  if (!activeConversation) return;
  const unreadIds = activeConversation.messages
    .filter(m => String(m.recipient_id) === String(currentUserId) && !m.read)
    .map(m => m.id);
  if (unreadIds.length === 0) return;

  const { error } = await sb
    .from('messages')
    .update({ read: true, delivered: true })
    .in('id', unreadIds);
  if (error) {
    console.warn('markAsRead :', error.message);
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

function subscribeToPresence(otherId) {
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
    for (const [userId, presences] of Object.entries(state)) {
      if (String(userId) !== String(currentUserId) && presences.length > 0) {
        const status = presences[0].status || 'online';
        if (status === 'typing') displayStatus = 'En train d\'écrire...';
        else if (status === 'recording') displayStatus = 'Enregistre un vocal...';
        else displayStatus = 'En ligne';
        break;
      }
    }
    if (activeConversation && activeConversation.otherId === otherId) {
      const topbarSub = document.getElementById('chatTopbarSub');
      if (topbarSub) topbarSub.textContent = displayStatus;
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
    console.warn('updatePresenceStatus :', e.message);
  }
}

// =========================
//  TEMPS RÉEL (REALTIME)
// =========================
function subscribeRealtime() {
  sb.channel('messages-recues')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `recipient_id=eq.${currentUserId}`
    }, async (payload) => {
      const msg = payload.new;
      if (!msg.delivered) {
        await sb.from('messages').update({ delivered: true }).eq('id', msg.id);
      }
      await loadConversations();
    })
    .subscribe();

  sb.channel('messages-envoyees')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `sender_id=eq.${currentUserId}`
    }, () => loadConversations())
    .subscribe();

  sb.channel('messages-updates')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'messages'
    }, () => loadConversations())
    .subscribe();
}

// =========================
//  UTILITAIRES & DÉCONNEXION
// =========================
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
    if (window.innerWidth <= 768) {
      sidebar?.classList.remove('hidden-mobile');
      area?.classList.add('hidden-mobile');
    }
    renderConversations(conversations);
    return;
  }

  chatEmpty?.classList.add('hidden');
  chatActive?.classList.remove('hidden');
}

async function logout() {
  try {
    await sb.auth.signOut();
    window.location.href = '../index.html';
  } catch (err) {
    console.error('logout :', err);
    alert('Erreur de déconnexion.');
  }
}

function initHamburger() {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('mobileMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    toggle.querySelector('.icon-menu')?.classList.toggle('hidden', !isOpen);
    toggle.querySelector('.icon-close')?.classList.toggle('hidden', isOpen);
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !toggle.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
      toggle.querySelector('.icon-menu')?.classList.remove('hidden');
      toggle.querySelector('.icon-close')?.classList.add('hidden');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
}

function handleResize() {
  const isMobile = window.innerWidth <= 768;
  const sidebar = document.getElementById('chatSidebar');
  const area = document.getElementById('chatArea');

  if (!isMobile) {
    sidebar?.classList.remove('hidden-mobile');
    area?.classList.remove('hidden-mobile');
    return;
  }

  if (activeConversation) {
    sidebar?.classList.add('hidden-mobile');
    area?.classList.remove('hidden-mobile');
  } else {
    sidebar?.classList.remove('hidden-mobile');
    area?.classList.add('hidden-mobile');
  }
}

function formatTime(value) {
  try { return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function formatDate(value) {
  try { return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch { return ''; }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (tag) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[tag]));
}