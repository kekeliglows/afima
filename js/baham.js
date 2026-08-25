// ── BAHAM WIDGET ──
document.addEventListener('DOMContentLoaded', () => {
  // Créer le widget
  const widget = document.createElement('div');
  widget.innerHTML = `
    <button class="baham-trigger" id="bahamTrigger" aria-label="Ouvrir l'assistant Baham">
      <i data-lucide="message-circle"></i>
      <span class="baham-badge">?</span>
    </button>
    
    <div class="baham-widget" id="bahamWidget">
      <div class="baham-header">
        <div class="baham-avatar">B</div>
        <div class="baham-header-info">
          <h4>Baham</h4>
          <p><span class="baham-status-dot"></span> En ligne • Assistant afima</p>
        </div>
        <button class="baham-close" id="bahamClose" aria-label="Fermer">
          <i data-lucide="x"></i>
        </button>
      </div>
      
      <div class="baham-messages" id="bahamMessages">
        <!-- Messages injectés ici -->
      </div>
      
      <div class="baham-suggestions" id="bahamSuggestions"></div>
      
      <div class="baham-input-area">
        <input type="text" class="baham-input" id="bahamInput" placeholder="Posez votre question..." maxlength="500">
        <button class="baham-send" id="bahamSend" aria-label="Envoyer">
          <i data-lucide="send"></i>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(widget);

  // Éléments
  const trigger = document.getElementById('bahamTrigger');
  const closeBtn = document.getElementById('bahamClose');
  const chatWidget = document.getElementById('bahamWidget');
  const messagesEl = document.getElementById('bahamMessages');
  const input = document.getElementById('bahamInput');
  const sendBtn = document.getElementById('bahamSend');
  const suggestionsContainer = document.getElementById('bahamSuggestions');

  let isOpen = false;
  let isFirstOpen = true;

  // Ouvrir/Fermer
  function toggle() {
    isOpen = !isOpen;
    chatWidget.classList.toggle('open', isOpen);
    trigger.classList.toggle('active', isOpen);
    
    if (isOpen && isFirstOpen) {
      isFirstOpen = false;
      setTimeout(() => {
        addBotMessage(Baham.getWelcome());
      }, 600);
    }
    
    if (isOpen) input.focus();
  }

  trigger.addEventListener('click', toggle);
  closeBtn.addEventListener('click', toggle);

  // Ajouter message bot
  function addBotMessage(text) {
    const typing = document.createElement('div');
    typing.className = 'baham-msg bot baham-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    setTimeout(() => {
      typing.remove();
      const msg = document.createElement('div');
      msg.className = 'baham-msg bot';
      msg.textContent = text;
      messagesEl.appendChild(msg);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }, 800 + Math.random() * 400);
  }

  // Ajouter message utilisateur
  function addUserMessage(text) {
    const msg = document.createElement('div');
    msg.className = 'baham-msg user';
    msg.textContent = text;
    messagesEl.appendChild(msg);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Envoyer message
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    addUserMessage(text);
    input.value = '';
    
    const response = Baham.chat(text);
    addBotMessage(response);
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  function renderSuggestions() {
    if (!suggestionsContainer) return;

    suggestionsContainer.innerHTML = '';
    Baham.getSuggestions().forEach(label => {
      const btn = document.createElement('button');
      btn.className = 'baham-suggestion';
      btn.dataset.msg = label;
      btn.textContent = label.replace('?', ' ?').trim();
      btn.addEventListener('click', () => {
        const msg = btn.dataset.msg;
        addUserMessage(msg);
        const response = Baham.chat(msg);
        addBotMessage(response);
      });
      suggestionsContainer.appendChild(btn);
    });
  }

  renderSuggestions();

  // Initialiser les icônes Lucide
  setTimeout(() => lucide.createIcons(), 100);
});
