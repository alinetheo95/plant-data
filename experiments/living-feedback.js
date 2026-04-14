const sections = document.querySelectorAll('section');
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
    });
}, { threshold: 0.08 });
sections.forEach(s => observer.observe(s));
