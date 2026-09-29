if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .catch(error => {
            console.error('SW registration failed:', error);
        });
}
