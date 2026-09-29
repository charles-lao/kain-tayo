/**
 * Injects the toast container and offline bar on every page. The header and tab
 * bar stay inline in each page because injecting them flashes on load.
 * Loads after utils.js, which defines onReady.
 */
(function () {
    function injectToastStack() {
        if (document.getElementById('toast-stack')) return;

        const stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        stack.innerHTML = `
            <div id="messageToast" class="toast app-toast" role="status" aria-live="polite" aria-atomic="true">
                <i class="bi bi-check-circle-fill toast-icon" aria-hidden="true"></i>
                <div class="toast-body"></div>
                <button type="button" class="toast-action d-none"></button>
                <button type="button" class="icon-btn icon-btn--sm" data-bs-dismiss="toast" aria-label="Dismiss">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
            </div>`;
        document.body.appendChild(stack);
    }

    function injectOfflineBar() {
        if (document.getElementById('offline-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'offline-bar';
        bar.className = 'offline-bar';
        bar.setAttribute('role', 'status');
        bar.hidden = true;
        bar.innerHTML = '<i class="bi bi-wifi-off" aria-hidden="true"></i> You\'re offline. Some photos may not load.';
        document.body.prepend(bar);

        const sync = () => { bar.hidden = navigator.onLine; };
        window.addEventListener('online', sync);
        window.addEventListener('offline', sync);
        sync();
    }

    onReady(() => {
        injectToastStack();
        injectOfflineBar();
    });
})();
