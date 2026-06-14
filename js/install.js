(function () {
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
  if (isInstalled) return;

  const dismissed = localStorage.getItem('installBannerDismissed');
  if (dismissed) {
    const daysSince = (Date.now() - parseInt(dismissed)) / 86400000;
    if (daysSince < 7) return;
  }

  let deferredPrompt = null;

  function buildBannerHTML() {
    if (deferredPrompt) {
      return `
        <span>📲 Get Kain Tayo on your home screen for quick access!</span>
        <div class="install-banner-actions">
          <button id="install-btn" class="btn btn-sm btn-light fw-bold">Install</button>
          <button id="dismiss-install-btn" class="btn btn-sm btn-outline-light border-0">Not now</button>
        </div>`;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      return `
        <span>📲 Install Kain Tayo: tap Share <i class="bi bi-box-arrow-up"></i> → Add to Home Screen</span>
        <div class="install-banner-actions">
          <button id="dismiss-install-btn" class="btn btn-sm btn-outline-light border-0">Got it</button>
        </div>`;
    }

    return `
      <span>📲 Add Kain Tayo to your home screen for the best experience!</span>
      <div class="install-banner-actions">
        <button id="dismiss-install-btn" class="btn btn-sm btn-outline-light border-0">Dismiss</button>
      </div>`;
  }

  function showBanner() {
    const existing = document.getElementById('install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = buildBannerHTML();
    document.body.prepend(banner);

    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        banner.remove();
      }
      deferredPrompt = null;
    });

    document.getElementById('dismiss-install-btn')?.addEventListener('click', () => {
      localStorage.setItem('installBannerDismissed', Date.now().toString());
      banner.remove();
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('install-banner')?.remove();
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showBanner, 3000);
  });
})();
