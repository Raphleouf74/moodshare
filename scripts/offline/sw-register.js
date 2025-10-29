// scripts/offline/sw-register.js
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/scripts/offline/sw.js')
      .then(reg => console.log('Service Worker registered with scope:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  }
}

registerServiceWorker(); // lance directement
