// ============================================================
// AFIMA — WALLET / PORTEFEUILLE VENDEUR
// ============================================================
//
// Dépendances dans wallet.html AVANT ce fichier :
// - supabase.js       → window.supabaseClient
// - utils/currency.js → window.Currency
// - utils/notifications.js → window.Notifications
// - lucide
// ============================================================

let currentUserId = null;
let walletData = null;

const COMMISSION = 0.05; // Affichage uniquement — sécurité côté SQL
const MIN_WITHDRAW = 2500;

// ============================================================
// TYPES DE TRANSACTION
// ============================================================
const TX_TYPES = {
  order_payment: {
    label: 'Paiement de commande',
    icon: 'shopping-cart',
    cls: 'credit'
  },

  escrow_release: {
    label: 'Paiement libéré',
    icon: 'unlock',
    cls: 'credit'
  },

  commission_deduction: {
    label: 'Commission',
    icon: 'minus-circle',
    cls: 'debit'
  },

  refund: {
    label: 'Remboursement',
    icon: 'rotate-ccw',
    cls: 'debit'
  },

  withdrawal_request: {
    label: 'Demande de retrait',
    icon: 'arrow-up-right',
    cls: 'debit'
  },

  withdrawal_completed: {
    label: 'Retrait effectué',
    icon: 'check-circle',
    cls: 'debit'
  },

  withdrawal_failed: {
    label: 'Retrait échoué',
    icon: 'circle-x',
    cls: 'debit'
  },

  deposit: {
    label: 'Dépôt',
    icon: 'arrow-down-left',
    cls: 'credit'
  },

  fee_charged: {
    label: 'Frais',
    icon: 'minus-circle',
    cls: 'debit'
  }
};

// ============================================================
// UTILITAIRES
// ============================================================

function escapeHtml(str) {
  if (str == null) return '';

  return String(str).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function fmt(amount) {
  return Currency.formatPrice(
    Number(amount) || 0,
    'XOF',
    'XOF'
  );
}

function fmtDate(value) {
  if (!value) return '';

  try {
    return new Date(value).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function showMsg(text, type, elementId = 'walletMsg') {
  const box = document.getElementById(elementId);

  if (!box) return;

  box.textContent = text;
  box.className = `wallet-msg ${type}`;
}

function hideMsg(elementId = 'walletMsg') {
  const box = document.getElementById(elementId);

  if (box) {
    box.className = 'wallet-msg hidden';
    box.textContent = '';
  }
}

function refreshIcons() {
  if (window.lucide?.createIcons) {
    lucide.createIcons();
  }
}

// ============================================================
// AFFICHAGE DU WALLET
// ============================================================

function renderWallet() {
  if (!walletData) return;

  const available =
    Number(walletData.available_balance) || 0;

  const pending =
    Number(walletData.pending_balance) || 0;

  const withdrawn =
    Number(walletData.withdrawn_balance) || 0;

  const earned =
    Number(walletData.total_earned) || 0;

  const availableEl =
    document.getElementById('balanceAvailable');

  const pendingEl =
    document.getElementById('balancePending');

  const withdrawnEl =
    document.getElementById('balanceWithdrawn');

  const earnedEl =
    document.getElementById('balanceEarned');

  const withdrawAvailableEl =
    document.getElementById('withdrawAvailable');

  if (availableEl) {
    availableEl.textContent = fmt(available);
  }

  if (pendingEl) {
    pendingEl.textContent = fmt(pending);
  }

  if (withdrawnEl) {
    withdrawnEl.textContent = fmt(withdrawn);
  }

  if (earnedEl) {
    earnedEl.textContent = fmt(earned);
  }

  if (withdrawAvailableEl) {
    withdrawAvailableEl.textContent = fmt(available);
  }

  const btnWithdraw =
    document.getElementById('btnWithdraw');

  if (btnWithdraw) {
    btnWithdraw.disabled =
      available < MIN_WITHDRAW;
  }
}

// ============================================================
// CHARGER LE WALLET
// ============================================================

async function loadWallet() {
  if (!currentUserId) return false;

  const { data, error } = await supabaseClient
    .from('wallets')
    .select(`
      id,
      user_id,
      pending_balance,
      available_balance,
      withdrawn_balance,
      total_earned,
      created_at,
      updated_at
    `)
    .eq('user_id', currentUserId)
    .maybeSingle();

  if (error) {
    console.error('loadWallet:', error);

    showMsg(
      'Impossible de charger votre portefeuille : ' +
      error.message,
      'error'
    );

    return false;
  }

  // Aucun wallet existant :
  // on demande au serveur de le créer.
  if (!data) {
    const { data: createdWallet, error: createError } =
      await supabaseClient.rpc('ensure_seller_wallet');

    if (createError) {
      console.error(
        'ensure_seller_wallet:',
        createError
      );

      showMsg(
        'Impossible d’initialiser votre portefeuille : ' +
        createError.message,
        'error'
      );

      return false;
    }

    walletData = createdWallet;
  } else {
    walletData = data;
  }

  renderWallet();

  return true;
}

// ============================================================
// HISTORIQUE DES TRANSACTIONS
// ============================================================

async function loadTransactions() {
  const list =
    document.getElementById('walletTxList');

  if (!list) return;

  if (!walletData?.id) {
    list.innerHTML =
      '<p class="wallet-empty">' +
      'Aucune transaction pour le moment.' +
      '</p>';

    return;
  }

  const { data, error } = await supabaseClient
    .from('wallet_transactions')
    .select(`
      id,
      wallet_id,
      type,
      amount,
      status,
      description,
      created_at
    `)
    .eq('wallet_id', walletData.id)
    .order('created_at', {
      ascending: false
    })
    .limit(50);

  if (error) {
    console.error(
      'loadTransactions:',
      error
    );

    list.innerHTML =
      `<p class="wallet-empty" style="color:#dc2626">
        Erreur : ${escapeHtml(error.message)}
      </p>`;

    return;
  }

  if (!data?.length) {
    list.innerHTML =
      '<p class="wallet-empty">' +
      'Aucune transaction pour le moment.' +
      '</p>';

    return;
  }

  list.innerHTML = data.map(tx => {
    const meta =
      TX_TYPES[tx.type] || {
        label: tx.type || 'Transaction',
        icon: 'circle',
        cls: 'neutral'
      };

    const amount =
      Number(tx.amount) || 0;

    const amountSign =
      meta.cls === 'credit'
        ? '+'
        : meta.cls === 'debit'
          ? '−'
          : '';

    const status =
      tx.status || 'completed';

    const statusLabels = {
      pending: 'En attente',
      completed: 'Terminé',
      failed: 'Échec',
      cancelled: 'Annulé'
    };

    const statusLabel =
      statusLabels[status] || status;

    return `
      <div class="wallet-tx-item">

        <div class="tx-icon ${escapeHtml(meta.cls)}">
          <i data-lucide="${escapeHtml(meta.icon)}"></i>
        </div>

        <div class="tx-info">

          <p class="tx-label">
            ${escapeHtml(meta.label)}
          </p>

          ${
            tx.description
              ? `<p class="tx-description">
                  ${escapeHtml(tx.description)}
                 </p>`
              : ''
          }

          <p class="tx-date">
            ${escapeHtml(fmtDate(tx.created_at))}
          </p>

        </div>

        <span class="tx-amount ${escapeHtml(meta.cls)}">
          ${amountSign}${fmt(amount)}
        </span>

        <span class="tx-status ${escapeHtml(status)}">
          ${escapeHtml(statusLabel)}
        </span>

      </div>
    `;
  }).join('');

  refreshIcons();
}

// ============================================================
// MOYENS DE PAIEMENT
// ============================================================

async function loadPaymentMethods() {
  const select =
    document.getElementById('withdrawMethod');

  if (!select || !currentUserId) return;

  select.innerHTML =
    '<option value="">Chargement...</option>';

  const { data, error } = await supabaseClient
    .from('payment_methods')
    .select(`
      id,
      method_type,
      provider,
      account_number,
      account_holder
    `)
    .eq('user_id', currentUserId)
    .eq('status', 'active')
    .order('created_at', {
      ascending: false
    });

  if (error) {
    console.error(
      'loadPaymentMethods:',
      error
    );

    select.innerHTML =
      '<option value="">Impossible de charger les moyens de paiement</option>';

    return;
  }

  if (!data?.length) {
    select.innerHTML =
      '<option value="">Aucun moyen de paiement enregistré</option>';

    return;
  }

  const options = data.map(method => {

    const provider =
      method.provider ||
      method.method_type ||
      'Moyen de paiement';

    const holder =
      method.account_holder || '';

    const account =
      String(method.account_number || '');

    const maskedAccount =
      account.length > 4
        ? '*'.repeat(account.length - 4) +
          account.slice(-4)
        : account;

    return `
      <option value="${escapeHtml(method.id)}">
        ${escapeHtml(provider)}
        —
        ${escapeHtml(holder)}
        (${escapeHtml(maskedAccount)})
      </option>
    `;
  }).join('');

  select.innerHTML =
    `<option value="">
      Choisissez un moyen de paiement
    </option>` +
    options;
}

// ============================================================
// CALCUL DU RETRAIT
// ============================================================

function updateWithdrawPreview() {
  const amountEl =
    document.getElementById('withdrawAmount');

  const netEl =
    document.getElementById('withdrawNet');

  const netVal =
    document.getElementById('withdrawNetVal');

  if (!amountEl || !netEl || !netVal) return;

  const amount =
    Number.parseInt(amountEl.value, 10);

  if (!Number.isFinite(amount) ||
      amount < MIN_WITHDRAW) {

    netEl.classList.add('hidden');
    return;
  }

  const fee =
    Math.round(amount * COMMISSION);

  const net =
    amount - fee;

  netVal.textContent =
    `${fmt(net)} (frais : ${fmt(fee)})`;

  netEl.classList.remove('hidden');
}

// ============================================================
// MODAL RETRAIT
// ============================================================

function initWithdrawModal() {

  const btnOpen =
    document.getElementById('btnWithdraw');

  const btnClose =
    document.getElementById('btnCloseWithdraw');

  const modal =
    document.getElementById('withdrawModal');

  const form =
    document.getElementById('withdrawForm');

  const amountEl =
    document.getElementById('withdrawAmount');

  btnOpen?.addEventListener(
    'click',
    async () => {

      hideMsg('withdrawFormMsg');

      await loadPaymentMethods();

      modal?.classList.remove('hidden');

      refreshIcons();
    }
  );

  btnClose?.addEventListener(
    'click',
    () => {
      modal?.classList.add('hidden');
    }
  );

  modal?.addEventListener(
    'click',
    event => {

      if (event.target === modal) {
        modal.classList.add('hidden');
      }

    }
  );

  amountEl?.addEventListener(
    'input',
    updateWithdrawPreview
  );

  form?.addEventListener(
    'submit',
    async event => {

      event.preventDefault();

      const btn =
        document.getElementById(
          'btnSubmitWithdraw'
        );

      hideMsg('withdrawFormMsg');

      const amount =
        Number.parseInt(
          amountEl?.value,
          10
        );

      const methodEl =
        document.getElementById(
          'withdrawMethod'
        );

      const methodId =
        methodEl?.value;

      // Validation côté interface uniquement.
      // La vraie sécurité est dans PostgreSQL.
      if (
        !Number.isFinite(amount) ||
        amount < MIN_WITHDRAW
      ) {

        showMsg(
          `Montant minimum : ${fmt(MIN_WITHDRAW)}`,
          'error',
          'withdrawFormMsg'
        );

        return;
      }

      const available =
        Number(walletData?.available_balance) || 0;

      if (available < amount) {

        showMsg(
          'Solde disponible insuffisant.',
          'error',
          'withdrawFormMsg'
        );

        return;
      }

      if (!methodId) {

        showMsg(
          'Veuillez sélectionner un moyen de paiement.',
          'error',
          'withdrawFormMsg'
        );

        return;
      }

      if (btn) {
        btn.disabled = true;

        btn.innerHTML =
          '<i data-lucide="loader-circle"></i>' +
          ' Traitement…';

        refreshIcons();
      }

      try {

        const { data, error } =
          await supabaseClient.rpc(
            'request_withdrawal',
            {
              p_amount: amount,
              p_payment_method_id: methodId
            }
          );

        if (error) {
          throw error;
        }

        console.log(
          'Retrait créé :',
          data
        );

        modal?.classList.add('hidden');

        showMsg(
          'Demande de retrait enregistrée. ' +
          'Traitement sous 24–48h.',
          'success'
        );

        await loadWallet();
        await loadTransactions();

      } catch (error) {

        console.error(
          'request_withdrawal:',
          error
        );

        showMsg(
          'Erreur : ' + error.message,
          'error',
          'withdrawFormMsg'
        );

      } finally {

        if (btn) {

          btn.disabled = false;

          btn.innerHTML =
            '<i data-lucide="send"></i>' +
            ' Confirmer le retrait';

          refreshIcons();
        }
      }
    }
  );
}

// ============================================================
// INITIALISATION
// ============================================================

async function init() {

  try {

    if (!window.supabaseClient) {

      console.error(
        'window.supabaseClient est introuvable.'
      );

      showMsg(
        'Erreur de configuration Supabase.',
        'error'
      );

      return;
    }

    const {
      data: { session },
      error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.user?.id) {

      window.location.href =
        'login.html';

      return;
    }

    // CORRECTION IMPORTANTE
    currentUserId =
      session.user.id;

    // ========================================================
    // VÉRIFICATION DU PROFIL VENDEUR
    // ========================================================

    const {
      data: profile,
      error: profileError
    } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', currentUserId)
      .maybeSingle();

    if (profileError) {

      console.error(
        'profile:',
        profileError
      );

      showMsg(
        'Impossible de vérifier votre profil.',
        'error'
      );

      return;
    }

    if (
      !profile ||
      profile.role !== 'vendeur'
    ) {

      const walletMain =
        document.querySelector(
          '.wallet-main'
        );

      if (walletMain) {

        walletMain.innerHTML = `
          <div style="
            text-align:center;
            padding:80px 20px;
            color:#6b7280;
          ">
            <p style="
              font-size:1rem;
              font-weight:600;
            ">
              Le portefeuille est réservé aux vendeurs.
            </p>

            <a
              href="profil.html"
              class="btn btn-primary"
              style="
                margin-top:16px;
                display:inline-flex;
                gap:6px;
              "
            >
              <i data-lucide="store"></i>
              Devenir vendeur
            </a>
          </div>
        `;

        refreshIcons();
      }

      return;
    }

    // ========================================================
    // LOGOUT
    // ========================================================

    const logout = async () => {

      await supabaseClient.auth.signOut();

      window.location.href =
        '../index.html';
    };

    document
      .getElementById('btnLogout')
      ?.addEventListener(
        'click',
        logout
      );

    document
      .getElementById('btnLogoutMobile')
      ?.addEventListener(
        'click',
        logout
      );

    // ========================================================
    // NOTIFICATIONS
    // ========================================================

    if (
      window.Notifications?.initNotifBell
    ) {

      window.Notifications.initNotifBell({
        supabaseClient,
        userId: currentUserId
      });
    }

    // ========================================================
    // WALLET
    // ========================================================

    const walletLoaded =
      await loadWallet();

    if (!walletLoaded) {
      return;
    }

    await loadTransactions();

    initWithdrawModal();

    refreshIcons();

  } catch (error) {

    console.error(
      'Erreur initialisation wallet:',
      error
    );

    showMsg(
      'Une erreur est survenue lors du chargement du portefeuille.',
      'error'
    );
  }
}

// ============================================================
// LANCEMENT
// ============================================================

init();
