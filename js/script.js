/* ================================================
   EKANTIK CAPITAL ADVISORS — EPIG 500
   Main JavaScript
   ================================================ */

// ================================================
// Mobile Menu Toggle
// ================================================
function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    if (menu) {
        menu.classList.toggle('active');
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(e) {
    const menu = document.getElementById('mobileMenu');
    const toggle = document.querySelector('.mobile-menu-toggle');
    if (menu && toggle && !menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove('active');
    }
});

// ================================================
// Smooth Scroll to Subscribe
// ================================================
function scrollToSubscribe() {
    const el = document.getElementById('subscribe') || document.getElementById('contact');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// ================================================
// FAQ Toggle
// ================================================
function toggleFaq(element) {
    const faqItem = element.closest('.faq-item');
    const answer = faqItem.querySelector('.faq-answer');
    const isOpen = faqItem.classList.contains('active');

    // Close all open FAQs
    document.querySelectorAll('.faq-item.active').forEach(item => {
        item.classList.remove('active');
        const ans = item.querySelector('.faq-answer');
        if (ans) ans.style.display = 'none';
    });

    // Toggle current
    if (!isOpen) {
        faqItem.classList.add('active');
        if (answer) answer.style.display = 'block';
    }
}

// ================================================
// Video Modal
// ================================================
function closeVideoModal() {
    const modal = document.getElementById('video-modal');
    if (modal) {
        modal.style.display = 'none';
        // Stop video by resetting iframe src
        const iframe = modal.querySelector('iframe');
        if (iframe) {
            const src = iframe.src;
            iframe.src = '';
            iframe.src = src;
        }
    }
}

// Close modal on backdrop click
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('video-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeVideoModal();
        });
    }
});

// Close modal on Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeVideoModal();
});

// ================================================
// Email Subscription Form
// ================================================
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('subscribeForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = document.getElementById('email').value;
            if (email) {
                // Hide form, show success
                form.style.display = 'none';
                const success = document.getElementById('formSuccess');
                if (success) success.style.display = 'block';
                console.log('Email subscribed:', email);
            }
        });
    }
});

// ================================================
// Navbar scroll effect
// ================================================
window.addEventListener('scroll', function() {
    const navbar = document.querySelector('.navbar');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    }
});

// ================================================
// Smooth scroll for all anchor links
// ================================================
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                const offset = 80; // navbar height
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
});

// ================================================
// Animate on scroll (simple intersection observer)
// ================================================
document.addEventListener('DOMContentLoaded', function() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe cards and sections
    document.querySelectorAll(
        '.content-card, .step-item, .principle-card, .evidence-card, .benefit-item, .faq-item'
    ).forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(el);
    });
});

// ================================================
// Active nav link highlighting
// ================================================
window.addEventListener('scroll', function() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    let current = '';
    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
            link.classList.add('active');
        }
    });
});
