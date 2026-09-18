// Shared by source pages and the generated build. Localhost uses its own API.
(() => {
  const sameOrigin = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) || location.hostname.endsWith('.vercel.app');
  window.ROSEEN_API_BASE = sameOrigin ? '' : 'https://api.roseen.ru';
})();
