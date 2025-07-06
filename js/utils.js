// Shows Toast with message
const showMessageToast = (message = null, toastColor = 'primary', toastId = 'messageToast') => {
    var toastElement = document.getElementById(toastId);
    
    if (message != null){
        
        const body = toastElement.querySelector('.toast-body');
        if (body) {
            body.textContent = message;
        }
    }

    

    // Handle color change
    const toastClassList = toastElement.classList;

    // Remove existing text-bg-* class if any
    toastClassList.forEach(className => {
        if (className.startsWith('text-bg-')) {
            toastClassList.remove(className);
        }
    });

    // Change to new color
    toastClassList.add(`text-bg-${toastColor}`);
    

    // Dispose previous toast instance (if any), then recreate it
    const existingToast = bootstrap.Toast.getInstance(toastElement);
    if (existingToast) {
        existingToast.dispose(); // clear event listeners and timers
    }

    // Now re-init and show
    const newToast = new bootstrap.Toast(toastElement, { delay: 3000 }); // optional: set consistent delay
    newToast.show();
}



// Opens #imageModal to view a larger image
$(document).on('click', '.fullscreen-img-modal', function () {
    const src = $(this).attr('src');
    const alt = $(this).attr('alt');
    $('#modalImage').attr('src', src);
    $('#modalImage').attr('alt', alt);
});