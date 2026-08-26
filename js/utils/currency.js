// ── CONFIGURATION DES DEVISES ──
// BASE_CURRENCY = devise de stockage native de produits.prix (bigint,
// sans décimales) — cohérent avec le marché cible (UEMOA) et avec
// Kkiapay qui exige des montants entiers en XOF.
//
// ⚠️ Les taux ci-dessous sont des valeurs approximatives figées, pas
// un flux temps réel. C'est un correctif tactique pour que l'affichage
// soit au moins juste — un vrai service de taux de change reste à
// construire (voir futur.md, section anti-pattern taux figés).
const BASE_CURRENCY = 'XOF';
const DEVISES = {
  XOF: { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA (Ouest)', rate: 1 },
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA (Central)', rate: 1 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 1 / 655.957 },
  USD: { code: 'USD', symbol: '$', name: 'Dollar américain', rate: 1.1 / 655.957 },
  MAD: { code: 'MAD', symbol: 'DH', name: 'Dirham marocain', rate: 10.8 / 655.957 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Naira nigérian', rate: 1650 / 655.957 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Cedi ghanéen', rate: 15.5 / 655.957 },
  TND: { code: 'TND', symbol: 'DT', name: 'Dinar tunisien', rate: 3.3 / 655.957 },
  DZD: { code: 'DZD', symbol: 'DA', name: 'Dinar algérien', rate: 135 / 655.957 },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Livre égyptienne', rate: 31 / 655.957 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Shilling kényan', rate: 155 / 655.957 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'Rand sud-africain', rate: 19.5 / 655.957 }
};

// Devises qui s'affichent avec des décimales — toutes les autres sont
// arrondies à l'entier (cohérent avec la plupart des devises locales
// du marché cible, qui ne se manipulent pas en centimes au quotidien).
const DECIMAL_CURRENCIES = ['EUR', 'USD'];

const TZ_TO_CURRENCY = {
  'Africa/Abidjan': 'XOF', 'Africa/Dakar': 'XOF', 'Africa/Bamako': 'XOF',
  'Africa/Ouagadougou': 'XOF', 'Africa/Niamey': 'XOF', 'Africa/Lome': 'XOF',
  'Africa/Porto-Novo': 'XOF', 'Africa/Douala': 'XAF', 'Africa/Libreville': 'XAF',
  'Africa/Kinshasa': 'XAF', 'Africa/Brazzaville': 'XAF', 'Africa/Ndjamena': 'XAF',
  'Africa/Bangui': 'XAF', 'Africa/Malabo': 'XAF', 'Africa/Lagos': 'NGN',
  'Africa/Accra': 'GHS', 'Africa/Casablanca': 'MAD', 'Africa/Tunis': 'TND',
  'Africa/Algiers': 'DZD', 'Africa/Cairo': 'EGP', 'Africa/Nairobi': 'KES',
  'Africa/Johannesburg': 'ZAR'
};

const LANG_TO_CURRENCY = {
  'fr-SN': 'XOF', 'fr-CI': 'XOF', 'fr-ML': 'XOF', 'fr-BF': 'XOF',
  'fr-NE': 'XOF', 'fr-TG': 'XOF', 'fr-BJ': 'XOF', 'fr-CM': 'XAF',
  'fr-GA': 'XAF', 'fr-CG': 'XAF', 'fr-CD': 'XAF', 'en-NG': 'NGN',
  'en-GH': 'GHS', 'ar-MA': 'MAD', 'ar-TN': 'TND', 'ar-DZ': 'DZD', 'ar-EG': 'EGP'
};

function getDefaultCurrency() {
  const tz = Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone || '';
  const lang = navigator?.language || '';
  return TZ_TO_CURRENCY[tz] || LANG_TO_CURRENCY[lang] || 'XOF';
}

function getUserCurrency() {
  return localStorage.getItem('afima_currency') || getDefaultCurrency();
}

function setUserCurrency(code) {
  if (DEVISES[code]) localStorage.setItem('afima_currency', code);
}

function normalizeCurrencyCode(code) {
  const normalized = String(code || '').toUpperCase();
  return DEVISES[normalized] ? normalized : BASE_CURRENCY;
}

function convertPrice(price, fromCode = BASE_CURRENCY, toCode = null) {
  const source = DEVISES[normalizeCurrencyCode(fromCode)] || DEVISES[BASE_CURRENCY];
  const target = DEVISES[normalizeCurrencyCode(toCode || getUserCurrency())] || DEVISES[BASE_CURRENCY];
  const value = Number(price) || 0;

  if (source.code === target.code) return value;

  // Chaque "rate" représente : unités de cette devise pour 1 XOF (la base).
  const valueInBase = value / source.rate;
  const converted = valueInBase * target.rate;

  return DECIMAL_CURRENCIES.includes(target.code)
    ? parseFloat(converted.toFixed(2))
    : Math.round(converted);
}

function formatPrice(price, fromCode = BASE_CURRENCY, toCode = null) {
  const target = DEVISES[normalizeCurrencyCode(toCode || getUserCurrency())] || DEVISES[BASE_CURRENCY];
  const value = convertPrice(price, fromCode, toCode);
  const formattedValue = DECIMAL_CURRENCIES.includes(target.code)
    ? value.toFixed(2).replace('.', ',')
    : value.toLocaleString('fr-FR');
  return `${formattedValue} ${target.symbol}`;
}

function getProductCurrencyCode(product) {
  if (!product) return BASE_CURRENCY;
  const explicit = product.price_currency || product.currency || product.devise || '';
  return normalizeCurrencyCode(explicit);
}

function getDevisesList() {
  return Object.values(DEVISES);
}

window.Currency = { BASE_CURRENCY, DEVISES, getDefaultCurrency, getUserCurrency, setUserCurrency, convertPrice, formatPrice, getDevisesList, normalizeCurrencyCode, getProductCurrencyCode };