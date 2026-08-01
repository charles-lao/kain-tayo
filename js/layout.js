/**
 * Shell chrome that is identical on every page and carries no first-paint cost:
 * the toast container and the offline indicator. The header and tab bar stay in
 * each HTML file on purpose — injecting them here would flash on load.
 */
(function () {
    function injectToastStack() {
        if (document.getElementById('toast-stack')) return;

        const stack = document.createElement('div');
        stack.id = 'toast-stack';
        stack.className = 'toast-stack';
        stack.innerHTML = `
            <div id="messageToast" class="toast app-toast" role="alert" aria-live="polite" aria-atomic="true">
                <i class="bi bi-check-circle-fill toast-icon" aria-hidden="true"></i>
                <div class="toast-body"></div>
                <button type="button" class="toast-action d-none"></button>
                <button type="button" class="icon-btn" data-bs-dismiss="toast" aria-label="Dismiss"
                        style="width:32px;height:32px;font-size:0.9rem;">
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
        bar.innerHTML = '<i class="bi bi-wifi-off" aria-hidden="true"></i> Offline — showing saved meals';
        document.body.prepend(bar);

        const sync = () => { bar.hidden = navigator.onLine; };
        window.addEventListener('online', sync);
        window.addEventListener('offline', sync);
        sync();
    }

    function init() {
        injectToastStack();
        injectOfflineBar();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
