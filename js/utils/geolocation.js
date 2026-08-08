// ── GÉOLOCALISATION ADRESSE LIVRAISON ──
const LocationService = {
  // Pays africains supportés avec formules d'adresse
  COUNTRIES: {
    CI: { name: 'Côte d\'Ivoire', dial: '+225', currency: 'XOF', fields: ['ville', 'quartier'] },
    SN: { name: 'Sénégal', dial: '+221', currency: 'XOF', fields: ['ville', 'quartier'] },
    ML: { name: 'Mali', dial: '+223', currency: 'XOF', fields: ['ville', 'quartier'] },
    BF: { name: 'Burkina Faso', dial: '+226', currency: 'XOF', fields: ['ville', 'quartier'] },
    NE: { name: 'Niger', dial: '+227', currency: 'XOF', fields: ['ville', 'quartier'] },
    BJ: { name: 'Bénin', dial: '+229', currency: 'XOF', fields: ['ville', 'quartier'] },
    TG: { name: 'Togo', dial: '+228', currency: 'XOF', fields: ['ville', 'quartier'] },
    CM: { name: 'Cameroun', dial: '+237', currency: 'XAF', fields: ['ville', 'quartier'] },
    GA: { name: 'Gabon', dial: '+241', currency: 'XAF', fields: ['ville', 'quartier'] },
    CG: { name: 'Congo-Brazzaville', dial: '+242', currency: 'XAF', fields: ['ville', 'quartier'] },
    CD: { name: 'RD Congo', dial: '+243', currency: 'XAF', fields: ['ville', 'quartier'] },
    NG: { name: 'Nigeria', dial: '+234', currency: 'NGN', fields: ['state', 'city', 'area'] },
    GH: { name: 'Ghana', dial: '+233', currency: 'GHS', fields: ['region', 'city', 'area'] },
    MA: { name: 'Maroc', dial: '+212', currency: 'MAD', fields: ['ville', 'quartier'] },
    TN: { name: 'Tunisie', dial: '+216', currency: 'TND', fields: ['ville', 'quartier'] },
    DZ: { name: 'Algérie', dial: '+213', currency: 'DZD', fields: ['wilaya', 'commune'] },
    EG: { name: 'Égypte', dial: '+20', currency: 'EGP', fields: ['governorate', 'city'] },
    KE: { name: 'Kenya', dial: '+254', currency: 'KES', fields: ['county', 'city'] },
    ZA: { name: 'Afrique du Sud', dial: '+27', currency: 'ZAR', fields: ['province', 'city', 'suburb'] }
  },

  // Détecter le pays via timezone API (gratuite)
  async detectCountry() {
    try {
      const tz = Intl.DateTimeFormat?.().resolvedOptions?.()?.timeZone || '';
      const tzCountry = {
        'Africa/Abidjan': 'CI', 'Africa/Dakar': 'SN', 'Africa/Bamako': 'ML',
        'Africa/Ouagadougou': 'BF', 'Africa/Niamey': 'NE', 'Africa/Porto-Novo': 'BJ',
        'Africa/Lome': 'TG', 'Africa/Douala': 'CM', 'Africa/Libreville': 'GA',
        'Africa/Brazzaville': 'CG', 'Africa/Kinshasa': 'CD', 'Africa/Lagos': 'NG',
        'Africa/Accra': 'GH', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN',
        'Africa/Algiers': 'DZ', 'Africa/Cairo': 'EG', 'Africa/Nairobi': 'KE',
        'Africa/Johannesburg': 'ZA'
      };
      if (tzCountry[tz]) return tzCountry[tz];

      // Fallback: API IP gratuite
      const res = await fetch('https://ipapi.co/json/', { timeout: 3000 });
      const data = await res.json();
      return data.country_code || 'CI';
    } catch {
      return 'CI';
    }
  },

  // Obtrer les adresses sauvegardées
  getSavedAddresses() {
    return JSON.parse(localStorage.getItem('afima_addresses') || '[]');
  },

  // Sauvegarder une adresse
  saveAddress(address) {
    const addresses = this.getSavedAddresses();
    const idx = addresses.findIndex(a => a.id === address.id);
    if (idx >= 0) addresses[idx] = address;
    else addresses.unshift(address);
    localStorage.setItem('afima_addresses', JSON.stringify(addresses));
  },

  // Définir l'adresse par défaut
  setDefaultAddress(id) {
    const addresses = this.getSavedAddresses().map(a => ({ ...a, isDefault: a.id === id }));
    localStorage.setItem('afima_addresses', JSON.stringify(addresses));
  },

  // Adresse par défaut
  getDefaultAddress() {
    return this.getSavedAddresses().find(a => a.isDefault) || null;
  },

  // Supprimer une adresse
  deleteAddress(id) {
    const addresses = this.getSavedAddresses().filter(a => a.id !== id);
    localStorage.setItem('afima_addresses', JSON.stringify(addresses));
  }
};

window.LocationService = LocationService;
