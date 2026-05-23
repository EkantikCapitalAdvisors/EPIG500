/* ================================================
   EKANTIK 500 — Landing Page
   ================================================ */

(function () {
    'use strict';

    // ---- Mobile menu ----
    const menuToggle = document.querySelector('.nav__menu-toggle');
    const navMobile = document.getElementById('navMobile');
    if (menuToggle && navMobile) {
        menuToggle.addEventListener('click', function () {
            const isOpen = navMobile.classList.toggle('is-open');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
        });
        navMobile.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                navMobile.classList.remove('is-open');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // ---- Scroll reveal ----
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion && 'IntersectionObserver' in window) {
        const targets = document.querySelectorAll(
            '.section__h, .prose, .pullquote, .ladder-canvas, .three-col, .numbered-card, .config-card, .principle, .metric, .drawdown, .founding__card, .vow-diagram, .faq__item, .booking'
        );
        targets.forEach(function (el) { el.classList.add('reveal'); });

        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        targets.forEach(function (el) { io.observe(el); });
    }

    // ---- Smooth scroll for in-page anchors ----
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            const id = link.getAttribute('href');
            if (!id || id === '#') return;
            const target = document.querySelector(id);
            if (!target) return;
            e.preventDefault();
            const offset = 72; // sticky nav
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    });

    // ---- Analytics stubs (per spec Section 5.4) ----
    // These dispatch CustomEvents that any analytics provider (Plausible, Vercel Analytics)
    // can listen for. Wire to provider once provisioned.
    function track(name, props) {
        try {
            window.dispatchEvent(new CustomEvent('ekantik:track', { detail: { name: name, props: props || {} } }));
            if (window.plausible) window.plausible(name, { props: props || {} });
        } catch (e) { /* no-op */ }
    }

    // hero CTA
    document.querySelectorAll('a[href="#book"]').forEach(function (cta) {
        cta.addEventListener('click', function () {
            const source = cta.closest('section')?.id || 'unknown';
            track(source === 'founding' ? 'founding_member_cta_click' : 'hero_cta_click', { section: source });
        });
    });

    // ladder view
    const ladder = document.getElementById('ladder');
    if (ladder && 'IntersectionObserver' in window) {
        const ladderIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    track('ladder_view', {});
                    ladderIO.disconnect();
                }
            });
        }, { threshold: 0.4 });
        ladderIO.observe(ladder);
    }

    // FAQ expand
    document.querySelectorAll('.faq__item').forEach(function (item, idx) {
        item.addEventListener('toggle', function () {
            if (item.open) {
                track('faq_expand', { question_id: idx + 1, question: item.querySelector('summary')?.textContent?.trim() });
            }
        });
    });

    // page view
    track('page_view', {
        url: window.location.href,
        referrer: document.referrer || null
    });

    // ---- Cal.com lazy loader ----
    // Initializes the Cal.com inline embed when the booking section enters the viewport.
    // Replace `data-cal-link` on the embed container with the real scheduler slug once provisioned.
    const calContainer = document.getElementById('calBookingEmbed');
    if (calContainer && 'IntersectionObserver' in window) {
        const calIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                loadCal(calContainer);
                calIO.disconnect();
            });
        }, { threshold: 0.2 });
        calIO.observe(calContainer);
    }

    function loadCal(container) {
        const link = container.getAttribute('data-cal-link');
        if (!link) return;

        // Cal.com embed bootstrap (official snippet, lightly trimmed).
        (function (C, A, L) {
            let p = function (a, ar) { a.q.push(ar); };
            let d = C.document;
            C.Cal = C.Cal || function () {
                let cal = C.Cal;
                let ar = arguments;
                if (!cal.loaded) {
                    cal.ns = {};
                    cal.q = cal.q || [];
                    d.head.appendChild(d.createElement('script')).src = A;
                    cal.loaded = true;
                }
                if (ar[0] === L) {
                    const api = function () { p(api, arguments); };
                    const namespace = ar[1];
                    api.q = api.q || [];
                    if (typeof namespace === 'string') {
                        cal.ns[namespace] = cal.ns[namespace] || api;
                        p(cal.ns[namespace], ar);
                        p(cal, ['initNamespace', namespace]);
                    } else {
                        p(cal, ar);
                    }
                    return;
                }
                p(cal, ar);
            };
        })(window, 'https://app.cal.com/embed/embed.js', 'init');

        try {
            window.Cal('init', 'ekantik500', { origin: 'https://cal.com' });
            window.Cal.ns.ekantik500('inline', {
                elementOrSelector: container,
                calLink: link,
                layout: 'month_view'
            });
            window.Cal.ns.ekantik500('ui', {
                theme: 'light',
                cssVarsPerTheme: {
                    light: { 'cal-brand': '#C8A951' }
                },
                hideEventTypeDetails: false
            });
            // Track booking confirmations
            window.Cal.ns.ekantik500('on', {
                action: 'bookingSuccessful',
                callback: function (e) {
                    track('booking_confirmed', { source_section: 'final_cta' });
                }
            });
        } catch (e) {
            // fallback already rendered in HTML
        }
    }

    // ---- Nav shadow on scroll ----
    const nav = document.getElementById('nav');
    if (nav) {
        let last = 0;
        window.addEventListener('scroll', function () {
            const y = window.scrollY;
            if ((y > 8) !== (last > 8)) {
                nav.style.boxShadow = y > 8 ? '0 2px 16px rgba(27, 42, 74, 0.06)' : 'none';
            }
            last = y;
        }, { passive: true });
    }
})();
