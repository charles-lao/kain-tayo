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
    toastClassList.add(`text-bg-${toastColor}`);
    

    var toast = new bootstrap.Toast(toastElement);
    toast.show();
}



// Opens #imageModal to view a larger image
$(document).on('click', '.fullscreen-img-modal', function () {
    const src = $(this).attr('src');
    const alt = $(this).attr('alt');
    $('#modalImage').attr('src', src);
    $('#modalImage').attr('alt', alt);
});