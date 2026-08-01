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
        <i class="bi bi-phone" aria-hidden="true"></i>
        <span class="banner-text">Add Kain Tayo to your home screen</span>
        <div class="install-banner-actions">
          <button id="install-btn" class="banner-btn banner-btn--solid">Install</button>
          <button id="dismiss-install-btn" class="icon-btn" aria-label="Dismiss"
                  style="width:32px;height:32px;color:inherit;">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>`;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const text = isIOS
      ? 'Install: tap Share <i class="bi bi-box-arrow-up"></i> → Add to Home Screen'
      : 'Add Kain Tayo to your home screen';

    return `
      <i class="bi bi-phone" aria-hidden="true"></i>
      <span class="banner-text">${text}</span>
      <div class="install-banner-actions">
        <button id="dismiss-install-btn" class="banner-btn">Got it</button>
      </div>`;
  }

  function showBanner() {
    const existing = document.getElementById('install-banner');
    if (existing) return;

    const banner = document.createElement('div');
    banner.id = 'install-banner';
    banner.className = 'install-banner';
    banner.innerHTML = buildBannerHTML();

    // Sits in the flow just below the sticky header, so the two never overlap.
    const header = document.querySelector('.app-header');
    if (header) {
      header.insertAdjacentElement('afterend', banner);
    } else {
      document.body.prepend(banner);
    }

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
