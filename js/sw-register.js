if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
            console.log('✅ SW registered. Scope:', reg.scope);
            reg.update();
        })
        .catch(error => {
            console.error('❌ SW registration failed:', error);
        });
}
