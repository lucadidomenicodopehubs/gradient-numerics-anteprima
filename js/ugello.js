/* L'ugello del benchmark FDA, in sezione, ricostruito dalle quote pubblicate.
   Stewart et al., "Assessment of CFD performance in simulations of an idealized
   medical device", Cardiovasc Eng Technol 2012: tubo d 12 mm, collettore conico a
   10 gradi per lato, gola d 4 mm lunga 40 mm, espansione brusca, uscita d 12 mm.
   Qui i tratti dritti sono accorciati come nel disegno quotato accanto.

   Il colore sulla parete interna e' la velocita' media da continuita' (U propor-
   zionale a 1/r^2), aritmetica pura: non e' il risultato di un calcolo.

   Il modulo non parte mai da solo. Lo carica main.js dopo il primo paint e solo
   quando la scena entra nel viewport. Se WebGL manca, avvia() torna false e resta
   il poster. */

import * as THREE from './vendor/three.module.min.js';

/* --------------------------------------------------------------- geometria, mm */
const R_TUBO = 6, R_GOLA = 2, R_EST = 10;
const L_IN = 40, L_CONO = 22.69, L_GOLA = 40, L_OUT = 50;   // 22.69 = 4 / tan(10 gradi), il semiangolo
const LUNG = L_IN + L_CONO + L_GOLA + L_OUT;
const MEZZO = LUNG / 2;
const SCALA = 1 / 50;
const a = z => z - MEZZO;

/* stazioni lungo l'asse, dall'ingresso all'uscita */
const Z_CONO = L_IN, Z_GOLA = L_IN + L_CONO, Z_FINE_GOLA = Z_GOLA + L_GOLA;

/* raggio del condotto a una data ascissa: serve sia alla forma sia al colore */
function raggioCanale(z) {
  if (z <= Z_CONO) return R_TUBO;
  if (z <= Z_GOLA) return R_TUBO + (R_GOLA - R_TUBO) * (z - Z_CONO) / L_CONO;
  if (z <= Z_FINE_GOLA) return R_GOLA;
  return R_TUBO;
}

/* la parete: foro da monte a valle, poi il ritorno lungo il diametro esterno */
const PROFILO_PARETE = [
  [R_TUBO, a(0)], [R_TUBO, a(Z_CONO)], [R_GOLA, a(Z_GOLA)], [R_GOLA, a(Z_FINE_GOLA)],
  [R_TUBO, a(Z_FINE_GOLA)], [R_TUBO, a(LUNG)],
  [R_EST, a(LUNG)], [R_EST, a(0)], [R_TUBO, a(0)],
];

/* il volume di fluido: lo stesso foro, chiuso sull'asse alle due estremita' */
const EPS = 0.02, GIOCO = 0.06;
const cono = [];
for (let i = 1; i < 6; i++) {
  const z = Z_CONO + (L_CONO * i) / 6;
  cono.push([raggioCanale(z) - GIOCO, a(z)]);
}
const PROFILO_FLUIDO = [
  [EPS, a(0)], [R_TUBO - GIOCO, a(0)], [R_TUBO - GIOCO, a(Z_CONO)],
  ...cono,
  [R_GOLA - GIOCO, a(Z_GOLA)],
  [R_GOLA - GIOCO, a(Z_FINE_GOLA)], [R_TUBO - GIOCO, a(Z_FINE_GOLA)], [R_TUBO - GIOCO, a(LUNG)],
  [EPS, a(LUNG)], [EPS, a(0)],
];

/* viridis, la stessa scala delle figure */
const VIRIDIS = ['#440154', '#3B528B', '#21918C', '#5EC962', '#FDE725'].map(h => new THREE.Color(h));
function viridis(t) {
  const x = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  return VIRIDIS[i].clone().lerp(VIRIDIS[i + 1], x - i);
}
/* velocita' media da continuita', normalizzata fra tubo e gola. Aritmetica, non un calcolo. */
const MAXU = Math.pow(R_TUBO / R_GOLA, 2) - 1;
/* i punti sull'asse (raggio quasi nullo) appartengono ai tratti di tubo */
const coloreRaggio = r => viridis((Math.pow(R_TUBO / (r < 0.5 ? R_TUBO : r), 2) - 1) / MAXU);

const CARTA = new THREE.Color('#EDE6D7');   // superficie esterna dell'involucro
const TAGLIO = '#BCB09A';                   // materiale sezionato, come il tratteggio di un disegno

/* --------------------------------------------------------------- costruzione */
function rivoluzione(profilo, colora, giro = Math.PI) {
  const punti = profilo.map(([r, y]) => new THREE.Vector2(r, y));
  const SEG = giro > Math.PI ? 96 : 80;
  const g = new THREE.LatheGeometry(punti, SEG, 0, giro);
  if (colora) {
    const c = new Float32Array((SEG + 1) * punti.length * 3);
    let k = 0;
    for (let i = 0; i <= SEG; i++) {
      for (const p of punti) {
        const col = colora(p.x, p.y);
        c[k++] = col.r; c[k++] = col.g; c[k++] = col.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  }
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

function leFacceDi(profilo, materiale, colora) {
  const forma = new THREE.Shape();
  profilo.forEach(([r, y], i) => i ? forma.lineTo(r, y) : forma.moveTo(r, y));
  forma.closePath();
  const gruppo = new THREE.Group();
  for (const verso of [-1, 1]) {
    const g = new THREE.ShapeGeometry(forma);
    if (colora) {
      const pos = g.getAttribute('position');
      const c = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const col = colora(pos.getX(i), pos.getY(i));
        c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.rotateY(verso * Math.PI / 2);
    g.rotateZ(-Math.PI / 2);
    gruppo.add(new THREE.Mesh(g, materiale));
  }
  return gruppo;
}

/* --------------------------------------------------------------- stato del modulo */
let renderer, scena, camera, gruppo, anello, luceChiave;
let osservatore, ridimensiona;
let girando = false, distrutto = false;
let idFrame = 0, daDisegnare = true;

const vista = { theta: 0.46, phi: 0.82, raggio: 3.85 };
const spinta = { theta: 0, phi: 0 };
const scorrimento = { theta: 0, raggio: 0 };
let entrata = null, pulsazione = null;
let luceX = -3.0, luceY = 2.4, luceMira = -3.0;

export async function avvia(canvas) {
  if (distrutto) return false;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, alpha: true, powerPreference: 'high-performance',
    });
  } catch { return false; }
  if (!renderer || !renderer.getContext()) return false;

  const larg = canvas.clientWidth || 800;
  const alt = canvas.clientHeight || 450;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(larg, alt, false);

  scena = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, larg / alt, 0.2, 60);

  /* ---- involucro in sezione, tono carta, facce di taglio in prugna ---- */
  const involucro = new THREE.Mesh(
    rivoluzione(PROFILO_PARETE, () => CARTA),
    new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide,
    }),
  );
  const matTaglio = new THREE.MeshStandardMaterial({
    color: TAGLIO, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });
  const facceParete = leFacceDi(PROFILO_PARETE, matTaglio, null);

  /* ---- il volume di fluido, colorato per velocita' media ---- */
  const matFluido = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.34, metalness: 0.06, side: THREE.DoubleSide,
  });
  /* il fluido resta intero: e' il dominio di calcolo, non un pezzo da sezionare */
  const fluido = new THREE.Mesh(
    rivoluzione(PROFILO_FLUIDO, r => coloreRaggio(r), Math.PI * 2), matFluido);

  /* ---- asse tratto-punto, lo stesso tratteggio del disegno quotato ---- */
  const p = [];
  const passo = [18, 5, 3, 5];
  let x = -MEZZO - 16, t = 0;
  while (x < MEZZO + 16) {
    const l = passo[t % 4];
    if (t % 2 === 0) p.push(x, 0, 0, Math.min(x + l, MEZZO + 16), 0, 0);
    x += l; t++;
  }
  const asse = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(p, 3)),
    new THREE.LineBasicMaterial({ color: '#6C665C', transparent: true, opacity: 0.9 }),
  );

  /* ---- l'anello segna il piano dell'espansione brusca: e' li' che i modelli litigano ---- */
  anello = new THREE.Mesh(
    new THREE.TorusGeometry(12.4, 0.4, 8, 80),
    new THREE.MeshBasicMaterial({ color: '#D9BE2E', transparent: true, opacity: 0.95 }),
  );
  anello.rotation.y = Math.PI / 2;
  anello.position.x = a(Z_FINE_GOLA);

  gruppo = new THREE.Group();
  gruppo.add(involucro, facceParete, fluido, asse, anello);
  gruppo.scale.setScalar(SCALA);
  scena.add(gruppo);

  /* ---- luce radente da sinistra, come tutte le immagini della pagina ---- */
  luceChiave = new THREE.DirectionalLight('#FFF6E4', 2.0);
  luceChiave.position.set(luceX, luceY, 2.2);
  const riempimento = new THREE.DirectionalLight('#CBD9F2', 0.55);
  riempimento.position.set(2.6, -1.4, -1.8);
  scena.add(luceChiave, riempimento, new THREE.HemisphereLight('#FFFDF8', '#AFA695', 0.7));

  collegaComandi(canvas);

  /* entrata: la vista arriva da dietro e si posa. Ogni momento ha la sua. */
  entrata = { da: vista.theta - 0.95, t0: performance.now(), durata: 1150 };

  ridimensiona = new ResizeObserver(() => {
    if (!renderer) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    daDisegnare = true; accendi();
  });
  ridimensiona.observe(canvas);

  canvas.addEventListener('webglcontextlost', ev => { ev.preventDefault(); ferma(); }, false);
  document.addEventListener('visibilitychange', () => document.hidden ? ferma() : riprendi());

  window.__fermaUgello = ferma;
  window.__riprendiUgello = riprendi;
  window.__smontaUgello = smonta;
  window.__ugelloModello = () => {
    pulsazione = { t0: performance.now(), durata: 460 };
    accendi();
  };

  aggiornaCamera();
  renderer.render(scena, camera);      // un fotogramma subito, poi il ciclo
  accendi();
  return true;
}

/* --------------------------------------------------------------- interazione */
function collegaComandi(canvas) {
  let ultimo = null;

  canvas.addEventListener('pointerdown', e => {
    ultimo = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    /* la luce segue il puntatore anche senza trascinare: superficie viva */
    const b = canvas.getBoundingClientRect();
    luceMira = -3.0 + ((e.clientX - b.left) / b.width - 0.5) * 3.4;
    if (!ultimo) { accendi(); return; }
    const dx = e.clientX - ultimo.x, dy = e.clientY - ultimo.y;
    ultimo = { x: e.clientX, y: e.clientY };
    spinta.theta -= dx * 0.0052;
    spinta.phi -= dy * 0.0040;
    accendi();
  });
  const su = e => {
    ultimo = null;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  canvas.addEventListener('pointerup', su);
  canvas.addEventListener('pointercancel', su);
  canvas.addEventListener('pointerleave', () => { luceMira = -3.0; accendi(); });

  /* da tastiera: le frecce ruotano, e si vede perche' c'e' l'anello di fuoco */
  canvas.addEventListener('keydown', e => {
    const q = { ArrowLeft: [0.14, 0], ArrowRight: [-0.14, 0], ArrowUp: [0, 0.10], ArrowDown: [0, -0.10] }[e.key];
    if (!q) return;
    e.preventDefault();
    spinta.theta += q[0]; spinta.phi += q[1];
    accendi();
  });

  /* lo scorrimento della pagina sposta di poco il punto di vista */
  addEventListener('scroll', suScorrimento, { passive: true });
  suScorrimento();
}

function suScorrimento() {
  if (!renderer) return;
  const s = document.getElementById('ugello-scena');
  if (!s) return;
  const b = s.getBoundingClientRect();
  const h = innerHeight || 800;
  if (b.bottom < -200 || b.top > h + 200) return;
  const p = Math.min(1, Math.max(0, (h - b.top) / (h + b.height)));   // 0 sotto, 1 sopra
  scorrimento.theta = (p - 0.5) * 0.22;
  scorrimento.raggio = (0.5 - p) * 0.30;
  if (girando) daDisegnare = true; else accendi();
}

/* --------------------------------------------------------------- ciclo */
function aggiornaCamera() {
  const th = vista.theta + spinta.theta + scorrimento.theta;
  const ph = Math.min(1.62, Math.max(0.24, vista.phi + spinta.phi));
  const r = vista.raggio + scorrimento.raggio;
  camera.position.set(
    r * Math.sin(ph) * Math.sin(th),
    r * Math.cos(ph),
    r * Math.sin(ph) * Math.cos(th),
  );
  camera.lookAt(0, 0, 0);
}

function passo() {
  idFrame = 0;
  if (!renderer || !girando) return;
  const ora = performance.now();
  let vivo = false;

  if (entrata) {
    const k = Math.min(1, (ora - entrata.t0) / entrata.durata);
    const e = 1 - Math.pow(1 - k, 4);
    spinta.theta = (entrata.da - vista.theta) * (1 - e);
    if (k >= 1) entrata = null; else vivo = true;
  }

  if (pulsazione) {
    const k = Math.min(1, (ora - pulsazione.t0) / pulsazione.durata);
    const onda = Math.sin(k * Math.PI);
    anello.scale.setScalar(1 + onda * 0.26);
    anello.material.opacity = 0.95 - onda * 0.45;
    if (k >= 1) { pulsazione = null; anello.scale.setScalar(1); anello.material.opacity = 0.95; }
    else vivo = true;
  }

  const dLuce = luceMira - luceX;
  if (Math.abs(dLuce) > 0.004) {
    /* sotto una certa distanza si arriva in un colpo: una coda asintotica
       terrebbe sveglio il ciclo per decine di fotogrammi senza che si veda */
    luceX = Math.abs(dLuce) < 0.05 ? luceMira : luceX + dLuce * 0.16;
    luceChiave.position.x = luceX;
    vivo = true;
  }

  aggiornaCamera();
  renderer.render(scena, camera);
  daDisegnare = false;

  if (vivo || daDisegnare) idFrame = requestAnimationFrame(passo);
  else girando = false;         // fermo, zero CPU, finche' non succede altro
}

function accendi() {
  if (!renderer || document.hidden) return;
  daDisegnare = true;
  if (!girando) { girando = true; idFrame = requestAnimationFrame(passo); }
}

function ferma() {
  girando = false;
  if (idFrame) cancelAnimationFrame(idFrame);
  idFrame = 0;
}

function riprendi() {
  if (!renderer || distrutto || document.hidden) return;
  accendi();
}

/* usato solo se il visitatore chiede meno movimento a pagina aperta */
function smonta() {
  distrutto = true;
  ferma();
  ridimensiona?.disconnect();
  osservatore?.disconnect();
  removeEventListener('scroll', suScorrimento);
  scena?.traverse(o => {
    o.geometry?.dispose?.();
    if (Array.isArray(o.material)) o.material.forEach(m => m.dispose()); else o.material?.dispose?.();
  });
  renderer?.dispose();
  renderer = null;
  const s = document.getElementById('ugello-scena');
  const c = document.getElementById('ugello-canvas');
  s?.setAttribute('data-viva', 'no');
  c?.classList.remove('viva');
}
