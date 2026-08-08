// ── CONFIGURATION DES DEVISES ──
const DEVISES = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', rate: 1 },
  XOF: { code: 'XOF', symbol: 'FCFA', name: 'Franc CFA (Ouest)', rate: 655.957 },
  XAF: { code: 'XAF', symbol: 'FCFA', name: 'Franc CFA (Central)', rate: 655.957 },
  MAD: { code: 'MAD', symbol: 'DH', name: 'Dirham marocain', rate: 10.8 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Naira nigérian', rate: 1650 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Cedi ghanéen', rate: 15.5 },
  EUR_XOF: { code: 'XOF', symbol: 'FCFA', name: 'FCFA (fixe)', rate: 655.957 }
};

// Devise par défaut selon le pays (détection automatique)
function getDefaultCurrency() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const lang = navigator.language || 'fr';
  
  // Mapping timezone/pays vers devise
  const tzMap = {
    'Africa/Abidjan': 'XOF',
    'Africa/Dakar': 'XOF',
    'Africa/Bamako': 'XOF',
    'Africa/Ouagadougou': 'XOF',
    'Africa/Niamey': 'XOF',
    'Africa/Conakry': 'GNF',
    'Africa/Libreville': 'XAF',
    'Africa/Douala': 'XAF',
    'Africa/Kinshasa': 'XAF',
    'Africa/Brazzaville': 'XAF',
    'Africa/Lagos': 'NGN',
    'Africa/Accra': 'GHS',
    'Africa/Casablanca': 'MAD',
    'Africa/Tunis': 'TND',
    'Africa/Algiers': 'DZD'
  };
  
  // Mapping langue/pays
  const langMap = {
    'fr-SN': 'XOF', 'fr-CI': 'XOF', 'fr-ML': 'XOF', 'fr-BF': 'XOF',
    'fr-NE': 'XOF', 'fr-TG': 'XOF', 'fr-BJ': 'XOF',
    'fr-CM': 'XAF', 'fr-GA': 'XAF', 'fr-CG': 'XAF', 'fr-CD': 'XAF',
    'en-NG': 'NGN', 'en-GH': 'GHS'
  };
  
  return tzMap[tz] || langMap[lang] || localStorage.getItem('afima_currency') || 'EUR';
}

// Récupérer la devise stockée (localStorage ou profil utilisateur depuis sessionStorage)
function getUserCurrency() {
  // Priorité : localStorage (choix manuel)
  const localCurrency = localStorage.getItem('afima_currency');
  if (localCurrency) return localCurrency;
  
  // Sinon : profil utilisateur en session
  try {
    const sessionStr = sessionStorage.getItem('afima_user_currency');
    if (sessionStr) return sessionStr;
  } catch (e) {}
  
  return getDefaultCurrency();
}

// Stocker la devise
function setUserCurrency(code) {
  localStorage.setItem('afima_currency', code);
}

// Convertir un prix EUR vers la devise utilisateur
function convertPrice(priceEUR, toCurrency = null) {
  const targetCode = toCurrency || getUserCurrency();
  const devise = DEVISES[targetCode] || DEVISES.EUR;
  const converted = priceEUR * devise.rate;
  return devise.rate >= 100 
    ? Math.round(converted) 
    : parseFloat(converted.toFixed(2));
}

// Formater un prix avec le symbole de devise
function formatPrice(priceEUR, currencyCode = null) {
  const targetCode = currencyCode || getUserCurrency();
  const devise = DEVISES[targetCode] || DEVISES.EUR;
  const converted = convertPrice(priceEUR, targetCode);
  
  if (devise.rate >= 100) {
    return `${converted.toLocaleString('fr-FR')} ${devise.symbol}`;
  }
  return `${converted.toFixed(2).replace('.', ',')} ${devise.symbol}`;
}

// Obtenir la liste des devises pour un select
function getDevisesList() {
  return Object.values(DEVISES).map(d => ({
    code: d.code,
    symbol: d.symbol,
    name: d.name
  }));
}

export { DEVISES, getDefaultCurrency, getUserCurrency, setUserCurrency, convertPrice, formatPrice, getDevisesList };
