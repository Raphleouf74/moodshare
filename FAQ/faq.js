const header = document.querySelector('header');
window.addEventListener('scroll', () => {
    if (window.scrollY > 15) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});