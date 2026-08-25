/* =========================================================
   עורך חזותי צף לאתר נ.ד.ר
   נטען אך ורק על ידי editor/server.py ואינו נשמר בקבצי האתר.
========================================================= */
(() => {
  'use strict';

  if (window.__nedEditorLoaded) return;
  window.__nedEditorLoaded = true;

  const FILE = (document.querySelector('meta[name="x-editor-file"]') || {}).content
    || (location.pathname.replace(/^\//, '') || 'index.html');

  // תגיות שמותר שיופיעו בתוך אלמנט וייחשב עדיין "ניתן לעריכה כיחידה".
  // SVG נכלל כי פריטי רשימה רבים באתר הם "אייקון + טקסט" (למשל
  // "מה כולל השירות"), ובלעדיו אי אפשר היה לערוך את הטקסט שלהם.
  const INLINE = new Set(['SPAN', 'STRONG', 'EM', 'B', 'I', 'U', 'SMALL', 'BR', 'SUP', 'SUB', 'MARK', 'SVG']);

  // בלוקים שמותר למחוק בלחיצה אחת
  const REMOVABLE = [
    '.service-card', '.value-card', '.team-card', '.project-card',
    '.related-card', '.gallery-item', '.stat', '.about-points li',
    '.service-feature-box li', '.footer-col li', '.contact-info-card',
    '.marquee-track span', '.cities-cloud span', '.main-menu > ul > li',
    '.side-nav li', '.mobile-menu > ul > li', '.nav-dropdown-panel > a',
    '.hero-actions .btn', '.service-stat'
  ].join(',');

  // מיכלים גדולים - נמחקים רק במצב "מחיקה מתקדמת"
  const REMOVABLE_DEEP = 'section, .section-head, .services-grid, .team-grid, .projects-grid, ' +
    '.gallery-grid, .values-grid, .related-grid, .footer-col, .service-cta-banner, ' +
    '.map-grid, .contact-grid, .hero-stats, .marquee, .about-media, .service-feature-box';

  let editing = false;
  let deepMode = false;
  let dirty = 0;
  let activeEl = null;
  let dialogTarget = null;
  let killTarget = null;
  const undoStack = [];

  const PAGE_LABELS = {
    'index.html': 'עמוד הבית',
    'horizontal-drilling.html': 'קידוחים אופקיים',
    'excavation.html': 'חפירות',
    'development.html': 'פיתוח',
    'mapping.html': 'איתור ומיפוי',
    'heavy-support.html': 'הקמת תמיכה כבדה'
  };

  const icon = (d) => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const I_PEN = icon('<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="M14 6l4 4"/>');
  const I_X = icon('<path d="M5 5l14 14M19 5 5 19"/>');
  const I_SAVE = icon('<path d="M5 4h11l3 3v13H5z"/><path d="M9 4v5h6V4M8 20v-6h8v6"/>');
  const I_UNDO = icon('<path d="M4 10h10a5 5 0 0 1 0 10H9"/><path d="M8 6l-4 4 4 4"/>');
  const I_IMG = icon('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M4 17.5 9.5 12l3.5 3.5 3-3 4 5"/>');
  const I_TRASH = icon('<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>');
  const I_PLUS = icon('<path d="M12 5v14M5 12h14"/>');

  /* ---------------- ספריית רכיבים ----------------
     כל רכיב יודע לאיזה מיכל הוא שייך, כך שהוספה היא לחיצה אחת.
     המחלקה is-visible מתווספת מיד כדי שהרכיב לא ייוולד שקוף. */
  const COMPONENTS = [
    {
      name: 'כרטיס שירות', icon: I_PEN, target: '.services-grid',
      html: `<article class="service-card reveal is-visible">
        <div class="service-icon"><svg><use href="#i-tool"></use></svg></div>
        <h3>שם השירות</h3>
        <p>תיאור קצר של השירות - לחצו כאן כדי לערוך את הטקסט.</p>
        <a href="#contact" class="card-link"><span>קראו עוד</span><svg><use href="#i-arrow"></use></svg></a>
      </article>`
    },
    {
      // הפוטר מכיל כמה עמודות זהות, ולכן מאתרים לפי הכותרת ולא לפי מחלקה
      name: 'שירות בפוטר', icon: I_PEN,
      target: () => [...document.querySelectorAll('.footer-col')]
        .find(c => (c.querySelector('h4') || {}).textContent?.includes('שירותי'))
        ?.querySelector('ul'),
      html: `<li><a href="#services">שם השירות</a></li>`
    },
    {
      name: 'שירות בתפריט', icon: I_PEN,
      target: '.nav-dropdown-panel',
      before: '.nav-dropdown-all',       // תמיד לפני "כל השירותים בעמוד אחד"
      html: `<a href="#services"><svg><use href="#i-tool"></use></svg><span>שם השירות</span></a>`
    },
    {
      name: 'איש צוות', icon: I_PEN, target: '.team-grid',
      html: `<div class="team-card reveal is-visible">
        <div class="team-photo"><img src="assets/images/team-1.jpg" alt="חבר צוות"></div>
        <h3>שם מלא</h3>
        <p>תפקיד בחברה</p>
      </div>`
    },
    {
      name: 'תמונה בגלריה', icon: I_IMG, target: '.gallery-grid',
      html: `<button class="gallery-item reveal is-visible" data-gallery-img="assets/images/gallery-1.jpg" data-caption="כיתוב לתמונה">
        <img src="assets/images/gallery-1.jpg" alt="תמונה מהשטח" loading="lazy">
        <span class="gallery-zoom"><svg><use href="#i-image"></use></svg></span>
      </button>`
    },
    {
      name: 'לקוח בסרגל', icon: I_PEN, target: '.marquee-track',
      html: `<span>שם הלקוח</span>`
    },
    {
      name: 'כרטיס ערך', icon: I_PEN, target: '.values-grid',
      html: `<div class="value-card reveal is-visible">
        <div class="value-icon"><svg><use href="#i-award"></use></svg></div>
        <h3>שם הערך</h3>
        <p>תיאור קצר של הערך - לחצו לעריכה.</p>
      </div>`
    },
    {
      name: 'נתון בהירו', icon: I_PEN, target: '.hero-stats',
      html: `<div class="stat">
        <span class="stat-num">100</span><span class="stat-plus">+</span>
        <p>תיאור הנתון</p>
      </div>`
    },
    {
      // "מה כולל השירות" בעמודי השירות, ורשימת היתרונות באודות -
      // אותו סימון בדיוק, ולכן רכיב אחד שמאתר את מה שקיים בעמוד
      name: 'שורה ב"מה כולל השירות"', icon: I_PEN,
      target: () => document.querySelector('.service-feature-box ul, .about-points'),
      html: `<li><svg><use href="#i-check"></use></svg> שורה חדשה - לחצו לעריכה</li>`
    },
    {
      name: 'כרטיס יצירת קשר', icon: I_PEN, target: '.contact-info',
      html: `<div class="contact-info-card">
        <div class="contact-info-icon"><svg><use href="#i-phone"></use></svg></div>
        <div><span>כותרת</span><strong>הפרט עצמו</strong></div>
      </div>`
    },
    {
      name: 'מדור טקסט חדש', icon: I_PLUS, target: 'main', atEnd: true,
      html: `<section class="about" style="padding:110px 0">
        <div class="container">
          <p class="section-eyebrow reveal is-visible">כותרת עליונה</p>
          <h2 class="section-title reveal is-visible">כותרת המדור</h2>
          <p class="about-text reveal is-visible" style="max-width:760px">
            תוכן המדור - לחצו על כל שורה כדי לערוך אותה. אפשר להוסיף כאן כל טקסט שתרצו.
          </p>
        </div>
      </section>`
    },
    {
      name: 'באנר קריאה לפעולה', icon: I_PLUS, target: 'main', atEnd: true,
      html: `<section style="padding:0 0 90px"><div class="container">
        <div class="service-cta-banner reveal is-visible">
          <div class="service-cta-text">
            <h3>מעוניינים בהצעת מחיר?</h3>
            <p>צרו איתנו קשר ונשמח לעמוד לשירותכם.</p>
          </div>
          <a href="#contact" class="btn btn-ghost btn-lg"><span>דברו איתנו</span><svg><use href="#i-arrow"></use></svg></a>
        </div>
      </div></section>`
    }
  ];

  /* ---------------- UI ---------------- */

  const toggle = document.createElement('button');
  toggle.id = 'nedToggle';
  toggle.title = 'עורך האתר';
  toggle.innerHTML = I_PEN;

  const banner = document.createElement('div');
  banner.id = 'nedBanner';
  banner.textContent = 'מצב עריכה פעיל - לחצו על טקסט כדי לערוך, על תמונה כדי להחליף';

  const panel = document.createElement('aside');
  panel.id = 'nedPanel';
  panel.innerHTML = `
    <div class="ned-head">
      <div>
        <h2>עורך האתר</h2>
        <p>${FILE}</p>
      </div>
      <div class="ned-head-btns">
        <button class="ned-x" data-ned-side title="העברה לצד השני">${icon('<path d="M8 5l-5 7 5 7M16 5l5 7-5 7"/>')}</button>
        <button class="ned-x" data-ned-min title="מזעור - לראות את האתר במלואו">${icon('<path d="M5 12h14"/>')}</button>
        <button class="ned-x" data-ned-close title="סגירה">${I_X}</button>
      </div>
    </div>

    <div class="ned-body">
      <div class="ned-sec">
        <h3>מצב עריכה</h3>
        <div class="ned-switch" data-ned-switch>
          <div>
            <strong>עריכה ישירה בעמוד</strong>
            <span>לחצו על טקסט או תמונה כדי לשנות</span>
          </div>
          <div class="ned-track"></div>
        </div>
      </div>

      <div class="ned-sec">
        <h3>מחיקת אלמנטים</h3>
        <div class="ned-switch" data-ned-deep>
          <div>
            <strong>מחיקה מתקדמת</strong>
            <span>מאפשר למחוק גם מדורים שלמים</span>
          </div>
          <div class="ned-track"></div>
        </div>
        <button class="ned-btn ned-btn-ghost" data-ned-undo disabled>${I_UNDO}<span>שחזור המחיקה האחרונה</span></button>
      </div>

      <div class="ned-sec">
        <h3>ניהול שירותים · כל האתר</h3>
        <div class="ned-svc-list" data-ned-svc></div>
        <button class="ned-btn ned-btn-ghost" data-ned-svc-add>${I_PLUS}<span>שירות חדש</span></button>
        <button class="ned-btn ned-btn-primary" data-ned-svc-apply style="margin-top:8px">
          ${I_SAVE}<span>החלה על כל העמודים</span>
        </button>
        <p class="ned-status" data-ned-svc-status></p>
        <div class="ned-hint" style="padding:10px 12px;font-size:.72rem">
          מעדכן את הכרטיסים בעמוד הבית, התפריט, תפריט המובייל והפוטר - בכל 6 העמודים בבת אחת.
        </div>
      </div>

      <div class="ned-sec">
        <h3>הוספת רכיבים</h3>
        <div class="ned-comps" data-ned-comps></div>
        <p class="ned-hint" style="margin-top:10px;padding:10px 12px;font-size:.72rem">
          הרכיב נוסף בסוף המדור המתאים, ואפשר מיד לערוך אותו או למחוק.
        </p>
      </div>

      <div class="ned-sec">
        <h3>שינויים <span class="ned-count" data-ned-count style="display:none">0</span></h3>
        <button class="ned-btn ned-btn-primary" data-ned-save disabled>${I_SAVE}<span>שמירה לקובץ</span></button>
        <button class="ned-btn ned-btn-ghost" data-ned-revert disabled>${I_UNDO}<span>ביטול כל השינויים</span></button>
        <p class="ned-status" data-ned-status></p>
      </div>

      <div class="ned-sec">
        <h3>עמודי האתר</h3>
        <div class="ned-pages" data-ned-pages></div>
      </div>

      <div class="ned-sec">
        <h3>איך זה עובד</h3>
        <div class="ned-hint">
          <b>טקסט:</b> לחיצה על כל כותרת או פסקה פותחת עריכה במקום.<br>
          <b>תמונה:</b> לחיצה על תמונה פותחת החלפה - קישור או קובץ מהמחשב.<br>
          <b>קישור:</b> <kbd>Alt</kbd> + לחיצה על כפתור או קישור לעריכת היעד.<br>
          <b>מחיקה:</b> ריחוף מעל כרטיס או פריט → כפתור אדום בפינה.<br>
          <b>שחזור מחיקה:</b> <kbd>⌘Z</kbd><br>
          <b>שמירה:</b> <kbd>⌘S</kbd> - נשמר ישירות לקובץ, עם גיבוי אוטומטי.<br>
          <b>יציאה:</b> <kbd>Esc</kbd>
        </div>
      </div>
    </div>

    <div class="ned-foot">
      <div class="ned-hint" style="padding:12px 14px">
        העורך רץ רק מקומית ואינו חלק מקבצי האתר - מה שתעלו לאוויר נקי ממנו.
      </div>
    </div>`;

  const dialog = document.createElement('div');
  dialog.id = 'nedDialog';
  dialog.innerHTML = `
    <div class="ned-dialog-panel">
      <h3 data-ned-dtitle>החלפת תמונה</h3>
      <p data-ned-dsub>בחרו קובץ מהמחשב או הדביקו כתובת</p>
      <img class="ned-preview" data-ned-dpreview alt="">
      <label class="ned-label" data-ned-dlabel>כתובת התמונה</label>
      <input class="ned-input" data-ned-dinput type="text" dir="ltr">
      <div data-ned-dfile>
        <p class="ned-or">- או -</p>
        <label class="ned-file">
          ${I_IMG}<span>העלאת קובץ מהמחשב</span>
          <input type="file" accept="image/*" data-ned-dupload>
        </label>
      </div>
      <div class="ned-dialog-actions">
        <button class="ned-btn ned-btn-primary" data-ned-dok>אישור</button>
        <button class="ned-btn ned-btn-ghost" style="margin:0" data-ned-dcancel>ביטול</button>
      </div>
    </div>`;

  const kill = document.createElement('button');
  kill.id = 'nedKill';
  kill.title = 'מחיקת האלמנט';
  kill.innerHTML = I_TRASH;

  document.body.append(toggle, banner, panel, dialog, kill);

  const $ = (sel, root = panel) => root.querySelector(sel);
  const statusEl = $('[data-ned-status]');
  const countEl = $('[data-ned-count]');
  const saveBtn = $('[data-ned-save]');
  const revertBtn = $('[data-ned-revert]');
  const switchEl = $('[data-ned-switch]');
  const deepEl = $('[data-ned-deep]');
  const undoBtn = $('[data-ned-undo]');

  /* ---------------- עזרי מצב ---------------- */

  function setStatus(msg, kind) {
    statusEl.textContent = msg || '';
    statusEl.className = 'ned-status' + (kind ? ' is-' + kind : '');
  }

  function markDirty(el) {
    if (el && !el.classList.contains('ned-dirty')) el.classList.add('ned-dirty');
    dirty++;
    countEl.style.display = '';
    countEl.textContent = dirty;
    saveBtn.disabled = false;
    revertBtn.disabled = false;
    setStatus('');
  }

  function isEditableTarget(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('#nedPanel, #nedToggle, #nedDialog, #nedBanner')) return false;
    if (['IMG', 'SVG', 'USE', 'INPUT', 'SELECT', 'TEXTAREA', 'IFRAME'].includes(el.tagName)) return false;
    if (!el.textContent.trim()) return false;
    // מותר רק אם כל צאצאיו הם תגיות טקסט פנימיות.
    // toUpperCase כי תגיות SVG מחזירות tagName באותיות קטנות
    return [...el.children].every(c => INLINE.has(c.tagName.toUpperCase()));
  }

  function beginEdit(el) {
    if (activeEl && activeEl !== el) endEdit();
    activeEl = el;
    el.setAttribute('contenteditable', 'true');
    el.focus();
    const before = el.innerHTML;
    el.addEventListener('blur', function onBlur() {
      el.removeEventListener('blur', onBlur);
      el.removeAttribute('contenteditable');
      if (el.innerHTML !== before) markDirty(el);
      if (activeEl === el) activeEl = null;
    });
  }

  function endEdit() {
    // blur() מריץ את מטפל ה-blur באופן סינכרוני, והוא כבר מאפס את activeEl -
    // לכן שומרים הפניה מקומית לפני, אחרת נקבל TypeError שמפיל את השמירה.
    const el = activeEl;
    activeEl = null;
    if (el) {
      el.blur();
      el.removeAttribute('contenteditable');
    }
  }

  function setEditing(on) {
    editing = on;
    document.documentElement.classList.toggle('ned-editing', on);
    banner.classList.toggle('is-on', on);
    toggle.classList.toggle('is-active', on);
    switchEl.classList.toggle('is-on', on);
    toggle.innerHTML = on ? I_X : I_PEN;
    if (!on) { endEdit(); hideKill(); }
    document.querySelectorAll('[data-ned-editable]').forEach(el => el.removeAttribute('data-ned-editable'));
  }

  /* ---------------- מחיקת אלמנטים ---------------- */

  function removableFor(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.closest('#nedPanel, #nedToggle, #nedDialog, #nedBanner, #nedKill')) return null;
    let hit = el.closest(REMOVABLE);
    if (!hit && deepMode) hit = el.closest(REMOVABLE_DEEP);
    if (!hit || hit === document.body || hit === document.documentElement) return null;
    return hit;
  }

  function showKill(el) {
    killTarget = el;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return hideKill();
    kill.style.top = Math.max(6, r.top + 6) + 'px';
    kill.style.left = Math.max(6, r.left + 6) + 'px';
    kill.classList.add('is-on');
    el.classList.add('ned-kill-hover');
  }

  function hideKill() {
    if (killTarget) killTarget.classList.remove('ned-kill-hover');
    killTarget = null;
    kill.classList.remove('is-on');
  }

  function removeElement(el) {
    undoStack.push({ type: 'remove', node: el, parent: el.parentNode, next: el.nextSibling });
    el.remove();
    undoBtn.disabled = false;
    markDirty(null);
    setStatus('נמחק - ⌘Z לשחזור', 'ok');
  }

  // מבטל את הפעולה האחרונה - מחיקה או הוספה
  function undoLast() {
    const last = undoStack.pop();
    if (!last) return;

    if (last.type === 'insert') {
      last.node.remove();
      setStatus('הרכיב הוסר', 'ok');
    } else {
      if (last.next && last.next.parentNode === last.parent) {
        last.parent.insertBefore(last.node, last.next);
      } else {
        last.parent.appendChild(last.node);
      }
      setStatus('המחיקה שוחזרה', 'ok');
    }

    undoBtn.disabled = undoStack.length === 0;
    dirty = Math.max(0, dirty - 1);
    countEl.textContent = dirty;
    countEl.style.display = dirty ? '' : 'none';
  }

  kill.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (killTarget) {
      const el = killTarget;
      hideKill();
      removeElement(el);
    }
  });

  document.addEventListener('scroll', () => {
    if (killTarget) showKill(killTarget);
  }, true);

  window.addEventListener('resize', () => { if (killTarget) showKill(killTarget); });

  deepEl.addEventListener('click', () => {
    deepMode = !deepMode;
    deepEl.classList.toggle('is-on', deepMode);
    document.documentElement.classList.toggle('ned-deep', deepMode);
    hideKill();
  });

  undoBtn.addEventListener('click', undoLast);

  /* ---------------- הוספת רכיבים ---------------- */

  function insertComponent(def) {
    // target יכול להיות סלקטור או פונקציה, כשצריך איתור לפי תוכן
    const host = typeof def.target === 'function'
      ? def.target()
      : document.querySelector(def.target);

    if (!host) {
      setStatus(`לא נמצא מדור מתאים ל"${def.name}" בעמוד הזה`, 'err');
      return;
    }

    const tpl = document.createElement('template');
    tpl.innerHTML = def.html.trim();
    const node = tpl.content.firstElementChild;

    const anchor = def.before ? host.querySelector(def.before) : null;
    if (anchor) host.insertBefore(node, anchor);
    else host.appendChild(node);
    undoStack.push({ type: 'insert', node });
    undoBtn.disabled = false;
    markDirty(null);

    // מביא את הרכיב החדש לתצוגה ומהבהב עליו כדי שיהיה ברור מה נוסף
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    node.classList.add('ned-just-added');
    setTimeout(() => node.classList.remove('ned-just-added'), 1800);

    setStatus(`"${def.name}" נוסף - לחצו עליו כדי לערוך`, 'ok');
    if (!editing) setEditing(true);
  }

  const compsBox = $('[data-ned-comps]');
  compsBox.innerHTML = COMPONENTS
    .map((c, i) => `<button type="button" data-comp="${i}">${I_PLUS}<span>${c.name}</span></button>`)
    .join('');
  compsBox.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => insertComponent(COMPONENTS[+b.dataset.comp]));
  });

  /* ---------------- ניהול שירותים בכל האתר ---------------- */

  const ICON_CHOICES = [
    ['i-tool', 'כלי עבודה'], ['i-dig', 'חפירה'], ['i-road', 'כביש'],
    ['i-radar', 'מכ"ם'], ['i-shield', 'מגן'], ['i-network', 'רשת'],
    ['i-water', 'מים'], ['i-target', 'מטרה'], ['i-award', 'פרס'],
    ['i-briefcase', 'תיק'], ['i-gem', 'יהלום'], ['i-headset', 'שירות']
  ];

  const svcBox = $('[data-ned-svc]');
  const svcStatus = $('[data-ned-svc-status]');
  let services = [];

  function svcSetStatus(msg, kind) {
    svcStatus.textContent = msg || '';
    svcStatus.className = 'ned-status' + (kind ? ' is-' + kind : '');
  }

  function renderServices() {
    svcBox.innerHTML = services.map((s, i) => `
      <div class="ned-svc" data-i="${i}">
        <div class="ned-svc-top">
          <input class="ned-input" data-f="name" value="${(s.name || '').replace(/"/g, '&quot;')}" placeholder="שם השירות" dir="rtl">
          <button class="ned-svc-del" title="הסרת השירות">${I_TRASH}</button>
        </div>
        <textarea class="ned-input" data-f="desc" rows="2" placeholder="תיאור קצר" dir="rtl">${s.desc || ''}</textarea>
        <div class="ned-svc-row">
          <select class="ned-input" data-f="icon">
            ${ICON_CHOICES.map(([v, l]) => `<option value="${v}"${v === s.icon ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          <input class="ned-input" data-f="href" value="${(s.href || '').replace(/"/g, '&quot;')}" placeholder="קישור" dir="ltr">
        </div>
      </div>`).join('');

    svcBox.querySelectorAll('.ned-svc').forEach(row => {
      const i = +row.dataset.i;
      row.querySelectorAll('[data-f]').forEach(inp => {
        inp.addEventListener('input', () => { services[i][inp.dataset.f] = inp.value; });
      });
      row.querySelector('.ned-svc-del').addEventListener('click', () => {
        if (!confirm(`להסיר את "${services[i].name}" מכל העמודים?`)) return;
        services.splice(i, 1);
        renderServices();
        svcSetStatus('הוסר מהרשימה - לחצו "החלה" כדי לכתוב לקבצים');
      });
    });
  }

  fetch('/__editor/services')
    .then(r => r.json())
    .then(d => { services = d.services || []; renderServices(); })
    .catch(() => svcSetStatus('לא ניתן לקרוא את רשימת השירותים', 'err'));

  $('[data-ned-svc-add]').addEventListener('click', () => {
    services.push({ name: 'שירות חדש', desc: 'תיאור קצר של השירות.', href: '#services', icon: 'i-tool' });
    renderServices();
    svcBox.lastElementChild.scrollIntoView({ block: 'nearest' });
    svcBox.lastElementChild.querySelector('[data-f="name"]').select();
  });

  $('[data-ned-svc-apply]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    svcSetStatus('כותב לכל העמודים…');
    fetch('/__editor/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ services })
    })
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.error || 'העדכון נכשל');
        svcSetStatus(`עודכנו ${res.count} שירותים ב-${res.files.length} עמודים - רעננו לראות`, 'ok');
      })
      .catch(err => svcSetStatus(err.message, 'err'))
      .finally(() => { btn.disabled = false; });
  });

  /* ---------------- מזעור והחלפת צד ----------------
     נועד למקרה שהפאנל מסתיר בדיוק את מה שרוצים לערוך. */
  $('[data-ned-min]').addEventListener('click', () => {
    panel.classList.add('is-min');
    setStatus('הפאנל ממוזער - לחצו על העיפרון כדי להחזיר');
  });

  $('[data-ned-side]').addEventListener('click', () => {
    panel.classList.toggle('on-left');
    kill.classList.toggle('shift-left', panel.classList.contains('on-left'));
  });

  /* ---------------- אינטראקציה בעמוד ---------------- */

  // סימון מועמד לעריכה בזמן ריחוף (למראה ה-outline)
  document.addEventListener('mouseover', (e) => {
    if (!editing) return;
    const el = e.target;
    if (isEditableTarget(el)) el.setAttribute('data-ned-editable', '');

    if (el.closest('#nedKill')) return;      // אל תסתיר בזמן מעבר לכפתור עצמו
    const target = removableFor(el);
    if (target) { if (target !== killTarget) { hideKill(); showKill(target); } }
    else hideKill();
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (!editing) return;
    if (e.target.nodeType === 1 && e.target !== activeEl) e.target.removeAttribute('data-ned-editable');
  }, true);

  document.addEventListener('click', (e) => {
    if (!editing) return;
    if (e.target.closest('#nedPanel, #nedToggle, #nedDialog, #nedBanner, #nedKill')) return;

    const link = e.target.closest('a');

    // Alt + לחיצה על קישור → עריכת היעד
    if (e.altKey && link) {
      e.preventDefault();
      e.stopPropagation();
      openDialog('link', link);
      return;
    }

    // חסימת ניווט/כפתורים בזמן עריכה
    if (link || e.target.closest('button')) {
      e.preventDefault();
      e.stopPropagation();
    }

    const img = e.target.closest('img');
    if (img) {
      e.preventDefault();
      e.stopPropagation();
      openDialog('image', img);
      return;
    }

    if (isEditableTarget(e.target)) {
      e.stopPropagation();
      beginEdit(e.target);
    }
  }, true);

  document.addEventListener('input', (e) => {
    if (editing && e.target === activeEl) {
      saveBtn.disabled = false;
      revertBtn.disabled = false;
    }
  }, true);

  /* ---------------- דיאלוג תמונה / קישור ---------------- */

  function openDialog(kind, el) {
    dialogTarget = el;
    dialog.dataset.kind = kind;
    const isImg = kind === 'image';
    dialog.querySelector('[data-ned-dtitle]').textContent = isImg ? 'החלפת תמונה' : 'עריכת קישור';
    dialog.querySelector('[data-ned-dsub]').textContent = isImg
      ? 'בחרו קובץ מהמחשב או הדביקו כתובת' : 'לאן הקישור יוביל';
    dialog.querySelector('[data-ned-dlabel]').textContent = isImg ? 'כתובת התמונה' : 'יעד הקישור (href)';
    dialog.querySelector('[data-ned-dpreview]').style.display = isImg ? '' : 'none';
    dialog.querySelector('[data-ned-dfile]').style.display = isImg ? '' : 'none';
    if (isImg) dialog.querySelector('[data-ned-dpreview]').src = el.getAttribute('src') || '';
    dialog.querySelector('[data-ned-dinput]').value =
      isImg ? (el.getAttribute('src') || '') : (el.getAttribute('href') || '');
    dialog.classList.add('is-open');
    setTimeout(() => dialog.querySelector('[data-ned-dinput]').focus(), 120);
  }

  function closeDialog() {
    dialog.classList.remove('is-open');
    dialogTarget = null;
  }

  dialog.querySelector('[data-ned-dcancel]').addEventListener('click', closeDialog);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closeDialog(); });

  dialog.querySelector('[data-ned-dok]').addEventListener('click', () => {
    if (!dialogTarget) return closeDialog();
    const val = dialog.querySelector('[data-ned-dinput]').value.trim();
    if (val) {
      if (dialog.dataset.kind === 'image') dialogTarget.setAttribute('src', val);
      else dialogTarget.setAttribute('href', val);
      markDirty(dialogTarget);
    }
    closeDialog();
  });

  dialog.querySelector('[data-ned-dupload]').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus('מעלה תמונה…');
    const reader = new FileReader();
    reader.onload = () => {
      fetch('/__editor/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, data: reader.result })
      })
        .then(r => r.json())
        .then(res => {
          if (!res.ok) throw new Error(res.error || 'העלאה נכשלה');
          dialog.querySelector('[data-ned-dinput]').value = res.src;
          dialog.querySelector('[data-ned-dpreview]').src = res.src;
          setStatus('התמונה הועלתה - לחצו אישור', 'ok');
        })
        .catch(err => setStatus(err.message, 'err'));
    };
    reader.readAsDataURL(file);
  });

  /* ---------------- ניקוי לפני שמירה ---------------- */

  function buildHTML() {
    const clone = document.documentElement.cloneNode(true);

    // מצב העריכה עצמו לא נשמר לקובץ
    clone.classList.remove('ned-editing', 'ned-deep');
    if (!clone.getAttribute('class')) clone.removeAttribute('class');

    // הסרת כל מה ששייך לעורך עצמו
    clone.querySelectorAll(
      '#nedToggle, #nedPanel, #nedBanner, #nedDialog, #nedKill,' +
      'link[href*="__editor"], script[src*="__editor"], meta[name="x-editor-file"]'
    ).forEach(n => n.remove());

    clone.querySelectorAll('.ned-kill-hover, .ned-just-added').forEach(n => n.classList.remove('ned-kill-hover','ned-just-added'));

    clone.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
    clone.querySelectorAll('.ned-dirty').forEach(n => n.classList.remove('ned-dirty'));
    clone.querySelectorAll('*').forEach(n => {
      [...n.attributes]
        .filter(a => a.name.startsWith('data-ned-'))
        .forEach(a => n.removeAttribute(a.name));
      if (n.hasAttribute('class') && !n.getAttribute('class').trim()) n.removeAttribute('class');
    });

    // החזרת מצבי-ריצה שנוצרו ע"י main.js למצב ההתחלתי שבקובץ
    clone.querySelectorAll('[data-reveal].is-visible').forEach(n => n.classList.remove('is-visible'));
    clone.querySelectorAll('.site-header').forEach(n => n.classList.remove('is-scrolled'));
    clone.querySelectorAll('.preloader').forEach(n => n.classList.remove('is-hidden'));
    clone.querySelectorAll('.mobile-menu, .lightbox, .project-modal').forEach(n => n.classList.remove('is-open'));
    clone.querySelectorAll('.back-to-top').forEach(n => n.classList.remove('is-visible'));
    clone.querySelectorAll('.side-nav a').forEach((n, i) => n.classList.toggle('active', i === 0));

    const cities = clone.querySelector('#citiesCloud');
    if (cities) cities.innerHTML = '';

    // סרגל ההתקדמות נשמר תמיד על 0 ולא על מיקום הגלילה הנוכחי
    const prog = clone.querySelector('#scrollProgress');
    if (prog) prog.setAttribute('style', 'width: 0%');

    // וידאו ההירו - מסירים את מה ש-main.js הוסיף בזמן ריצה,
    // אחרת ה-src נצרב לקובץ והטעינה העצלה מתבטלת לכל הגולשים
    const hv = clone.querySelector('#heroVideo');
    if (hv) {
      hv.removeAttribute('src');
      hv.classList.remove('is-playing');
      if (!hv.getAttribute('class')) hv.removeAttribute('class');
    }

    clone.querySelectorAll('[data-count]').forEach(n => { n.textContent = '0'; });

    ['#lightboxImg', '#modalImg'].forEach(sel => {
      const n = clone.querySelector(sel);
      if (n) { n.setAttribute('src', ''); n.setAttribute('alt', ''); }
    });
    ['#lightboxCaption', '#modalYear', '#modalTitle', '#modalDesc', '#modalSolution', '#formNote']
      .forEach(sel => { const n = clone.querySelector(sel); if (n) n.textContent = ''; });

    const note = clone.querySelector('#formNote');
    if (note) note.className = 'form-note';

    // סגנונות שנכתבו בזמן ריצה (פרלקסה, טילט, נעילת גלילה, השהיית reveal)
    clone.querySelectorAll('[style]').forEach(n => {
      const s = n.getAttribute('style');
      if (/transform|overflow|--d\s*:/.test(s)) {
        const kept = s.split(';')
          .map(x => x.trim())
          .filter(x => x && !/^(transform|overflow|transition)\b/.test(x) && !/^--d\s*:/.test(x))
          .join('; ');
        if (kept) n.setAttribute('style', kept); else n.removeAttribute('style');
      }
    });
    const body = clone.querySelector('body');
    if (body && !body.getAttribute('style')) body.removeAttribute('style');

    return '<!DOCTYPE html>\n' + clone.outerHTML + '\n';
  }

  /* ---------------- שמירה ---------------- */

  function save() {
    if (saveBtn.disabled) return;
    endEdit();
    setStatus('שומר…');
    saveBtn.disabled = true;

    fetch('/__editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: FILE, html: buildHTML() })
    })
      .then(r => r.json())
      .then(res => {
        if (!res.ok) throw new Error(res.error || 'השמירה נכשלה');
        dirty = 0;
        countEl.style.display = 'none';
        revertBtn.disabled = true;
        document.querySelectorAll('.ned-dirty').forEach(n => n.classList.remove('ned-dirty'));
        setStatus('נשמר בהצלחה ל־' + res.file, 'ok');
      })
      .catch(err => {
        saveBtn.disabled = false;
        setStatus(err.message, 'err');
      });
  }

  saveBtn.addEventListener('click', save);

  revertBtn.addEventListener('click', () => {
    if (dirty && !confirm('לבטל את כל השינויים שלא נשמרו?')) return;
    location.reload();
  });

  /* ---------------- פאנל ורשימת עמודים ---------------- */

  function openPanel() { panel.classList.add('is-open'); }
  function closePanel() { panel.classList.remove('is-open'); }

  toggle.addEventListener('click', () => {
    // ממוזער → החזרה; סגור → פתיחה; פתוח → הפעלה/כיבוי של מצב עריכה
    if (panel.classList.contains('is-min')) {
      panel.classList.remove('is-min');
      setStatus('');
      return;
    }
    if (!panel.classList.contains('is-open')) {
      openPanel();
      if (!editing) setEditing(true);
    } else {
      setEditing(!editing);
    }
  });

  $('[data-ned-close]').addEventListener('click', () => {
    closePanel();
    panel.classList.remove('is-min');
    setEditing(false);
  });
  switchEl.addEventListener('click', () => setEditing(!editing));

  fetch('/__editor-pages')
    .then(r => r.json())
    .then(({ pages }) => {
      const box = $('[data-ned-pages]');
      box.innerHTML = pages.map(p => {
        const current = p === FILE ? ' is-current' : '';
        const label = PAGE_LABELS[p] || p.replace('.html', '');
        return `<a class="${current.trim()}" href="/${p}"><span>${label}</span><small>${p}</small></a>`;
      }).join('');
      box.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', (e) => {
          if (dirty && !confirm('יש שינויים שלא נשמרו. לעבור לעמוד אחר ולאבד אותם?')) e.preventDefault();
        });
      });
    })
    .catch(() => {});

  /* ---------------- מקלדת ---------------- */

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
      return;
    }
    // ⌘Z לשחזור מחיקה - רק כשלא עורכים טקסט (שם זו פעולת ביטול רגילה)
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !activeEl && undoStack.length) {
      e.preventDefault();
      undoLast();
      return;
    }
    if (e.key === 'Escape') {
      if (dialog.classList.contains('is-open')) return closeDialog();
      if (activeEl) return endEdit();
      if (editing) setEditing(false);
    }
  });

  window.addEventListener('beforeunload', (e) => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  console.log('[עורך האתר] פעיל - קובץ:', FILE);
})();
