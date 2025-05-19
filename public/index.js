

document.addEventListener('DOMContentLoaded', () => {

    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            mobileMenu.classList.toggle('hidden');
        });

        // Optional: Close mobile menu when a link inside it is clicked
        const mobileNavLinks = mobileMenu.querySelectorAll('a.mobile-navbar-item');
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                if (!mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                }
            });
        });
    } else {
        if (!mobileMenuButton) {
            console.warn('Mobile menu button with ID "mobile-menu-button" not found.');
        }
        if (!mobileMenu) {
            console.warn('Mobile menu with ID "mobile-menu" not found.');
        }
    }

});