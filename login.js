document.addEventListener('DOMContentLoaded', () => {
  const SUPABASE_URL = 'https://ehkytlouakkfmtfatbmi.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_A-f-SEGhhW25sAulnHLIbA_OvyjQ9Qa';
  const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── COMPTEUR DE STATS ANIMÉ ──
  document.querySelectorAll('.stat-num').forEach(el => {
    const target = parseInt(el.dataset.target);
    const suffix = target === 98 ? '%' : '+';
    let current  = 0;
    const step   = Math.ceil(target / 60);
    const timer  = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString('fr-FR') + suffix;
      if (current >= target) clearInterval(timer);
    }, 24);
  });

  // ── ONGLETS AVEC INDICATEUR GLISSANT ──
  const tabLogin    = document.getElementById('tab-login');
  const tabSignup   = document.getElementById('tab-signup');
  const loginForm   = document.getElementById('loginForm');
  const signupForm  = document.getElementById('signupForm');
  const indicator   = document.getElementById('tabIndicator');
  const subtitle    = document.getElementById('auth-subtitle');

  function switchTab(toLogin) {
    tabLogin.classList.toggle('active', toLogin);
    tabSignup.classList.toggle('active', !toLogin);
    indicator.classList.toggle('right', !toLogin);

    loginForm.classList.toggle('active', toLogin);
    signupForm.classList.toggle('active', !toLogin);

    subtitle.textContent = toLogin
      ? 'Connectez-vous pour continuer sur afima.'
      : 'Créez votre compte gratuitement.';

    hideMessage();
  }

  tabLogin.addEventListener('click',  () => switchTab(true));
  tabSignup.addEventListener('click', () => switchTab(false));

  // ── SHOW / HIDE PASSWORD ──
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      btn.querySelector('svg').setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
      lucide.createIcons();
    });
  });

  // ── FORCE DU MOT DE PASSE ──
  const pwInput = document.getElementById('signupPassword');
  const pwBar   = document.getElementById('pwBar');
  const pwLabel = document.getElementById('pwLabel');

  const levels = [
    { min: 0,  max: 2,  color: '#ef4444', label: 'Trop faible',  width: '25%'  },
    { min: 3,  max: 4,  color: '#f97316', label: 'Faible',       width: '50%'  },
    { min: 5,  max: 6,  color: '#eab308', label: 'Moyen',        width: '75%'  },
    { min: 7,  max: 99, color: '#22c55e', label: 'Fort',         width: '100%' },
  ];

  pwInput?.addEventListener('input', () => {
    const v = pwInput.value;
    let score = 0;
    if (v.length >= 8)              score++;
    if (v.length >= 12)             score++;
    if (/[A-Z]/.test(v))            score++;
    if (/[a-z]/.test(v))            score++;
    if (/[0-9]/.test(v))            score++;
    if (/[^A-Za-z0-9]/.test(v))     score++;
    if (v.length >= 6)              score++;

    const lvl = levels.find(l => score >= l.min && score <= l.max) || levels[0];
    pwBar.style.width    = v.length ? lvl.width : '0%';
    pwBar.style.background = lvl.color;
    pwLabel.textContent  = v.length ? lvl.label : '';
    pwLabel.style.color  = lvl.color;
  });

  // ── MESSAGES ──
  const messageBox = document.getElementById('auth-message');

  function showMessage(text, isError = true) {
    messageBox.innerHTML = `<i data-lucide="${isError ? 'alert-circle' : 'check-circle'}"></i> ${text}`;
    messageBox.className = `message-box ${isError ? 'error' : 'success'}`;
    lucide.createIcons();
  }

  function hideMessage() {
    messageBox.className = 'message-box hidden';
  }

  // ── CONNEXION ──
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();
    const btn = document.getElementById('btnLogin');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Connexion...</span>';
    lucide.createIcons();

    const { error } = await client.auth.signInWithPassword({
      email:    document.getElementById('loginEmail').value,
      password: document.getElementById('loginPassword').value,
    });

    if (error) {
      showMessage(error.message);
      btn.disabled = false;
      btn.innerHTML = '<span>Se connecter</span><i data-lucide="arrow-right"></i>';
      lucide.createIcons();
    } else {
      showMessage('Connexion réussie ! Redirection...', false);
      setTimeout(() => window.location.href = 'catalogue.html', 900);
    }
  });

  // ── INSCRIPTION ──
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    hideMessage();
    const btn = document.getElementById('btnSignup');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i><span>Création...</span>';
    lucide.createIcons();

    const { error } = await client.auth.signUp({
      email:    document.getElementById('signupEmail').value,
      password: document.getElementById('signupPassword').value,
    });

    if (error) {
      showMessage(error.message);
    } else {
      showMessage('Compte créé ! Vérifiez votre boîte mail.', false);
      signupForm.reset();
      pwBar.style.width = '0%';
      pwLabel.textContent = '';
    }
    btn.disabled = false;
    btn.innerHTML = '<span>Créer mon compte</span><i data-lucide="arrow-right"></i>';
    lucide.createIcons();
  });
});
