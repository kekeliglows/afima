// Renvoie la salutation selon l'heure actuelle
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bonjour';
  if (hour >= 12 && hour < 18) return 'Bon après-midi';
  if (hour >= 18 && hour < 22) return 'Bonsoir';
  return 'Bonne nuit';
}

// Formate le jour et la date en français
function getFormattedDate() {
  const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  return new Date().toLocaleDateString('fr-FR', options);
}

// Met à jour l'élément avec la salutation et optionnellement le nom
function updateGreeting(elementId, name = '') {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  const greeting = getGreeting();
  el.textContent = name ? `${greeting}, ${name} !` : `${greeting} !`;
}

// Auto-refresh de la salutation (toutes les minutes)
function startGreetingRefresh(elementId, name = '') {
  updateGreeting(elementId, name);
  
  // Calcul du délai jusqu'à la prochaine minute pile
  const now = new Date();
  const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
  
  setTimeout(() => {
    updateGreeting(elementId, name);
    setInterval(() => updateGreeting(elementId, name), 60000);
  }, msToNextMinute);
}
