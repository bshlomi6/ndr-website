(() => {
  'use strict';

  /* ---------- Preloader ---------- */
  window.addEventListener('load', () => {
    const pre = document.getElementById('preloader');
    setTimeout(() => pre.classList.add('is-hidden'), 400);
  });

  /* ---------- Cities cloud (service area) ---------- */
  const CITIES = [
    'ירושלים','תל אביב-יפו','חיפה','ראשון לציון','פתח תקווה','אשדוד','נתניה','באר שבע','בני ברק','חולון',
    'רמת גן','אשקלון','רחובות','בת ים','בית שמש','כפר סבא','הרצליה','חדרה','מודיעין-מכבים-רעות','נצרת',
    'לוד','רמלה','רעננה','רהט','הוד השרון','גבעתיים','קריית אתא','נהריה','אילת','קריית גת',
    'עפולה','נס ציונה','עכו','אלעד','רמת השרון','כרמיאל','יבנה','טבריה','קריית מוצקין','שפרעם',
    'קריית ים','אור יהודה','צפת','נתיבות','דימונה','טירת כרמל','מגדל העמק','ערד','קריית מלאכי','בית שאן',
    'מעלה אדומים','קריית שמונה','יהוד-מונוסון','אופקים','גדרה','נשר','כפר יונה','נוף הגליל','מזכרת בתיה',
    'גבעת שמואל','יקנעם עילית','ירוחם','קריית אונו','אריאל','פרדס חנה-כרכור','זכרון יעקב','אור עקיבא',
    'שוהם','תל מונד','מצפה רמון','עומר','ניר עם','שדרות','ערד','תל שבע'
  ];
  const cloud = document.getElementById('citiesCloud');
  if (cloud) {
    const unique = [...new Set(CITIES)];
    cloud.innerHTML = unique.map(c => `<span>${c}</span>`).join('');
  }

  /* ---------- Header on scroll ---------- */
  const header = document.getElementById('siteHeader');
  const scrollProgress = document.getElementById('scrollProgress');
  const backToTop = document.getElementById('backToTop');
  const hero = document.getElementById('home');
  const heroImg = document.getElementById('heroImg');

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);
    backToTop.classList.toggle('is-visible', y > 700);

    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    scrollProgress.style.width = total > 0 ? `${(y / total) * 100}%` : '0%';

    // hero parallax
    if (heroImg) {
      const heroH = hero.offsetHeight;
      if (y < heroH) {
        heroImg.style.transform = `scale(1.08) translateY(${y * 0.18}px)`;
      }
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- Mobile menu ---------- */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuClose = document.getElementById('mobileMenuClose');

  function openMobileMenu() { mobileMenu.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
  function closeMobileMenu() { mobileMenu.classList.remove('is-open'); document.body.style.overflow = ''; }

  hamburger.addEventListener('click', openMobileMenu);
  mobileMenuClose.addEventListener('click', closeMobileMenu);
  mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileMenu));

  /* ---------- Side nav: scroll spy ---------- */
  const sideLinks = document.querySelectorAll('.side-nav a');
  const sections = [...sideLinks].map(a => document.getElementById(a.dataset.section)).filter(Boolean);

  const spyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        sideLinks.forEach(a => a.classList.toggle('active', a.dataset.section === id));
      }
    });
  }, { rootMargin: '-40% 0px -50% 0px', threshold: 0 });

  sections.forEach(sec => spyObserver.observe(sec));

  /* ---------- Reveal on scroll ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const viewH = window.innerHeight;
  revealEls.forEach(el => {
    const delay = el.getAttribute('data-delay');
    if (delay) el.style.setProperty('--d', delay);
    // Above-the-fold content reveals immediately instead of waiting on an
    // IntersectionObserver callback, which browsers throttle/suspend for
    // backgrounded or not-yet-visible tabs (e.g. during prerender).
    if (el.getBoundingClientRect().top < viewH) {
      el.classList.add('is-visible');
    }
  });

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

  revealEls.forEach(el => {
    if (!el.classList.contains('is-visible')) revealObserver.observe(el);
  });

  /* ---------- Counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  // rAF is paused in backgrounded/hidden tabs; fall back to a timer so the
  // count-up still completes instead of freezing at 0.
  const nextFrame = (cb) => document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb);

  function runCounter(el) {
    const target = parseInt(el.dataset.count, 10);
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(eased * target);
      if (p < 1) nextFrame(tick);
    }
    nextFrame(tick);
  }

  const counterObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      runCounter(entry.target);
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.5 });

  counters.forEach(el => {
    if (el.getBoundingClientRect().top < viewH) {
      runCounter(el);
    } else {
      counterObserver.observe(el);
    }
  });

  /* ---------- Lightbox (gallery) ---------- */
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');

  document.querySelectorAll('[data-gallery-img]').forEach(btn => {
    btn.addEventListener('click', () => {
      lightboxImg.src = btn.getAttribute('data-gallery-img');
      lightboxCaption.textContent = btn.getAttribute('data-caption') || '';
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  lightboxClose.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });

  /* ---------- Project modal ---------- */
  const PROJECTS = {
    p1: {
      img: 'assets/images/project-1.jpg', year: '2025', title: 'קווי מצדה',
      desc: 'ביצוע קו אספקת מים בקו ראשי בין ערד לאתר מצדה, אשר נועד לתת מענה לגידול בצריכת המים במצדה. הקו מצנרת פוליאתילן בקוטר 225 מ"מ ובאורך של כ-13 ק"מ, והונח בתוואי שטח סלעי מורכב ובעל שינויים טופוגרפיים.',
      solution: 'ביצוע דרכי גישה ועבודות עפר, שמונה חציות של כביש 3199 (נתיבי ישראל) כולל קרצוף ושחזור אספלט, הקמת חצר חדשה עם מיכל מים 120 מ"ק וחדר חשמל ובקרה, ומערכת ייצור חשמל סולארית עצמאית עם שו"ב מרחוק.'
    },
    p2: {
      img: 'assets/images/project-2.jpg', year: '2025', title: 'קווי שיפוט ניר עם',
      desc: 'פרויקט לניתוק קידוחים מליחים ממערכת אספקת מי השתייה של העיר שדרות, ובמקומם הונחו קווים חדשים לחיזוק והגברת אספקת מי השתייה לעיר. הותקנו קווי מים מפלדה בקטרים 16", 20" ו-24", באורך כולל של כ-10 ק"מ.',
      solution: 'ביצוע חציות של כבישים ראשיים של נתיבי ישראל וחציות תשתיות שונות בשיטות קידוח אופקיות מתקדמות, ביצוע מבחני לחץ לקווים, הפסקות מים מתואמות והתחברויות לקווים ראשיים.'
    },
    p3: {
      img: 'assets/images/project-3.jpg', year: '2025', title: 'כביש 375 קטע מזרחי',
      desc: 'במסגרת הרחבת כביש 375 של נתיבי ישראל בוצעה העתקה של שני קווי מים של חברת מקורות, קווי פלדה בקטרים 28" ו-32". במקביל בוצעה התאמה ושדרוג של המערכת להגדלת המענה לצריכת המים האזורית.',
      solution: 'הכנת השטח וחפירת בורות כניסה ויציאה, בניית מערכת דיפון לתמיכה בבורות, חציית הכביש בשיטת AUGER BORING בשרוול פלדה 40" לאורך שלושה מקטעים (60, 37 ו-45 מטר) בסלע קשה ורציף, וביצוע הפסקת מים והפעלת הקווים החדשים.'
    },
    p4: {
      img: 'assets/images/project-4.jpg', year: '2020', title: 'קו משאבי שדה',
      desc: 'ביצוע קו מים ראשי מפלדה בקוטר 28" ובאורך כ-5 ק"מ, מבריכת שדה בוקר צפונה ועד לתחנת שדה בוקר. תוואי הקו הונח בסמיכות לקו דלק 16" של קצא"א לאורך כ-4 ק"מ, כולל חצייה של קו שלוחת רמון 8".',
      solution: 'תיאומים מלאים עם כלל חברות התשתית הרלוונטיות בדגש על חציות קווי גז ודלק רגישים, והקמת שני קווי מים עיליים מפלדה 24" לעלייה לבריכת שדה בוקר עם בלוקי עיגון לייצוב והבטחת בטיחות הקו בתנאי שטח מורכבים.'
    },
    p5: {
      img: 'assets/images/project-5.jpg', year: '2023', title: 'קו מחלק לתל שבע',
      desc: 'ביצוע קו מים חדש מפלדה בקוטר 20" באורך 100 מטר. תוואי הקו הונח במקביל לכביש הגישה לתל שבע, והמשיך עד לצידה המערבי של מסילת הרכבת באר שבע-דימונה.',
      solution: 'חציית מסילת רכבת ישראל קו באר שבע-דימונה בקידוח אופקי AUGER BORING בשרוול פלדה 30" באורך 98 מטר בסלע קשה ורציף, חציית כביש של רשות הטבע והגנים, חציית נחל חברון בגשרון עילי מצינור פלדה 20" עם כלונסאות לביסוס, ביצוע מערכות מים על הקו והתחברות לקו פלדה ראשי.'
    }
  };

  const projectModal = document.getElementById('projectModal');
  const modalImg = document.getElementById('modalImg');
  const modalYear = document.getElementById('modalYear');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const modalSolution = document.getElementById('modalSolution');

  document.querySelectorAll('[data-open-project]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = PROJECTS[btn.getAttribute('data-open-project')];
      if (!p) return;
      modalImg.src = p.img;
      modalImg.alt = p.title;
      modalYear.textContent = p.year;
      modalTitle.textContent = p.title;
      modalDesc.textContent = p.desc;
      modalSolution.textContent = p.solution;
      projectModal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    });
  });

  function closeProjectModal() {
    projectModal.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', closeProjectModal));

  /* ---------- Escape key closes overlays ---------- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLightbox();
      closeProjectModal();
      closeMobileMenu();
    }
  });

  /* ---------- Contact form (client-side demo) ---------- */
  const form = document.getElementById('contactForm');
  const formNote = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const subject = form.subject.value;

      if (!name || !phone || !subject) {
        formNote.textContent = 'נא למלא שם, טלפון ונושא פנייה.';
        formNote.classList.add('is-error');
        return;
      }
      formNote.classList.remove('is-error');
      formNote.textContent = `תודה ${name}! פנייתכם התקבלה ונחזור אליכם בהקדם.`;
      form.reset();
    });
  }

  /* ---------- Card tilt effect ---------- */
  const tiltEls = document.querySelectorAll('.service-card, .value-card, .project-card');
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    tiltEls.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        el.style.transition = 'transform .08s linear';
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(800px) rotateX(${y * -4}deg) rotateY(${x * 4}deg) translateY(-8px)`;
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .45s cubic-bezier(.16,.84,.36,1)';
        el.style.transform = '';
      });
    });
  }

})();
