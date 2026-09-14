/* Controprova. Movimento, modulo, e caricamento differito della scena 3D.
   Regole da DESIGN.md:
   - lo stato di partenza lo mette JS, mai il CSS: se JS non parte, tutto resta visibile
   - prefers-reduced-motion rispettato anche se viene attivato a pagina aperta
   - il 3D non e' mai l'LCP: parte dopo il primo paint e solo quando entra in vista
   Le librerie stanno in js/vendor, versioni fissate: niente dipendenze da CDN. */

/* i testi dell'interfaccia arrivano dalla pagina: una lingua per pagina, gia' scritta */
const TESTI = (() => {
  try { return JSON.parse(document.getElementById('testi-ui')?.textContent || '{}'); }
  catch { return {}; }
})();
const LINGUA = document.documentElement.lang || 'it';
const T = (k, ripiego = '') => TESTI[k] ?? ripiego;

const mqRidotto = matchMedia('(prefers-reduced-motion: reduce)');
const ridotto = () => mqRidotto.matches;

/* rete di sicurezza: se qualcosa non carica, dopo 2,5 s la pagina e' comunque intera */
const rete = setTimeout(scopriTutto, 2500);
function scopriTutto() {
  document.querySelectorAll('[data-anima]').forEach(el => {
    if (el.closest('.piega')) return;          // la piega la muove il CSS
    el.style.opacity = ''; el.style.transform = ''; el.style.willChange = '';
  });
}

function caricaScript(src) {
  return new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = ok; s.onerror = () => no(new Error(src));
    document.head.appendChild(s);
  });
}

/* ---------------------------------------------------------------- testata */
const testata = document.getElementById('testata');
const segnaScroll = () => testata?.setAttribute('data-scrollata', scrollY > 8 ? 'si' : 'no');
segnaScroll();
addEventListener('scroll', segnaScroll, { passive: true });

/* ---------------------------------------------------------------- movimento */
async function avviaMovimento() {
  if (ridotto()) { clearTimeout(rete); return; }

  try {
    await caricaScript('js/vendor/gsap.min.js');
    await caricaScript('js/vendor/ScrollTrigger.min.js');
  } catch {
    clearTimeout(rete); scopriTutto(); return;      // niente animazioni, pagina intatta
  }
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) { clearTimeout(rete); scopriTutto(); return; }
  gsap.registerPlugin(ScrollTrigger);
  clearTimeout(rete);

  const FUORI = 'power2.out';
  /* will-change solo mentre serve */
  const pesa = el => { el.style.willChange = 'transform, opacity'; };
  const leggero = el => { el.style.willChange = ''; };
  const fuoriPiega = s => gsap.utils.toArray(s).filter(el => !el.closest('.piega'));

  /* entrata generica: sale di poco, senza morbidezze */
  fuoriPiega('[data-anima="su"]').forEach(el => {
    gsap.set(el, { y: 14, opacity: 0 });
    gsap.to(el, {
      y: 0, opacity: 1, duration: 0.44, ease: FUORI,
      onStart: () => pesa(el), onComplete: () => leggero(el),
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  });

  /* le tavole: prima il riquadro, poi la scala di colore, poi l'immagine */
  fuoriPiega('[data-anima="tavola"]').forEach(tav => {
    const barra = tav.querySelector('[data-barra]');
    const img = tav.querySelector('img');
    const testa = tav.querySelector('.tavola-testa');
    gsap.set(tav, { opacity: 0, scaleY: 0.985, transformOrigin: 'top center' });
    if (barra) gsap.set(barra, { scaleX: 0 });
    gsap.set([img, testa].filter(Boolean), { opacity: 0 });
    const tl = gsap.timeline({ scrollTrigger: { trigger: tav, start: 'top 90%', once: true } });
    tl.to(tav, { opacity: 1, scaleY: 1, duration: 0.42, ease: FUORI })
      .to(testa, { opacity: 1, duration: 0.28 }, '-=0.18');
    if (barra) tl.to(barra, { scaleX: 1, duration: 0.46, ease: 'power2.inOut' }, '-=0.20');
    if (img) tl.to(img, { opacity: 1, duration: 0.5, ease: FUORI }, '-=0.24');
  });

  /* le colonne delle capacita' e gli scaglioni: uno dopo l'altro, da sinistra */
  ['[data-anima="colonna"]', '[data-anima="riga"]'].forEach(sel => {
    const gruppi = new Map();
    gsap.utils.toArray(sel).forEach(el => {
      const p = el.parentElement;
      if (!gruppi.has(p)) gruppi.set(p, []);
      gruppi.get(p).push(el);
    });
    gruppi.forEach((els, padre) => {
      gsap.set(els, { opacity: 0, y: 12 });
      gsap.to(els, {
        opacity: 1, y: 0, duration: 0.38, ease: FUORI, stagger: 0.05,
        scrollTrigger: { trigger: padre, start: 'top 88%', once: true },
      });
    });
  });

  /* i passi del metodo: il numero prima, poi il testo */
  gsap.utils.toArray('[data-anima="passo"]').forEach(el => {
    gsap.set(el, { opacity: 0, x: -12 });
    gsap.to(el, {
      opacity: 1, x: 0, duration: 0.42, ease: FUORI,
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
    });
  });

  /* le tabelle si compilano riga per riga */
  gsap.utils.toArray('[data-anima="tabella"]').forEach(tab => {
    const tr = tab.querySelectorAll('tbody tr');
    gsap.set(tr, { opacity: 0 });
    gsap.to(tr, {
      opacity: 1, duration: 0.26, stagger: 0.035, ease: 'none',
      scrollTrigger: { trigger: tab, start: 'top 86%', once: true },
    });
  });

  /* le viste secondarie entrano in fila */
  gsap.utils.toArray('.viste').forEach(v => {
    const f = v.querySelectorAll('.vista');
    gsap.set(f, { opacity: 0, y: 10 });
    gsap.to(f, {
      opacity: 1, y: 0, duration: 0.34, ease: FUORI, stagger: 0.045,
      scrollTrigger: { trigger: v, start: 'top 92%', once: true },
    });
  });

  /* profondita': il reticolo di costruzione deriva piu' lento della pagina */
  const reticolo = document.querySelector('.reticolo');
  if (reticolo) gsap.to(reticolo, {
    backgroundPositionY: '220px', ease: 'none',
    scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.8 },
  });
  fuoriPiega('.tavola img').forEach(img => gsap.to(img, {
    yPercent: -1.6, ease: 'none',
    scrollTrigger: { trigger: img.closest('.tavola'), start: 'top bottom', end: 'bottom top', scrub: 0.9 },
  }));

  /* scorrimento morbido, solo con mouse o trackpad */
  try {
    if (matchMedia('(pointer: fine)').matches) {
      await caricaScript('js/vendor/lenis.min.js');
      const lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, autoRaf: false });
      document.documentElement.style.scrollBehavior = 'auto';   // altrimenti litiga col CSS
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(t => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', ev => {
        const id = a.getAttribute('href');
        ev.preventDefault();
        if (id === '#') { lenis.scrollTo(0); return; }
        const t = document.querySelector(id);
        if (t) { lenis.scrollTo(t, { offset: -88 }); history.replaceState(null, '', id); }
      }));
      window.__lenis = lenis;
    }
  } catch { /* Lenis e' un lusso, non un requisito */ }
}

/* se il movimento ridotto viene acceso a pagina aperta, ci si ferma davvero */
mqRidotto.addEventListener('change', () => {
  if (!ridotto()) return;
  window.gsap?.globalTimeline.clear();
  window.ScrollTrigger?.getAll().forEach(t => t.kill());
  scopriTutto();
  window.__lenis?.destroy?.();
  document.documentElement.style.scrollBehavior = '';
  window.__smontaUgello?.();
});

/* ---------------------------------------------------------------- il momento 3D */
const scena = document.getElementById('ugello-scena');
const tela = document.getElementById('ugello-canvas');
const valore = document.getElementById('valore-scarto');
const bottoni = [...document.querySelectorAll('.modello')];

bottoni.forEach(b => b.addEventListener('click', () => {
  bottoni.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  valore.textContent = b.dataset.scarto + '%';
  window.__ugelloModello?.(b.dataset.modello);
}));

function osservaUgello() {
  if (!scena || !tela || ridotto() || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(async ([e]) => {
    if (!e.isIntersecting) { window.__fermaUgello?.(); return; }
    if (scena.dataset.viva === 'si') { window.__riprendiUgello?.(); return; }
    if (scena.dataset.viva === 'caricamento') return;
    scena.dataset.viva = 'caricamento';
    try {
      const mod = await import('./ugello.js');
      if (await mod.avvia(tela)) {
        scena.dataset.viva = 'si';
        tela.classList.add('viva');
      } else {
        scena.dataset.viva = 'no';           // resta il poster, e va benissimo cosi'
        io.disconnect();
      }
    } catch {
      scena.dataset.viva = 'no';
      io.disconnect();
    }
  }, { rootMargin: '250px 0px', threshold: 0.01 });
  io.observe(scena);
}

/* ---------------------------------------------------------------- modulo */
/* DOVE FINISCONO I MESSAGGI
   RACCOLTA vuota: il pulsante apre il programma di posta con il messaggio gia'
   scritto, e il file si allega a mano. Funziona dal primo giorno, senza server.
   RACCOLTA piena: invio con fetch a un servizio di raccolta moduli (Formspree,
   Basin, Netlify Forms), che inoltra alla casella. Va deciso prima di pubblicare,
   insieme all'indirizzo qui sotto. */
const RACCOLTA = '';
const EMAIL = '[[EMAIL]]';

const modulo = document.getElementById('modulo');
const esito = document.getElementById('esito');
const zona = document.getElementById('zona-file');
const campoFile = document.getElementById('file');
const fVuoto = document.getElementById('file-vuoto');
const fPieno = document.getElementById('file-pieno');
const MAX_MB = 200;

function mostraFile(f) {
  if (!f) { fVuoto.hidden = false; fPieno.hidden = true; fPieno.textContent = ''; return; }
  fVuoto.hidden = true; fPieno.hidden = false;
  fPieno.textContent = '';
  fPieno.append(f.name + ' ');
  const m = document.createElement('span');
  m.className = 'mono';
  m.textContent = (f.size / 1048576).toLocaleString(LINGUA, { maximumFractionDigits: 1 }) + ' MB';
  fPieno.append(m);
}

zona?.addEventListener('click', () => campoFile.click());
campoFile?.addEventListener('change', () => {
  const f = campoFile.files[0];
  const err = document.getElementById('err-file');
  err.textContent = '';
  if (f && f.size > MAX_MB * 1048576) {
    err.textContent = T('err_file_grande').replace('{mb}', MAX_MB);
    campoFile.value = ''; mostraFile(null); return;
  }
  mostraFile(f);
});
['dragenter', 'dragover'].forEach(ev => zona?.addEventListener(ev, e => {
  e.preventDefault(); zona.dataset.sopra = 'si';
}));
['dragleave', 'drop'].forEach(ev => zona?.addEventListener(ev, e => {
  e.preventDefault(); zona.dataset.sopra = 'no';
}));
zona?.addEventListener('drop', e => {
  const f = e.dataTransfer?.files?.[0];
  if (!f) return;
  const dt = new DataTransfer(); dt.items.add(f);
  campoFile.files = dt.files;
  campoFile.dispatchEvent(new Event('change'));
});

const emailValida = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/* Lenis tiene lui la posizione della pagina: uno scrollIntoView nativo viene
   annullato subito dopo. Ogni spostamento programmato passa di qui. */
function portaA(el) {
  if (!el) return;
  if (window.__lenis) { window.__lenis.scrollTo(el, { offset: -96 }); return; }
  el.scrollIntoView({ behavior: ridotto() ? 'auto' : 'smooth', block: 'center' });
}

function riquadro(titolo, testo) {
  const d = document.createElement('div');
  d.className = 'riquadro';
  if (titolo) { const h = document.createElement('h3'); h.textContent = titolo; d.append(h); }
  const p = document.createElement('p');
  p.append(testo);
  d.append(p);
  esito.textContent = '';
  esito.append(d);
}

modulo?.addEventListener('submit', async ev => {
  ev.preventDefault();
  const email = document.getElementById('email');
  const domanda = document.getElementById('domanda');
  const link = document.getElementById('link');
  const invia = document.getElementById('invia');
  const errEmail = document.getElementById('err-email');
  const errDom = document.getElementById('err-domanda');
  const errGen = document.getElementById('err-generale');
  errGen.textContent = ''; errEmail.textContent = ''; errDom.textContent = '';
  let primo = null;

  if (!emailValida(email.value)) {
    errEmail.textContent = T('err_email');
    email.setAttribute('aria-invalid', 'true'); primo = primo || email;
  } else email.removeAttribute('aria-invalid');

  if (domanda.value.trim().length < 12) {
    errDom.textContent = T('err_domanda');
    domanda.setAttribute('aria-invalid', 'true'); primo = primo || domanda;
  } else domanda.removeAttribute('aria-invalid');

  if (primo) { primo.focus(); return; }

  const f = campoFile.files[0];
  invia.disabled = true;
  esito.setAttribute('data-stato', 'invio');
  esito.textContent = '';
  const car = document.createElement('div');
  car.className = 'riquadro';
  const pc = document.createElement('p');
  const gir = document.createElement('span');
  gir.className = 'filatore'; gir.setAttribute('aria-hidden', 'true');
  pc.append(gir, T('invio'));
  car.append(pc); esito.append(car);

  if (!RACCOLTA) {
    /* nessun servizio collegato: apro la posta con tutto gia' scritto.
       E' onesto e funziona subito, ma il file va allegato a mano. */
    const corpo = [
      domanda.value.trim(), '',
      link.value.trim() ? T('mail_link') + ' ' + link.value.trim() : '',
      f ? T('mail_allego').replace('{file}', f.name) : '',
      '', T('mail_rispondi') + ' ' + email.value.trim(),
    ].filter(Boolean).join('\n');
    setTimeout(() => {
      location.href = 'mailto:' + EMAIL
        + '?subject=' + encodeURIComponent(T('mail_oggetto'))
        + '&body=' + encodeURIComponent(corpo);
      invia.disabled = false;
      esito.setAttribute('data-stato', 'posta');
      riquadro(T('posta_titolo'),
        (f ? T('posta_con_file').replace('{file}', f.name) : T('posta_senza_file'))
        + ' ' + T('posta_coda').replace('{email}', EMAIL));
      portaA(esito);
    }, 350);
    return;
  }

  try {
    const dati = new FormData();
    dati.append('email', email.value.trim());
    dati.append('domanda', domanda.value.trim());
    if (link.value.trim()) dati.append('link', link.value.trim());
    if (f) dati.append('file', f);
    const r = await fetch(RACCOLTA, { method: 'POST', body: dati, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    modulo.hidden = true;
    esito.setAttribute('data-stato', 'ok');
    riquadro(T('ok_titolo'), T('ok_testo'));
    portaA(esito);
  } catch {
    invia.disabled = false;
    esito.removeAttribute('data-stato');
    esito.textContent = '';
    errGen.textContent = T('err_generale').replace('{email}', EMAIL);
  }
});

/* ---------------------------------------------------------------- lingue */
const menuLingue = document.querySelector('.lingue');
if (menuLingue) {
  addEventListener('click', e => {
    if (menuLingue.open && !menuLingue.contains(e.target)) menuLingue.open = false;
  });
  menuLingue.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !menuLingue.open) return;
    menuLingue.open = false;
    menuLingue.querySelector('summary')?.focus();
  });
}

/* ---------------------------------------------------------------- avvio */
/* tutto dopo il primo paint: prima si dipinge la piega, poi si muove il resto */
function parti() { requestAnimationFrame(() => { avviaMovimento(); osservaUgello(); }); }
if (document.readyState === 'complete') parti();
else addEventListener('load', parti, { once: true });
