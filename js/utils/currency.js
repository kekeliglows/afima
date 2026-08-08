// ── CONFIGURATION DES DEVISES ──
const DEVISES = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 1 },
  XOF: { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA (Ouest)', rate: 655.957 },
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA (Central)', rate: 655.957 },
  MAD: { code: 'MAD', symbol: 'DH', name: 'Dirham marocain', rate: 10.8 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Naira nigérian', rate: 1650 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Cedi ghanéen', rate: 15.5 },
  TND: { code: 'TND', symbol: 'DT', name: 'Dinar tunisien', rate: 3.3 },
  DZD: { code: 'DZD', symbol: 'DA', name: 'Dinar algérien', rate: 135 },
  EGP: { code: 'EGP', symbol: 'E£', name: 'Livre égyptienne', rate: 31 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Shilling kényan', rate: 155 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'Rand sud-africain', rate: 19.5 }
};

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

function convertPrice(priceEUR, toCode = null) {
  const target = DEVISES[toCode || getUserCurrency()] || DEVISES.XOF;
  const converted = priceEUR * target.rate;
  return target.rate >= 10 ? Math.round(converted) : parseFloat(converted.toFixed(2));
}

function formatPrice(priceEUR, code = null) {
  const target = DEVISES[code || getUserCurrency()] || DEVISES.XOF;
  const value = convertPrice(priceEUR, code || getUserCurrency());
  return target.rate >= 10 
    ? `${value.toLocaleString('fr-FR')} ${target.symbol}`
    : `${value.toFixed(2).replace('.', ',')} ${target.symbol}`;
}

function getDevisesList() {
  return Object.values(DEVISES);
}

window.Currency = { DEVISES, getDefaultCurrency, getUserCurrency, setUserCurrency, convertPrice, formatPrice, getDevisesList };
