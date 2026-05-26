/* ─── Europa Clinic — ScrollCanvas Engine ─── */
'use strict';

/* ── Constants ──────────────────────────── */
const TOTAL_FRAMES = 900;
const PAGE_COUNT = 6;
const LERP = 0.08;
const CONCURRENCY = 48;

const isMobile = innerWidth < 768;
const FRAME_DIR = isMobile ? 'frames-mobile' : 'frames-webp';

/* ── DOM refs ───────────────────────────── */
const loader = document.getElementById('loader');
const loaderBar = document.getElementById('loaderBar');
const loaderPct = document.getElementById('loaderPct');
const loaderCap = document.getElementById('loaderCaption');
const progressFill = document.getElementById('progressFill');
const pages = Array.from(document.querySelectorAll('.page'));
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
const drawerLinks = Array.from(document.querySelectorAll('.nav-drawer-link'));
const canvas = document.getElementById('gl-canvas');
const ctx = canvas.getContext('2d');

/* ── State ──────────────────────────────── */
let targetFrame = 0;
let currentFrame = 0;
let isReady = false;
const frames = new Array(TOTAL_FRAMES);

/* ── Canvas sizing (HiDPI) ──────────────── */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawFrame(Math.round(currentFrame));
}
addEventListener('resize', resize);

/* ── Frame loader with concurrency ──────── */
function padNum(n) { return String(n).padStart(6, '0'); }

function loadFrame(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      if (img.decode) {
        img.decode().then(() => { frames[index] = img; resolve(); }).catch(() => { frames[index] = img; resolve(); });
      } else {
        frames[index] = img;
        resolve();
      }
    };
    img.onerror = () => resolve();
    img.src = `${FRAME_DIR}/frame_${padNum(index + 1)}.webp`;
  });
}

async function loadAllFrames() {
  let loaded = 0;
  const msgs = [
    'Preparing cinematic experience…',
    'Загружаем кадры клиники…',
    'Рендерим атмосферу…',
    'Собираем интерфейс…',
    'Almost ready…'
  ];

  const queue = Array.from({ length: TOTAL_FRAMES }, (_, i) => i);

  async function worker() {
    while (queue.length > 0) {
      const idx = queue.shift();
      if (idx === undefined) return;
      await loadFrame(idx);
      loaded++;
      const pct = Math.floor((loaded / TOTAL_FRAMES) * 100);
      loaderBar.style.width = pct + '%';
      loaderPct.textContent = pct;
      loaderCap.textContent = msgs[Math.min(msgs.length - 1, Math.floor(pct / 22))];
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
}

/* ── Draw a frame to canvas (cover fit) ── */
function drawFrame(idx) {
  idx = Math.max(0, Math.min(TOTAL_FRAMES - 1, idx));
  const img = frames[idx];
  if (!img) return;

  const cw = innerWidth, ch = innerHeight;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const scale = Math.max(cw / iw, ch / ih);
  const sw = iw * scale;
  const sh = ih * scale;
  const sx = (cw - sw) / 2;
  const sy = (ch - sh) / 2;

  ctx.clearRect(0, 0, cw, ch);
  ctx.drawImage(img, sx, sy, sw, sh);
}

/* ── Scroll input (window-level — iOS Safari safe) ── */
window.addEventListener('scroll', () => {
  if (!isReady) return;
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
  targetFrame = progress * (TOTAL_FRAMES - 1);
  clampFrame();
}, { passive: true });

function clampFrame() {
  targetFrame = Math.max(0, Math.min(targetFrame, TOTAL_FRAMES - 1));
}

function scrollToPage(i) {
  const p = pages[i];
  if (p) window.scrollTo({ top: p.offsetTop, behavior: 'smooth' });
}

document.querySelectorAll('[data-scroll]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    scrollToPage(parseInt(el.getAttribute('data-scroll'), 10));
    closeDrawer();
  });
});

// Brand → scroll to top
const navBrand = document.getElementById('navBrand');
if (navBrand) {
  navBrand.addEventListener('click', (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ── Drawer ─────────────────────────────── */
const navMenuBtn = document.getElementById('navMenuBtn');
const navScrim = document.getElementById('navScrim');
const navDrawer = document.getElementById('navDrawer');
const navDrawerClose = document.getElementById('navDrawerClose');
function openDrawer() { navDrawer.hidden = false; navScrim.hidden = false; }
function closeDrawer() { navDrawer.hidden = true; navScrim.hidden = true; }
navMenuBtn.addEventListener('click', openDrawer);
navScrim.addEventListener('click', closeDrawer);
navDrawerClose.addEventListener('click', closeDrawer);

/* ── UI update ──────────────────────────── */
let lastIdx = -1;
function updateUI() {
  const progress = currentFrame / (TOTAL_FRAMES - 1);
  progressFill.style.transform = `scaleX(${Math.min(1, progress)})`;
}

/* ── Navbar scroll effect ──────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  const sy = window.scrollY;
  if (sy > 80) {
    navbar.style.background = 'rgba(10, 10, 20, 0.95)';
    navbar.style.borderColor = 'rgba(201, 169, 110, 0.3)';
  } else {
    navbar.style.background = 'rgba(10, 10, 20, 0.8)';
    navbar.style.borderColor = 'rgba(201, 169, 110, 0.2)';
  }
}, { passive: true });

/* ── Section observer ──────────────────── */
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const idx = pages.indexOf(entry.target);
      if (idx !== -1) {
        pages.forEach((p, i) => p.classList.toggle('is-active', i === idx));
        // navLinks[0] = Услуги (section 1), etc. Hero (idx=0) clears all.
        navLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
        drawerLinks.forEach((l, i) => l.classList.toggle('active', i === idx - 1));
        if (idx !== lastIdx) { lastIdx = idx; runCounters(idx); }
      }
    }
  });
}, { root: null, rootMargin: '-40% 0px -40% 0px' });
pages.forEach(p => observer.observe(p));

/* ── Counters ───────────────────────────── */
function runCounters(pi) {
  if (pi !== 0 && pi !== 3) return;
  const section = pages[pi];
  section.querySelectorAll('.counter').forEach(el => {
    if (el.dataset.counted) return;
    el.dataset.counted = 'true';
    const tgt = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(tgt)) return;
    let cur = 0;
    const step = tgt / 60;
    const t = setInterval(() => {
      cur += step;
      if (cur >= tgt) { el.textContent = tgt.toLocaleString('ru-RU'); clearInterval(t); return; }
      el.textContent = Math.floor(cur).toLocaleString('ru-RU');
    }, 16);
  });
}

/* ── Render loop ────────────────────────── */
function animate() {
  requestAnimationFrame(animate);
  currentFrame += (targetFrame - currentFrame) * LERP;
  if (isReady) {
    updateUI();
    drawFrame(Math.round(currentFrame));
  }
}
animate();

/* ── Init ────────────────────────────────── */
(async function init() {
  resize();
  await loadAllFrames();
  onReady();
})();

function onReady() {
  isReady = true;
  drawFrame(0);
  setTimeout(() => { loader.classList.add('hidden'); initEffects(); }, 400);
  // Activate first page
  if (pages[0]) pages[0].classList.add('is-active');
}

/* ── Effects ─────────────────────────────── */
function initEffects() {
  // Card glow
  document.querySelectorAll('.service-card, .result-card, .promo-card').forEach(c => {
    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      c.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      c.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    });
  });

  // Scroll hint
  const hero = document.querySelector('.page[data-index="0"]');
  if (hero) {
    const h = document.createElement('div');
    h.className = 'scroll-hint';
    h.innerHTML = '<div class="scroll-hint-line"></div><span>scroll</span>';
    hero.appendChild(h);
  }

  // Char reveal on hero title
  const titleEl = document.querySelector('.gsap-title');
  if (titleEl) {
    const html = titleEl.innerHTML;
    const parts = html.split(/(<[^>]+>)/);
    let delay = 0;
    titleEl.innerHTML = parts.map(part => {
      if (part.startsWith('<')) return part;
      return part.split('').map(ch => {
        if (ch === ' ') return ' ';
        delay += 0.02;
        return `<span class="char" style="animation-delay:${delay.toFixed(2)}s">${ch}</span>`;
      }).join('');
    }).join('');
    titleEl.classList.add('char-reveal');
  }
}

/* ── Cursor Glow ──────────────────────── */
const cursorGlow = document.getElementById('cursorGlow');
if (cursorGlow && matchMedia('(hover:hover)').matches) {
  let cx = 0, cy = 0, gx = 0, gy = 0;
  addEventListener('mousemove', e => { cx = e.clientX; cy = e.clientY; });
  (function trackCursor() {
    gx += (cx - gx) * 0.08; gy += (cy - gy) * 0.08;
    cursorGlow.style.left = gx + 'px';
    cursorGlow.style.top = gy + 'px';
    requestAnimationFrame(trackCursor);
  })();
}

/* ── Form ─────────────────────────────────── */
window.handleSubmit = function() {
  const name = document.getElementById('formName').value.trim();
  const phone = document.getElementById('formPhone').value.trim();
  if (!name || !phone) { alert('Введите имя и Phone.'); return; }
  const btn = document.getElementById('submitBtn');
  const txt = document.getElementById('submitText');
  btn.disabled = true; txt.textContent = 'Sending…';
  setTimeout(() => {
    document.querySelector('.contact-form').innerHTML = `
      <div class="form-success" style="text-align:center;padding:40px 20px;">
        <div style="font-size:3rem;margin-bottom:16px;">✨</div>
        <div style="font-family:var(--font-heading);font-size:1.6rem;font-weight:700;color:var(--gold);margin-bottom:8px;">Заявка принята!</div>
        <div style="color:rgba(255,255,255,.7);font-size:.95rem;">Спасибо, ${name}! Мы свяжемся с вами в ближайшее время.</div>
      </div>`;
  }, 1200);
};

const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', (e) => { e.preventDefault(); handleSubmit(); });
}
