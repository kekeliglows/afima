// ── BAHAM - Assistant AI afima ──
const Baham = {
  knowledge: {
    afima: {
      what: "afima est la marketplace africaine qui met en relation acheteurs et vendeurs. Vous pouvez y acheter, vendre, échanger et suivre vos transactions en toute sécurité.",
      sell: "Pour vendre sur afima : créez un compte, ouvrez la page Vendre, remplissez les infos du produit, ajoutez une photo et publiez.",
      buy: "Pour acheter : parcourez le catalogue, ajoutez les produits au panier, renseignez votre adresse de livraison puis confirmez votre commande.",
      secure: "afima met en place des mesures de sécurité et vous aide à protéger vos informations personnelles pendant les échanges.",
      fees: "Les ventes sur afima sont gratuites. Vous pouvez publier et vendre sans commission cachée.",
      delivery: "La livraison est généralement gérée par les vendeurs. Vous pouvez convenir des modalités directement via la messagerie."
    },
    products: {
      add: "Pour ajouter un produit : ouvrez votre Dashboard, cliquez sur 'Ajouter un produit', renseignez le titre, la description, le prix, le stock et ajoutez une photo.",
      edit: "Pour modifier un produit : allez dans votre Dashboard, sélectionnez le produit concerné puis cliquez sur 'Modifier'.",
      delete: "Pour supprimer un produit : rendez-vous sur votre Dashboard, puis cliquez sur 'Supprimer' sur la fiche du produit.",
      price: "Les prix s'affichent selon votre devise préférée. Vous pouvez la modifier dans votre profil.",
      stock: "Le stock correspond au nombre d'unités disponibles. Il diminue automatiquement après chaque commande.",
      search: "Vous pouvez chercher un produit directement depuis le catalogue avec la barre de recherche et les filtres.",
      favorite: "Vous pouvez ajouter des produits favoris pour les retrouver rapidement depuis la section dédiée du catalogue."
    },
    account: {
      create: "Pour créer un compte : cliquez sur 'Créer un compte', choisissez Acheteur ou Vendeur, remplissez vos informations et validez.",
      vendeur: "Pour devenir vendeur : ouvrez votre Profil, choisissez la section vendeur et complétez vos informations de vente.",
      profile: "Pour modifier votre profil : allez dans Profil, changez vos informations puis enregistrez.",
      currency: "Pour changer votre devise : ouvrez Profil, choisissez votre devise préférée puis enregistrez. Les prix se convertissent automatiquement.",
      login: "Pour vous connecter : utilisez votre adresse e-mail et votre mot de passe sur la page de connexion.",
      deleteAccount: "Pour supprimer votre compte, contactez le support via la page de contact ou la messagerie."
    },
    orders: {
      track: "Vos commandes apparaissent dans la page 'Mes commandes'. Vous pouvez y voir le statut, les détails et l'historique.",
      cancel: "Pour annuler une commande, contactez directement le vendeur via la messagerie afin d'organiser l'annulation.",
      history: "L'historique de vos commandes est disponible dans 'Mes commandes'.",
      status: "Le statut d'une commande vous indique si elle est en attente, confirmée, en cours de livraison ou clôturée."
    },
    payment: {
      methods: "Les paiements se font directement entre acheteurs et vendeurs. afima sécurise la transaction et vous aide à suivre les échanges.",
      refund: "Pour un remboursement, contactez le vendeur directement via la messagerie ou le support si nécessaire.",
      safe: "Pour payer en toute sécurité, utilisez la procédure officielle du site et vérifiez toujours les informations du vendeur."
    },
    delivery: {
      address: "Pour ajouter une adresse de livraison : ouvrez votre Panier, cliquez sur 'Modifier' à côté de 'Livrer à' puis remplissez le formulaire.",
      countries: "Nous livrons dans plusieurs pays d'Afrique, notamment le Maroc, le Sénégal, la Côte d'Ivoire, le Mali, le Cameroun, le Nigeria, le Ghana et d'autres pays.",
      shipping: "Les frais et délais de livraison dépendent du vendeur, du produit et du pays de destination."
    },
    navigation: {
      dashboard: "Le Dashboard centralise vos ventes, vos produits et vos statistiques.",
      catalogue: "Le catalogue vous permet de parcourir les produits, utiliser la recherche et filtrer les résultats.",
      cart: "Le panier vous permet de revoir vos articles avant de valider votre commande.",
      messages: "La messagerie vous permet de discuter avec les vendeurs ou les acheteurs.",
      profile: "Le profil regroupe vos informations personnelles, votre devise et vos préférences."
    },
    support: {
      contact: "Pour contacter le support : envoyez un e-mail à support@afima.app ou utilisez la messagerie disponible sur le site.",
      report: "Pour signaler un problème : utilisez la messagerie du vendeur ou contactez directement le support.",
      faq: "Vous pouvez consulter la FAQ pour les réponses aux questions fréquentes sur le compte, les commandes et les paiements."
    },
    greeting: [
      "Salut ! 👋 Je suis Baham, ton assistant afima. Comment puis-je t'aider aujourd'hui ?",
      "Bienvenue ! Je suis Baham. Pose-moi tes questions sur afima, les produits, les commandes ou le compte.",
      "Hey ! Baham à votre service. Que souhaitez-vous savoir ?"
    ],
    help: [
      "Je peux t'aider à vendre, acheter, gérer ton compte, suivre une commande, comprendre la livraison ou contacter le support.",
      "Tu peux me demander : comment vendre, comment acheter, où voir mes commandes, comment modifier mon profil, ou comment payer."
    ],
    fallback: [
      "Je ne suis pas certain de comprendre exactement. Peux-tu reformuler ta question ?",
      "Je n'ai pas encore de réponse précise pour ce sujet. Essaie une question comme : vendre, payer, profil, commande ou livraison.",
      "Désolé, je ne connais pas encore ce sujet. Je peux néanmoins t'aider sur les produits, les commandes, le compte et les paiements sur afima."
    ],
    thanks: [
      "Avec plaisir ! 😊 N'hésite pas si tu as d'autres questions.",
      "Je t'en prie ! Je suis là pour t'aider.",
      "De rien ! Bonne continuation sur afima ! 🚀"
    ]
  },
  state: {
    lastTopic: null,
    lastPath: null,
    lastPage: null,
    conversation: []
  },
  responses: [
    { keywords: ['salut', 'bonjour', 'hello', 'hey', 'coucou'], path: 'greeting' },
    { keywords: ['merci', 'thanks', 'merci beaucoup'], path: 'thanks' },
    { keywords: ['aide', 'help', 'que peux tu faire', 'que peux-tu faire', 'tu peux faire'], path: 'help' },
    { keywords: ['cest quoi afima', "c'est quoi afima", 'quest ce qu afima', "qu'est-ce qu'afima", 'afima'], path: 'afima.what' },
    { keywords: ['comment vendre', 'vendre', 'je veux vendre', 'mettre en vente', 'publier produit', 'publier un produit'], path: 'afima.sell' },
    { keywords: ['comment acheter', 'acheter', 'je veux acheter', 'acheter produit', 'commander'], path: 'afima.buy' },
    { keywords: ['securise', 'sécurisé', 'est ce sur', 'est-ce sûr', 'secure', 'confiance'], path: 'afima.secure' },
    { keywords: ['frais', 'commission', 'combien ca coute', 'combien ça coûte', 'gratuit'], path: 'afima.fees' },
    { keywords: ['livraison', 'livrer', 'comment livrer', 'delai', 'délai', 'expedition'], path: 'afima.delivery' },
    { keywords: ['ajouter produit', 'nouveau produit', 'creer produit', 'créer produit', 'publier'], path: 'products.add' },
    { keywords: ['modifier produit', 'changer produit', 'editer produit', 'éditer produit'], path: 'products.edit' },
    { keywords: ['supprimer produit', 'effacer produit'], path: 'products.delete' },
    { keywords: ['prix', 'tarif', 'cout', 'coût'], path: 'products.price' },
    { keywords: ['stock', 'quantite', 'quantité', 'disponibilite'], path: 'products.stock' },
    { keywords: ['rechercher', 'chercher', 'catalogue', 'produit'], path: 'products.search' },
    { keywords: ['favori', 'wishlist', 'favoris'], path: 'products.favorite' },
    { keywords: ['creer compte', 'créer compte', 'inscription', 'sinscrire', "s'inscrire", 'nouveau compte'], path: 'account.create' },
    { keywords: ['connexion', 'connecter', 'login', 'se connecter'], path: 'account.login' },
    { keywords: ['devenir vendeur', 'vendeur'], path: 'account.vendeur' },
    { keywords: ['profil', 'modifier profil', 'mon compte', 'informations'], path: 'account.profile' },
    { keywords: ['devise', 'changer devise', 'monnaie'], path: 'account.currency' },
    { keywords: ['commande', 'mes commandes', 'suivi', 'statut', 'suivre commande'], path: 'orders.track' },
    { keywords: ['annuler', 'annulation'], path: 'orders.cancel' },
    { keywords: ['historique', 'mes achats'], path: 'orders.history' },
    { keywords: ['paiement', 'payer', 'comment payer', 'payement'], path: 'payment.methods' },
    { keywords: ['remboursement', 'rembourser'], path: 'payment.refund' },
    { keywords: ['securite paiement', 'paiement securise', 'payer en securite'], path: 'payment.safe' },
    { keywords: ['adresse', 'livrer a', 'livrer à', 'adresse livraison'], path: 'delivery.address' },
    { keywords: ['pays', 'zone', 'pays livr', 'pays livré'], path: 'delivery.countries' },
    { keywords: ['dashboard', 'tableau de bord'], path: 'navigation.dashboard' },
    { keywords: ['panier', 'mon panier', 'basket'], path: 'navigation.cart' },
    { keywords: ['message', 'messagerie', 'discuter'], path: 'navigation.messages' },
    { keywords: ['contact', 'support', 'probleme', 'problème', 'bug', 'signaler'], path: 'support.contact' },
    { keywords: ['faq', 'questions frequentes', 'questions fréquentes'], path: 'support.faq' }
  ],

  init() {
    this.loadSessionState();
    this.state.lastPage = this.getCurrentPageContext().slug;
    this.saveSessionState();
  },

  normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  },

  getCurrentPageContext() {
    const pathname = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
    const slug = pathname.includes('panier') ? 'panier'
      : pathname.includes('catalogue') ? 'catalogue'
      : pathname.includes('profil') ? 'profil'
      : pathname.includes('dashboard') ? 'dashboard'
      : pathname.includes('commandes') ? 'commandes'
      : pathname.includes('produit') ? 'produit'
      : pathname.includes('ajouter-produit') ? 'ajouter-produit'
      : pathname.includes('messages') ? 'messages'
      : 'general';

    const labels = {
      general: 'la page principale',
      catalogue: 'le catalogue',
      panier: 'le panier',
      profil: 'votre profil',
      dashboard: 'votre tableau de bord',
      commandes: 'vos commandes',
      produit: 'la fiche produit',
      'ajouter-produit': 'la page de publication',
      messages: 'la messagerie'
    };

    return { pathname, slug, label: labels[slug] || 'la page actuelle' };
  },

  loadSessionState() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem('baham-session');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.state = { ...this.state, ...parsed };
          this.state.conversation = Array.isArray(parsed.conversation) ? parsed.conversation : [];
        }
      } catch (error) {
        console.warn('Baham session memory unavailable', error);
      }
    }
  },

  saveSessionState() {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem('baham-session', JSON.stringify({
          lastTopic: this.state.lastTopic,
          lastPath: this.state.lastPath,
          lastPage: this.state.lastPage,
          conversation: this.state.conversation.slice(-6)
        }));
      } catch (error) {
        console.warn('Baham session save failed', error);
      }
    }
  },

  remember(topic, path, page) {
    this.state.lastTopic = topic;
    this.state.lastPath = path;
    this.state.lastPage = page;
    this.state.conversation.push({ topic, path, page, at: Date.now() });
    if (this.state.conversation.length > 6) {
      this.state.conversation = this.state.conversation.slice(-6);
    }
    this.saveSessionState();
  },

  getPageContextualAdvice(page) {
    if (page.slug === 'catalogue') {
      return "Sur le catalogue, vous pouvez rechercher un produit, filtrer les résultats et consulter vos favoris.";
    }
    if (page.slug === 'panier') {
      return "Sur le panier, vous pouvez revoir vos articles avant de valider votre commande et d'ajouter votre adresse de livraison.";
    }
    if (page.slug === 'profil') {
      return "Sur votre profil, vous pouvez modifier vos informations, votre devise et vos préférences de compte.";
    }
    if (page.slug === 'dashboard') {
      return "Sur le tableau de bord, vous pouvez gérer vos produits, suivre vos ventes et consulter vos statistiques.";
    }
    if (page.slug === 'commandes') {
      return "Sur la page des commandes, vous pouvez suivre l'état de vos achats et voir l'historique.";
    }
    if (page.slug === 'messages') {
      return "Dans la messagerie, vous pouvez échanger avec les vendeurs ou les acheteurs pour finaliser une transaction.";
    }
    return '';
  },

  getNextStep(topic, page) {
    const topicMap = {
      sell: `Pour la suite, vous pouvez préparer votre annonce, ajouter une photo claire et vérifier le prix avant de publier. ${this.getPageContextualAdvice(page)}`.trim(),
      buy: `Pour la suite, vous pouvez valider votre panier et renseigner votre adresse de livraison avant de confirmer la commande. ${this.getPageContextualAdvice(page)}`.trim(),
      account: `Pour la suite, vous pouvez compléter votre profil, choisir votre devise et sécuriser votre compte. ${this.getPageContextualAdvice(page)}`.trim(),
      orders: `Pour la suite, vous pouvez ouvrir vos commandes pour vérifier le statut et contacter le vendeur si nécessaire. ${this.getPageContextualAdvice(page)}`.trim(),
      payment: `Pour la suite, vous pouvez vérifier les informations de paiement et confirmer la transaction en toute sécurité. ${this.getPageContextualAdvice(page)}`.trim(),
      delivery: `Pour la suite, vous pouvez vérifier l'adresse de livraison et les modalités de transport avant de finaliser. ${this.getPageContextualAdvice(page)}`.trim(),
      general: `Pour la suite, je peux vous aider à vendre, acheter, gérer votre compte ou suivre une commande. ${this.getPageContextualAdvice(page)}`.trim()
    };

    return topicMap[topic] || topicMap.general;
  },

  handleFollowUp(text, page) {
    if (!this.state.lastTopic) return null;
    const followUpPatterns = ['et ensuite', 'ensuite', 'puis', 'apres', 'après', 'suite', 'quoi d autre', 'autre chose', 'et puis'];
    if (followUpPatterns.some(pattern => text.includes(pattern))) {
      return this.getNextStep(this.state.lastTopic, page);
    }
    return null;
  },

  matchRule(text) {
    for (const rule of this.responses) {
      if (rule.keywords.some(keyword => text.includes(keyword))) {
        return rule.path;
      }
    }
    return null;
  },

  getTopicFromPath(path) {
    if (path === 'afima.sell') return 'sell';
    if (path === 'afima.buy') return 'buy';
    if (path === 'account.create' || path === 'account.profile' || path === 'account.login') return 'account';
    if (path === 'orders.track' || path === 'orders.history') return 'orders';
    if (path === 'payment.methods' || path === 'payment.safe') return 'payment';
    if (path === 'delivery.address' || path === 'delivery.countries') return 'delivery';
    return 'general';
  },

  findResponse(input) {
    this.loadSessionState();
    const text = this.normalize(input);
    const page = this.getCurrentPageContext();

    if (!text.trim()) {
      const welcome = this.getWelcome();
      this.remember('welcome', 'greeting', page.slug);
      return welcome;
    }

    const followUp = this.handleFollowUp(text, page);
    if (followUp) {
      return followUp;
    }

    const matchedPath = this.matchRule(text);
    if (matchedPath) {
      const response = this.resolvePath(matchedPath);
      this.remember(this.getTopicFromPath(matchedPath), matchedPath, page.slug);
      return response;
    }

    if (text.includes('aide') || text.includes('help')) {
      const pageHelp = this.getPageContextualAdvice(page);
      const generalHelp = this.getRandomItem(this.knowledge.help);
      const reply = pageHelp ? `${generalHelp} ${pageHelp}` : generalHelp;
      this.remember('help', 'help', page.slug);
      return reply;
    }

    if (text.includes('produit')) {
      this.remember('products', 'products.search', page.slug);
      return "Vous pouvez obtenir des infos sur un produit depuis le catalogue ou la fiche produit. Si vous voulez, je peux vous aider à comparer, acheter ou vérifier le stock.";
    }
    if (text.includes('compte')) {
      this.remember('account', 'account.profile', page.slug);
      return "Pour gérer votre compte, ouvrez votre profil. Vous pouvez y modifier vos informations, votre devise et vos préférences.";
    }
    if (text.includes('panier')) {
      this.remember('cart', 'navigation.cart', page.slug);
      return this.resolvePath('navigation.cart');
    }
    if (text.includes('commande')) {
      this.remember('orders', 'orders.track', page.slug);
      return this.resolvePath('orders.track');
    }

    this.remember('general', 'fallback', page.slug);
    return this.getRandomItem(this.knowledge.fallback);
  },

  resolvePath(path) {
    const [category, key] = path.split('.');
    if (!category) return path;

    if (this.knowledge[category] && this.knowledge[category][key]) {
      return this.knowledge[category][key];
    }

    if (Array.isArray(this.knowledge[category])) {
      return this.getRandomItem(this.knowledge[category]);
    }

    if (this.knowledge[category]) {
      return this.getRandomItem(this.knowledge[category]);
    }

    return this.getRandomItem(this.knowledge.fallback);
  },

  getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  },

  getWelcome() {
    const page = this.getCurrentPageContext();
    const base = this.getRandomItem(this.knowledge.greeting);
    const contextual = this.getPageContextualAdvice(page);
    return contextual ? `${base} ${contextual}` : base;
  },

  getSuggestions() {
    const page = this.getCurrentPageContext();
    const base = [
      'Comment vendre sur afima ?',
      'Comment créer un compte ?',
      'Où voir mes commandes ?',
      'Comment payer en sécurité ?',
      'Comment modifier mon profil ?'
    ];

    if (page.slug === 'catalogue') {
      return [
        'Comment trouver un produit ?',
        'Comment ajouter un produit aux favoris ?',
        'Comment vendre sur afima ?',
        'Comment payer en sécurité ?'
      ];
    }
    if (page.slug === 'panier') {
      return [
        'Comment finaliser ma commande ?',
        'Comment ajouter une adresse ?',
        'Comment payer en sécurité ?',
        'Où voir mes commandes ?'
      ];
    }
    if (page.slug === 'profil') {
      return [
        'Comment modifier mon profil ?',
        'Comment changer ma devise ?',
        'Comment créer un compte ?',
        'Comment contacter le support ?'
      ];
    }
    return base;
  },

  chat(userMessage) {
    return this.findResponse(userMessage);
  }
};

Baham.init();
window.Baham = Baham;
