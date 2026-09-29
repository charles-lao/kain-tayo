(function () {
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;
  if (isInstalled) return;

  const dismissed = localStorage.getItem('installBannerDismissed');
  if (dismissed) {
    const daysSince = (Date.now() - parseInt(dismissed)) / 86400000;
    if (daysSince < 7) return;
  }

  // iPadOS reports itself as a Mac, so check for touch as well.
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

  let deferredPrompt = null;
  let closed = false;

  function buildBannerHTML() {
    if (deferredPrompt) {
      return `
        <i class="bi bi-phone" aria-hidden="true"></i>
        <span class="banner-text">Add Kain Tayo to your home screen</span>
        <div class="install-banner-actions">
          <button id="install-btn" class="banner-btn banner-btn--solid">Install</button>
          <button id="dismiss-install-btn" class="icon-btn icon-btn--sm" aria-label="Dismiss">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>`;
    }

    return `
      <i class="bi bi-phone" aria-hidden="true"></i>
      <span class="banner-text">Install: tap Share <i class="bi bi-box-arrow-up" aria-hidden="true"></i> then Add to Home Screen</span>
      <div class="install-banner-actions">
        <button id="dismiss-install-btn" class="banner-btn">Got it</button>
      </div>`;
  }

  function close(banner, remember) {
    closed = true;
    if (remember) localStorage.setItem('installBannerDismissed', Date.now().toString());
    banner.remove();
  }

  /**
   * Show the banner, or refresh it in place when beforeinstallprompt arrives
   * after the timer has already shown the iOS-style fallback.
   */
  function showBanner() {
    // Outside iOS, only browsers that fire beforeinstallprompt can install.
    if (closed || (!deferredPrompt && !isIOS)) return;

    let banner = document.getElementById('install-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'install-banner';
      banner.className = 'install-banner';

      const header = document.querySelector('.app-header');
      if (header) {
        header.insertAdjacentElement('afterend', banner);
      } else {
        document.body.prepend(banner);
      }
    }
    banner.innerHTML = buildBannerHTML();

    document.getElementById('install-btn')?.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      // A prompt works only once, so close the banner whatever the outcome.
      deferredPrompt = null;
      close(banner, result.outcome !== 'accepted');
    });

    document.getElementById('dismiss-install-btn')?.addEventListener('click', () => close(banner, true));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    showBanner();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    closed = true;
    document.getElementById('install-banner')?.remove();
  });

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(showBanner, 3000);
  });
})();
