// ============================================================
// WALLET — Portefeuille vendeur Afima
// Dépendances (dans wallet.html, avant ce fichier) :
//   supabase.js  →  window.supabaseClient
//   utils/currency.js  →  window.Currency
//   utils/notifications.js  →  window.Notifications
// ============================================================

let currentUserId = null;
let walletData    = null;  // données du wallet (balances)

const COMMISSION = 0.05; // 5 %
const MIN_WITHDRAW = 2500;

// ── Types de transaction → icône + classe CSS ──
const TX_TYPES = {
  order_payment:         { label: 'Paiement reçu',           icon: 'arrow-down-left',  cls: 'credit'  },
  escrow_release:        { label: 'Fonds libérés',           icon: 'circle-check',     cls: 'credit'  },
  commission_deduction:  { label: 'Commission Afima (5 %)',  icon: 'percent',          cls: 'debit'   },
  refund:                { label: 'Remboursement',           icon: 'rotate-ccw',       cls: 'debit'   },
  withdrawal_request:    { label: 'Retrait demandé',         icon: 'arrow-up-right',   cls: 'pending' },
  withdrawal_completed:  { label: 'Retrait effectué',        icon: 'arrow-up-right',   cls: 'debit'   },
  deposit:               { label: 'Dépôt',                   icon: 'arrow-down-left',  cls: 'credit'  },
  fee_charged:           { label: 'Frais',                   icon: 'minus-circle',     cls: 'debit'   },
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, t =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[t]));
}

function fmt(n) {
  return Currency.formatPrice(Number(n) || 0, 'XOF', 'XOF');
}

function fmtDate(val) {
  try {
    return new Date(val).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function showMsg(text, type, el = 'walletMsg') {
  const box = document.getElementById(el);
  if (!box) return;
  box.textContent = text;
  box.className = `wallet-msg ${type}`;
}

function hideMsg(el = 'walletMsg') {
  const box = document.getElementById(el);
  if (box) box.className = 'wallet-msg hidden';
}

// ── HAMBURGER ──
// ── CHARGER LE WALLET ──
async function loadWallet() {
  const { data, error } = await supabaseClient
    .from('wallets')
    .select('*')
    .eq('user_id', currentUserId)
    .maybeSingle();

  if (error) {
    showMsg('Impossible de charger votre portefeuille : ' + error.message, 'error');
    return;
  }

  walletData = data || {
    pending_balance: 0, available_balance: 0,
    withdrawn_balance: 0, total_earned: 0,
  };

  document.getElementById('balanceAvailable').textContent  = fmt(walletData.available_balance);
  document.getElementById('balancePending').textContent    = fmt(walletData.pending_balance);
  document.getElementById('balanceWithdrawn').textContent  = fmt(walletData.withdrawn_balance);
  document.getElementById('balanceEarned').textContent     = fmt(walletData.total_earned);
  document.getElementById('withdrawAvailable').textContent = fmt(walletData.available_balance);

  // Désactiver le bouton retrait si solde insuffisant
  const btnW = document.getElementById('btnWithdraw');
  if (btnW) btnW.disabled = (walletData.available_balance || 0) < MIN_WITHDRAW;
}

// ── CHARGER L'HISTORIQUE ──
async function loadTransactions() {
  const list = document.getElementById('walletTxList');
  if (!list) return;

  // Récupérer le wallet_id d'abord
  if (!walletData?.id) {
    list.innerHTML = '<p class="wallet-empty">Aucune transaction pour le moment.</p>';
    return;
  }

  const { data, error } = await supabaseClient
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', walletData.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    list.innerHTML = `<p class="wallet-empty" style="color:#dc2626">Erreur : ${escapeHtml(error.message)}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p class="wallet-empty">Aucune transaction pour le moment.</p>';
    return;
  }

  list.innerHTML = data.map(tx => {
    const meta    = TX_TYPES[tx.type] || { label: tx.type, icon: 'circle', cls: 'neutral' };
    const amountSign = meta.cls === 'credit' ? '+' : meta.cls === 'debit' ? '−' : '';
    const statusCls  = tx.status || 'completed';

    return `
      <div class="wallet-tx-item">
        <div class="tx-icon ${meta.cls}">
          <i data-lucide="${meta.icon}"></i>
        </div>
        <div class="tx-info">
          <p class="tx-label">${escapeHtml(meta.label)}</p>
          <p class="tx-date">${fmtDate(tx.created_at)}</p>
        </div>
        <span class="tx-amount ${meta.cls}">${amountSign}${fmt(tx.amount)}</span>
        <span class="tx-status ${statusCls}">${escapeHtml(statusCls)}</span>
      </div>`;
  }).join('');

  lucide.createIcons();
}

// ── CHARGER LES MOYENS DE PAIEMENT ──
async function loadPaymentMethods() {
  const select = document.getElementById('withdrawMethod');
  if (!select) return;

  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select('id, method_type, provider, account_number, account_holder')
    .eq('user_id', currentUserId)
    .eq('status', 'active');

  if (error || !data?.length) return;

  const options = data.map(m =>
    `<option value="${escapeHtml(m.id)}">${escapeHtml(m.provider || m.method_type)} — ${escapeHtml(m.account_holder || '')} (${escapeHtml(m.account_number?.slice(-4).padStart(m.account_number.length,'*'))})</option>`
  ).join('');
  select.innerHTML = `<option value="">Choisissez un moyen de paiement</option>${options}`;
}

// ── MODAL RETRAIT ──
function initWithdrawModal() {
  const btnOpen  = document.getElementById('btnWithdraw');
  const btnClose = document.getElementById('btnCloseWithdraw');
  const modal    = document.getElementById('withdrawModal');
  const form     = document.getElementById('withdrawForm');
  const amountEl = document.getElementById('withdrawAmount');

  btnOpen?.addEventListener('click', async () => {
    hideMsg('withdrawFormMsg');
    await loadPaymentMethods();
    modal?.classList.remove('hidden');
    lucide.createIcons();
  });

  btnClose?.addEventListener('click', () => modal?.classList.add('hidden'));
  modal?.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  // Calcul dynamique du net à recevoir
  amountEl?.addEventListener('input', () => {
    const amount = parseInt(amountEl.value, 10);
    const netEl  = document.getElementById('withdrawNet');
    const netVal = document.getElementById('withdrawNetVal');
    if (!netEl || !netVal) return;

    if (amount >= MIN_WITHDRAW) {
      const fee = Math.round(amount * COMMISSION);
      const net = amount - fee;
      netVal.textContent = `${fmt(net)} (frais : ${fmt(fee)})`;
      netEl.classList.remove('hidden');
    } else {
      netEl.classList.add('hidden');
    }
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitWithdraw');
    hideMsg('withdrawFormMsg');

    const amount   = parseInt(amountEl.value, 10);
    const methodId = document.getElementById('withdrawMethod').value;

    if (!amount || amount < MIN_WITHDRAW) {
      showMsg(`Montant minimum : ${fmt(MIN_WITHDRAW)}`, 'error', 'withdrawFormMsg');
      return;
    }
    if ((walletData?.available_balance || 0) < amount) {
      showMsg('Solde disponible insuffisant.', 'error', 'withdrawFormMsg');
      return;
    }
    if (!methodId) {
      showMsg('Veuillez sélectionner un moyen de paiement.', 'error', 'withdrawFormMsg');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader"></i> Traitement…';
    lucide.createIcons();

    const { error } = await supabaseClient.rpc('request_withdrawal', {
      p_amount:            amount,
      p_payment_method_id: methodId,
    });

    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="send"></i> Confirmer le retrait';
    lucide.createIcons();

    if (error) {
      showMsg('Erreur : ' + error.message, 'error', 'withdrawFormMsg');
      return;
    }

    modal.classList.add('hidden');
    showMsg('Demande de retrait enregistrée. Traitement sous 24–48h.', 'success');
    await loadWallet();
    await loadTransactions();
  });
}

// ── INIT ──
async function init() {
  
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }
  currentUserId = session.user.id;

  // Réserver le portefeuille aux vendeurs uniquement
  const { data: profile } = await supabaseClient
    .from('profiles').select('role').eq('id', currentUserId).maybeSingle();

  if (!profile || profile.role !== 'vendeur') {
    document.querySelector('.wallet-main').innerHTML = `
      <div style="text-align:center;padding:80px 20px;color:#6b7280">
        <p style="font-size:1rem;font-weight:600">Le portefeuille est réservé aux vendeurs.</p>
        <a href="profil.html" class="btn btn-primary" style="margin-top:16px;display:inline-flex;gap:6px">
          <i data-lucide="store"></i> Devenir vendeur
        </a>
      </div>`;
    lucide.createIcons();
    return;
  }

  const logout = async () => { await supabaseClient.auth.signOut(); window.location.href = '../index.html'; };
  document.getElementById('btnLogout')?.addEventListener('click', logout);
  document.getElementById('btnLogoutMobile')?.addEventListener('click', logout);

  if (window.Notifications?.initNotifBell) {
    window.Notifications.initNotifBell({ supabaseClient, userId: currentUserId });
  }

  await loadWallet();
  await loadTransactions();
  initWithdrawModal();
}

init();
