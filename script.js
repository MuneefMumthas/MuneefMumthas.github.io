// Expandable Project Cards
function toggleCard(card) {
    const btn = card.querySelector('.expand-btn');
    const isExpanding = !card.classList.contains('expanded');
    
    if (isExpanding) {
        // If opening, expand immediately and change text
        card.classList.add('expanded');
        btn.innerHTML = 'Show Less';
    } else {
        // If closing, collapse the card first
        card.classList.remove('expanded');
        
        // Wait 600ms (matching our CSS transition time) before changing the text back
        setTimeout(() => {
            btn.innerHTML = 'Read More';
        }, 600); 
    }
}

// Scroll Fade-in Animation
document.addEventListener("DOMContentLoaded", () => {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, observerOptions);

    document.querySelectorAll('.fade-in').forEach((el) => {
        observer.observe(el);
    });
});