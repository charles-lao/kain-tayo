if ('serviceWorker' in navigator) {
    let swRegistration;

    navigator.serviceWorker.register('./service-worker.js')
        .then(reg => {
            swRegistration = reg;
            console.log('✅ SW registered. Scope:', reg.scope);
            reg.update();
        })
        .catch(error => {
            console.error('❌ SW registration failed:', error);
        });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 New SW activated — reloading for fresh content.');
        window.location.reload();
    });
}
