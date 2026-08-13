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
  const heroVideo = document.getElementById('heroVideo');

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 60);
    backToTop.classList.toggle('is-visible', y > 700);

    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    scrollProgress.style.width = total > 0 ? `${(y / total) * 100}%` : '0%';

    // hero parallax — התמונה והווידאו זזים יחד
    const heroH = hero.offsetHeight;
    if (y < heroH) {
      const t = `scale(1.08) translateY(${y * 0.18}px)`;
      if (heroImg) heroImg.style.transform = t;
      if (heroVideo) heroVideo.style.transform = t;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- Hero background video ----------
     ~5MB, ולכן נטען רק אחרי שהעמוד מוכן ורק כשזה באמת מתאים.
     בכל מקרה אחר התמונה נשארת — היא ה-fallback המלא. */
  (function initHeroVideo() {
    if (!heroVideo) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bigScreen = window.matchMedia('(min-width: 900px)').matches;
    const conn = navigator.connection || {};
    const cheapData = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');

    if (reduceMotion || !bigScreen || cheapData) return;

    const start = () => {
      heroVideo.src = heroVideo.dataset.src;
      heroVideo.load();
      // מציגים רק כשיש מספיק בופר לניגון רציף, אחרת רואים תקיעות
      heroVideo.addEventListener('canplaythrough', () => {
        heroVideo.play()
          .then(() => heroVideo.classList.add('is-playing'))
          .catch(() => {});           // חסימת autoplay — נשארים עם התמונה
      }, { once: true });
      heroVideo.addEventListener('error', () => heroVideo.remove(), { once: true });
    };

    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });

    // חוסך סוללה ורוחב פס כשהגולש לא רואה את ההירו
    document.addEventListener('visibilitychange', () => {
      if (!heroVideo.src) return;
      document.hidden ? heroVideo.pause() : heroVideo.play().catch(() => {});
    });
  })();

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
      year: '2025', title: 'קווי מצדה',
      body: [
        'ביצוע קו אספקת מים בקו ראשי בין ערד לאתר מצדה, אשר נועד לתת מענה לגידול בצריכת המים במצדה. הקו הינו מצנרת פוליאתילן בקוטר 225 מ"מ ובאורך של כ-13 ק"מ, והונח בתוואי שטח סלעי מורכב ובעל שינויים טופוגרפיים.',
        'העבודה כללה ביצוע דרכי גישה ועבודות עפר, וכן שמונה חציות של כביש 3199 (נתיבי ישראל), כולל קרצוף ושחזור שכבות האספלט לאחר הביצוע. בנוסף, הוקמה חצר חדשה ובוצעה אספקה והתקנה של מיכל מים בנפח 120 מ"ק, הכולל חדר חשמל ובקרה.',
        'במסגרת הפרויקט הוקמה גם מערכת ייצור חשמל סולארית עצמאית, לצד מערכת שליטה ובקרה מרחוק לניהול מערכת אספקת המים.'
      ],
      images: [
        'assets/images/projects/metzada/metzada-01.jpg',
        'assets/images/projects/metzada/metzada-02.jpg'
      ]
    },
    p2: {
      year: '2025', title: 'קווי שיפוט ניר עם',
      body: [
        'בוצע פרויקט לניתוק קידוחים מליחים ממערכת אספקת מי השתייה של העיר שדרות, ובמקומם הונחו קווים חדשים לחיזוק והגברת אספקת מי השתייה לעיר. במסגרת הפרויקט הותקנו קווי מים מפלדה בקטרים 16", 20" ו־24", באורך כולל של כ־10 ק"מ.',
        'העבודה כללה ביצוע מספר חציות של כבישים ראשיים של נתיבי ישראל וכן חציות תשתיות שונות תוך שימוש בשיטות קידוח אופקיות מתקדמות. כבכלל הפרויקטים, בפרויקט בוצע מבחן לחץ לקווים, הפסקות מים והתחברויות לקווים ראשיים.'
      ],
      images: [
        'assets/images/projects/nir-am/nir-am-01.jpg',
        'assets/images/projects/nir-am/nir-am-02.jpg',
        'assets/images/projects/nir-am/nir-am-03.jpg',
        'assets/images/projects/nir-am/nir-am-04.jpg',
        'assets/images/projects/nir-am/nir-am-05.jpg',
        'assets/images/projects/nir-am/nir-am-06.jpg',
        'assets/images/projects/nir-am/nir-am-07.jpg',
        'assets/images/projects/nir-am/nir-am-08.jpg',
        'assets/images/projects/nir-am/nir-am-09.jpg',
        'assets/images/projects/nir-am/nir-am-10.jpg',
        'assets/images/projects/nir-am/nir-am-11.jpg',
        'assets/images/projects/nir-am/nir-am-12.jpg',
        'assets/images/projects/nir-am/nir-am-13.jpg',
        'assets/images/projects/nir-am/nir-am-14.jpg'
      ]
    },
    p3: {
      year: '2025', title: 'כביש 375 קטע מזרחי',
      body: [
        'במסגרת הרחבת כביש 375 של נתיבי ישראל בוצעה העתקה של שני קווי מים של חברת מקורות, קווי פלדה בקטרים 28" ו־32". במקביל, בוצעה התאמה ושדרוג של המערכת במטרה להגדיל את המענה לצריכת המים האזורית ולהבטיח אמינות ואספקה יציבה לאורך זמן.'
      ],
      listTitle: 'שלבי הפרויקט',
      list: [
        'הכנת השטח וחפירות בורות כניסה ויציאה.',
        'בניית מערכת דיפון לתמיכה בבורות הכניסה.',
        'חציית הכביש בשיטת AUGER BORING בשרוול פלדה בקוטר 40" לאורך שלושה מקטעים באורכים 60, 37 ו-45 מטר בסלע קשה ורציף.',
        'ביצוע הפסקת מים והפעלת הקווים החדשים.'
      ],
      images: [
        'assets/images/projects/road-375/road-375-01.jpg',
        'assets/images/projects/road-375/road-375-02.jpg',
        'assets/images/projects/road-375/road-375-03.jpg',
        'assets/images/projects/road-375/road-375-04.jpg',
        'assets/images/projects/road-375/road-375-05.jpg',
        'assets/images/projects/road-375/road-375-06.jpg',
        'assets/images/projects/road-375/road-375-07.jpg',
        'assets/images/projects/road-375/road-375-08.jpg',
        'assets/images/projects/road-375/road-375-09.jpg',
        'assets/images/projects/road-375/road-375-10.jpg',
        'assets/images/projects/road-375/road-375-11.jpg',
        'assets/images/projects/road-375/road-375-12.jpg',
        'assets/images/projects/road-375/road-375-13.jpg',
        'assets/images/projects/road-375/road-375-14.jpg',
        'assets/images/projects/road-375/road-375-15.jpg',
        'assets/images/projects/road-375/road-375-16.jpg'
      ]
    },
    p4: {
      year: '2020', title: 'קו משאבי שדה',
      body: [
        'בוצע קו מים ראשי מפלדה בקוטר 28" ובאורך של כ־5 ק"מ, מבריכת שדה בוקר צפונה ועד לתחנת שדה בוקר. תוואי הקו הונח בסמיכות לקו דלק 16" של קצא"א לאורך כ־4 ק"מ, כולל חציית הקו הקיים. בנוסף, בוצעה חצייה של קו שלוחת רמון בקוטר 8" של חברת קמ"ד תשתיות נפט ואנרגיה.',
        'הפרויקט בוצע תוך תיאומים מלאים עם כלל חברות התשתית הרלוונטיות, ובפיקוח ותיאום הדוק בכל שלבי העבודה, בדגש על חציות קווי הגז והדלק הרגישים.',
        'במסגרת העבודות הוקמו גם שני קווי מים עיליים מפלדה בקוטר 24", לצורך עלייה לבריכת שדה בוקר. הפרויקט כלל התמודדות עם תנאי שטח מורכבים והפרשי גבהים משמעותיים, תוך ביצוע תמיכות באמצעות בלוקי עיגון לייצוב והבטחת בטיחות ואיכות הקו.',
        'העבודה התאפיינה ברמת מורכבות גבוהה במיוחד ובאתגרים הנדסיים משמעותיים, אשר דרשו תכנון מדויק, תיאום קפדני וביצוע מקצועי בשטח.'
      ],
      images: [
        'assets/images/projects/sde-boker/sde-boker-01.jpg',
        'assets/images/projects/sde-boker/sde-boker-02.jpg',
        'assets/images/projects/sde-boker/sde-boker-03.jpg',
        'assets/images/projects/sde-boker/sde-boker-04.jpg'
      ]
    },
    p5: {
      year: '2023', title: 'קו מחלק לתל שבע',
      body: [
        'בוצע קו מים חדש מפלדה בקוטר 20" באורך 100 מטר. תוואי הקו הונח במקביל לכביש הגישה לתל שבע, והמשיך עד לצידה המערבי של מסילת הרכבת באר שבע–דימונה.'
      ],
      listTitle: 'עבודות בפרויקט',
      list: [
        'חציית מסילת רכבת ישראל קו באר שבע–דימונה בקידוח אופקי AUGER BORING בשרוול פלדה בקוטר 30" באורך של 98 מטר בסלע קשה ורציף.',
        'חציית כביש של רשות הטבע והגנים הכולל עבודות עפר, שחזור אספלט והסדרת השטח.',
        'חציית נחל חברון באמצעות הקמת גשרון עילי מצינור פלדה 20", כולל כלונסאות לביסוס.',
        'ביצוע מערכות מים על הקו והתחברות לקו פלדה ראשי והפעלתו.'
      ],
      images: [
        'assets/images/projects/tel-sheva/tel-sheva-01.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-02.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-03.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-04.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-05.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-06.jpg',
        'assets/images/projects/tel-sheva/tel-sheva-07.jpg'
      ]
    }
  };

  const projectModal = document.getElementById('projectModal');
  const modalImg = document.getElementById('modalImg');
  const modalYear = document.getElementById('modalYear');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDesc');
  const pmThumbs = document.getElementById('pmThumbs');
  const pmCounter = document.getElementById('pmCounter');
  const pmPrev = document.getElementById('pmPrev');
  const pmNext = document.getElementById('pmNext');

  let galleryImages = [];
  let galleryIndex = 0;

  function showGalleryImage(i) {
    if (!galleryImages.length) return;
    galleryIndex = (i + galleryImages.length) % galleryImages.length;
    modalImg.src = galleryImages[galleryIndex];
    pmCounter.textContent = `${galleryIndex + 1} / ${galleryImages.length}`;
    pmThumbs.querySelectorAll('button').forEach((b, n) => {
      b.classList.toggle('is-active', n === galleryIndex);
    });
    const active = pmThumbs.children[galleryIndex];
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }

  pmPrev.addEventListener('click', () => showGalleryImage(galleryIndex - 1));
  pmNext.addEventListener('click', () => showGalleryImage(galleryIndex + 1));

  document.querySelectorAll('[data-open-project]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = PROJECTS[btn.getAttribute('data-open-project')];
      if (!p) return;

      modalYear.textContent = 'שנת ביצוע ' + p.year;
      modalTitle.textContent = p.title;
      modalImg.alt = p.title;

      // גוף הטקסט + רשימת שלבים אם קיימת
      let html = p.body.map(t => `<p>${t}</p>`).join('');
      if (p.list && p.list.length) {
        html += `<h4>${p.listTitle || 'שלבי הפרויקט'}</h4>`;
        html += '<ul class="pm-list">' + p.list.map(t => `<li>${t}</li>`).join('') + '</ul>';
      }
      modalDesc.innerHTML = html;

      // גלריית התמונות של הפרויקט
      galleryImages = p.images || [];
      pmThumbs.innerHTML = galleryImages
        .map((src, i) => `<button type="button" aria-label="תמונה ${i + 1}"><img src="${src}" alt="" loading="lazy"></button>`)
        .join('');
      pmThumbs.querySelectorAll('button').forEach((b, i) => {
        b.addEventListener('click', () => showGalleryImage(i));
      });

      const multi = galleryImages.length > 1;
      pmThumbs.style.display = multi ? '' : 'none';
      pmPrev.style.display = pmNext.style.display = multi ? '' : 'none';
      pmCounter.style.display = multi ? '' : 'none';

      showGalleryImage(0);
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
    // חיצים לניווט בגלריית הפרויקט (RTL: ימין = הקודם)
    if (projectModal.classList.contains('is-open') && galleryImages.length > 1) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); showGalleryImage(galleryIndex + 1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); showGalleryImage(galleryIndex - 1); return; }
    }
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
