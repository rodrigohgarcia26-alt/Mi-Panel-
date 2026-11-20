/* ============================================================
   Gestos: mover tarjetas, botón flotante "+" y deslizar entre apartados
   ============================================================ */
'use strict';

const Gestos = (() => {
  const vibrar = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };
  const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
  // true mientras hay una tarjeta levantada o el botón "+" se está moviendo (así no se cambia de apartado).
  let ocupado = false;

  // ============================================================
  // Mover tarjetas: mantener presionado ~450 ms y soltar sobre otra para intercambiarlas.
  // Las tarjetas son los hijos directos del contenedor que tienen data-tarjeta="...".
  // El orden se guarda con Datos.ponerOrden(orden, pantalla).
  // ============================================================
  const ESPERA_LEVANTAR = 450;
  const TOLERANCIA = 10; // px que se puede mover el dedo antes de que cuente como scroll

  function ordenable(cont, { pantalla, listas = true }) {
    // Donde NO se puede empezar a mover (en las pantallas nuevas también listas y la gráfica de meses).
    const excluir = 'input, textarea, select, button, a, label, form' + (listas ? ', ul, ol, .grafica-desliza, .grafica-svg' : '');
    cont.classList.add('ordenable');
    let s = null;          // estado del arrastre actual
    let ultimoSoltar = 0;  // para que soltar no cuente como "toque"

    const tarjetas = () => [...cont.children].filter((c) => c.dataset && c.dataset.tarjeta);

    cont.addEventListener('pointerdown', (e) => {
      if (s || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = e.target.closest('[data-tarjeta]');
      if (!el || el.parentElement !== cont) return;
      const ex = e.target.closest(excluir);
      if (ex && el.contains(ex)) return;
      s = { el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, scroll0: window.scrollY, levantada: false, destino: null };
      s.timer = setTimeout(levantar, ESPERA_LEVANTAR);
    });

    function levantar() {
      if (!s) return;
      s.levantada = true;
      ocupado = true;
      s.el.classList.add('levantada');
      cont.classList.add('arrastrando');
      try { s.el.setPointerCapture(s.pid); } catch (e) { /* el puntero ya se soltó */ }
      vibrar(25);
      mover();
      autoScroll();
    }

    cont.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.pid) return;
      if (!s.levantada) {
        // Si el dedo se mueve antes de tiempo, es un scroll normal: se cancela.
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > TOLERANCIA) cancelar();
        return;
      }
      e.preventDefault();
      s.x = e.clientX; s.y = e.clientY;
      mover();
    });

    function mover() {
      const dx = s.x - s.x0;
      const dy = s.y - s.y0 + (window.scrollY - s.scroll0);
      s.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      // ¿Sobre qué tarjeta está el dedo?
      let destino = null;
      for (const c of tarjetas()) {
        if (c === s.el) continue;
        const r = c.getBoundingClientRect();
        if (s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom) { destino = c; break; }
      }
      if (destino !== s.destino) {
        if (s.destino) s.destino.classList.remove('destino');
        if (destino) destino.classList.add('destino');
        s.destino = destino;
      }
    }

    // Si el dedo llega a la orilla de arriba o de abajo, la pantalla se desplaza sola.
    function autoScroll() {
      if (!s || !s.levantada) return;
      const borde = 80;
      const abajo = window.innerHeight;
      let v = 0;
      if (s.y < borde) v = -Math.ceil((borde - s.y) / 8);
      else if (s.y > abajo - borde) v = Math.ceil((s.y - (abajo - borde)) / 8);
      if (v) { window.scrollBy(0, v); mover(); }
      s.raf = requestAnimationFrame(autoScroll);
    }

    function soltar() {
      const { el, destino } = s;
      cancelAnimationFrame(s.raf);
      cont.classList.remove('arrastrando');
      el.classList.remove('levantada');
      el.style.transform = '';
      if (destino) {
        destino.classList.remove('destino');
        const orden = Datos.orden(pantalla);
        const a = orden.indexOf(el.dataset.tarjeta), b = orden.indexOf(destino.dataset.tarjeta);
        if (a >= 0 && b >= 0) {
          [orden[a], orden[b]] = [orden[b], orden[a]];
          Datos.ponerOrden(orden, pantalla);
        }
        // Intercambia los elementos en la página sin volver a dibujar todo.
        const marca = document.createComment('');
        cont.replaceChild(marca, el);
        cont.replaceChild(el, destino);
        cont.replaceChild(destino, marca);
        [el, destino].forEach((c) => { c.classList.add('recien'); setTimeout(() => c.classList.remove('recien'), 300); });
      }
      ultimoSoltar = Date.now();
      ocupado = false;
      s = null;
    }
    function cancelar() {
      if (!s) return;
      clearTimeout(s.timer);
      if (s.levantada) return soltar();
      s = null;
    }
    cont.addEventListener('pointerup', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    cont.addEventListener('pointercancel', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    cont.addEventListener('lostpointercapture', (e) => { if (s && s.levantada && e.pointerId === s.pid && e.target === s.el) cancelar(); });

    // Justo después de soltar, el toque no abre nada (ni pantallas ni desplegables).
    cont.addEventListener('click', (e) => {
      if (Date.now() - ultimoSoltar < 450) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    // Evitar el scroll de la página mientras se arrastra (necesita passive:false).
    cont.addEventListener('touchmove', (e) => { if (s && s.levantada) e.preventDefault(); }, { passive: false });
    // Evitar el menú contextual del celular al mantener presionado.
    cont.addEventListener('contextmenu', (e) => {
      if ((s && s.levantada) || (e.target.closest('[data-tarjeta]') && !e.target.closest('input, textarea'))) e.preventDefault();
    });
    cont.addEventListener('dragstart', (e) => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  }

  // ============================================================
  // Botón flotante "+" (en todas las pantallas).
  //  · Toque rápido: la acción de la pantalla (en Ajustes, el menú).
  //  · Arrastrar enseguida (> 10 px antes de 380 ms): mueve el botón.
  //  · Mantener 380 ms sin moverse: abre el menú radial de apartados.
  // La posición se guarda en "mipanel-fab" como distancia a la orilla derecha (d)
  // y a la orilla de abajo (a); es la misma en todas las pantallas.
  // ============================================================
  const CLAVE_FAB = 'mipanel-fab';
  const TAM = 52, ESPERA_FAB = 380, MOVER_PX = 10, SUPRIMIR_MS = 300;
  const fabEl = document.getElementById('fab');
  const ICONO_MAS = fabEl.innerHTML;
  let fabAccion = null;
  let fabEtiqueta = 'Agregar';
  let f = null;              // estado del toque sobre el botón
  let fabSuprimir = 0;       // después de arrastrar o abrir el menú, se ignora el clic al soltar

  function leerPos() {
    try {
      const p = JSON.parse(localStorage.getItem(CLAVE_FAB));
      if (p && Number.isFinite(p.d) && Number.isFinite(p.a)) return p;
    } catch (e) { /* dañado o bloqueado: posición de siempre */ }
    return { d: 16, a: 16 }; // abajo a la derecha
  }
  function guardarPos(p) { try { localStorage.setItem(CLAVE_FAB, JSON.stringify(p)); } catch (e) { /* bloqueado */ } }

  /** Coloca el botón dentro de los límites: x entre 8 y ancho − 60; y entre 72 y alto − 68. */
  function colocar(left, top) {
    left = limitar(left, 8, window.innerWidth - 60);
    top = limitar(top, 72, window.innerHeight - 68);
    fabEl.style.left = `${left}px`;
    fabEl.style.top = `${top}px`;
    fabEl.style.right = 'auto';
    fabEl.style.bottom = 'auto';
    return { left, top };
  }
  function aplicarPos() {
    if (menu) return;
    const p = leerPos();
    colocar(window.innerWidth - TAM - p.d, window.innerHeight - TAM - p.a);
  }

  fabEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (menu) return; // con el menú abierto, el botón es la X: un toque normal lo cierra
    const r = fabEl.getBoundingClientRect();
    f = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, modo: 'espera' };
    try { fabEl.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    f.timer = setTimeout(() => {
      if (!f || f.modo !== 'espera') return;
      f.modo = 'menu';
      vibrar(12);
      abrirMenu(true);
    }, ESPERA_FAB);
  });
  fabEl.addEventListener('pointermove', (e) => {
    if (!f || e.pointerId !== f.pid) return;
    if (f.modo === 'espera') {
      if (Math.hypot(e.clientX - f.x0, e.clientY - f.y0) <= MOVER_PX) return;
      clearTimeout(f.timer);
      f.modo = 'arrastre';
      ocupado = true;
      fabEl.classList.add('moviendo');
      vibrar(10);
    }
    if (f.modo === 'arrastre') { e.preventDefault(); colocar(e.clientX - f.dx, e.clientY - f.dy); }
    else if (f.modo === 'menu') resaltar(e.clientX, e.clientY);
  });
  function fabSoltar(e) {
    if (!f || e.pointerId !== f.pid) return;
    clearTimeout(f.timer);
    if (f.modo === 'arrastre') {
      fabEl.classList.remove('moviendo');
      // Se usa la posición fijada (no la medida), porque el botón aún se está encogiendo.
      const left = parseFloat(fabEl.style.left), top = parseFloat(fabEl.style.top);
      guardarPos({ d: Math.round(window.innerWidth - TAM - left), a: Math.round(window.innerHeight - TAM - top) });
      ocupado = false;
      fabSuprimir = Date.now();
    } else if (f.modo === 'menu') {
      fabSuprimir = Date.now();
      // Soltar encima de un botón del menú: ir a ese apartado. Si no, el menú se queda abierto.
      const it = e.type === 'pointerup' && menu && menu.resaltado;
      if (it) irA(it.dataset.seccion);
    }
    f = null;
  }
  fabEl.addEventListener('pointerup', fabSoltar);
  fabEl.addEventListener('pointercancel', fabSoltar);
  fabEl.addEventListener('contextmenu', (e) => e.preventDefault());
  fabEl.addEventListener('click', () => {
    if (Date.now() - fabSuprimir < SUPRIMIR_MS) return;
    if (menu) return cerrarMenu();
    if (fabAccion) fabAccion(); else abrirMenu(false);
  });
  // Con teclado: flecha arriba o la tecla de menú abren el menú de apartados.
  fabEl.addEventListener('keydown', (e) => {
    if (!menu && (e.key === 'ArrowUp' || e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10'))) { e.preventDefault(); abrirMenu(false); }
  });
  window.addEventListener('resize', () => { if (menu) cerrarMenu(); aplicarPos(); });

  /** Acción del toque rápido en esta pantalla (null = abre el menú, como en Ajustes). */
  function fab(accion, etiqueta = 'Agregar') {
    if (menu) cerrarMenu();
    fabAccion = accion;
    fabEtiqueta = accion ? etiqueta : 'Abrir menú de apartados';
    fabEl.hidden = false;
    fabEl.setAttribute('aria-label', fabEtiqueta);
    document.body.classList.add('con-fab');
    aplicarPos();
  }

  // ============================================================
  // Menú radial: 5 botones en arco alrededor del "+".
  // ============================================================
  const svg = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c}</svg>`;
  const APARTADOS = [
    { id: 'hoy', nombre: 'Hoy', icono: svg('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>') },
    { id: 'tareas', nombre: 'Tareas', icono: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.3"/>') },
    { id: 'habitos', nombre: 'Hábitos', icono: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M14.5 17l2 2 3.5-3.8"/>') },
    { id: 'dinero', nombre: 'Dinero', icono: svg('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>') },
    { id: 'mas', nombre: 'Más', icono: svg('<circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/>') },
  ];
  const CONFIGS = [[180, 104], [140, 120], [110, 140], [90, 150]]; // [arco en grados, radio en px]
  const BTN = 54, RADIO_TOQUE = 34;
  const ICONO_X = svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>');
  let menu = null;

  /** Posiciones de los 5 botones: la primera configuración en la que todos caben completos. */
  function posicionesArco(cx, cy) {
    const W = window.innerWidth, H = window.innerHeight;
    const rad = (g) => (g * Math.PI) / 180;
    const haciaCentro = (Math.atan2(H / 2 - cy, W / 2 - cx) * 180) / Math.PI;
    const puntos = (centro, span, r) => Array.from({ length: 5 }, (_, i) => {
      const ang = centro - span / 2 + (span * i) / 4;
      return { x: cx + r * Math.cos(rad(ang)), y: cy + r * Math.sin(rad(ang)) };
    });
    const cabe = (p) => p.x >= 34 && p.x <= W - 34 && p.y >= 78 && p.y <= H - 34;
    for (const [span, r] of CONFIGS) {
      for (let paso = 0; paso <= 180; paso += 5) {
        for (const signo of paso ? [1, -1] : [1]) {
          const ps = puntos(haciaCentro + signo * paso, span, r);
          if (ps.every(cabe)) return ps;
        }
      }
    }
    const [span, r] = CONFIGS[CONFIGS.length - 1];
    return puntos(haciaCentro, span, r).map((p) => ({ x: limitar(p.x, 34, W - 34), y: limitar(p.y, 78, H - 34) }));
  }

  function abrirMenu(conDedo) {
    if (menu) return;
    const r = fabEl.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const actual = (location.hash.replace('#', '') || 'hoy');
    const ps = posicionesArco(cx, cy);
    const raiz = document.createElement('div');
    raiz.id = 'mp-radial';
    raiz.className = 'radial-velo';
    raiz.innerHTML = `<nav class="radial" role="menu" aria-label="Apartados">${APARTADOS.map((a, i) => `
      <a href="#${a.id}" class="radial-btn ${a.id === actual ? 'actual' : ''}" role="menuitem" data-seccion="${a.id}"
        ${a.id === actual ? 'aria-current="page"' : ''}
        style="left:${Math.round(ps[i].x - BTN / 2)}px;top:${Math.round(ps[i].y - BTN / 2)}px;--dx:${Math.round(cx - ps[i].x)}px;--dy:${Math.round(cy - ps[i].y)}px;animation-delay:${i * 28}ms">
        ${a.icono}<span>${a.nombre}</span></a>`).join('')}</nav>`;
    document.body.appendChild(raiz);
    document.body.classList.add('menu-abierto');
    fabEl.innerHTML = ICONO_X;
    fabEl.setAttribute('aria-label', 'Cerrar menú');
    fabEl.setAttribute('aria-expanded', 'true');
    menu = { raiz, items: [...raiz.querySelectorAll('.radial-btn')], resaltado: null };
    // Tocar el fondo oscuro cierra el menú; tocar un botón va a su apartado.
    raiz.addEventListener('click', (e) => {
      const it = e.target.closest('.radial-btn');
      if (it) { e.preventDefault(); irA(it.dataset.seccion); }
      else if (e.target === raiz) cerrarMenu();
    });
    menu.teclas = (e) => {
      if (e.key === 'Escape') { cerrarMenu(); fabEl.focus(); return; }
      const i = menu.items.indexOf(document.activeElement);
      if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
        menu.items[(i + d + menu.items.length) % menu.items.length].focus();
      }
    };
    document.addEventListener('keydown', menu.teclas);
    if (!conDedo) (menu.items.find((x) => x.classList.contains('actual')) || menu.items[0]).focus();
  }

  /** Resalta el botón que esté a menos de 34 px del dedo. */
  function resaltar(x, y) {
    if (!menu) return;
    let cerca = null;
    // Se usa la posición final de cada botón (no la medida), por si aún está animándose.
    for (const it of menu.items) {
      const cx = parseFloat(it.style.left) + BTN / 2, cy = parseFloat(it.style.top) + BTN / 2;
      if (Math.hypot(x - cx, y - cy) < RADIO_TOQUE) { cerca = it; break; }
    }
    if (cerca === menu.resaltado) return;
    if (menu.resaltado) menu.resaltado.classList.remove('resaltado');
    if (cerca) { cerca.classList.add('resaltado'); vibrar(8); }
    menu.resaltado = cerca;
  }

  function cerrarMenu() {
    if (!menu) return;
    document.removeEventListener('keydown', menu.teclas);
    menu.raiz.remove();
    menu = null;
    document.body.classList.remove('menu-abierto');
    fabEl.innerHTML = ICONO_MAS;
    fabEl.removeAttribute('aria-expanded');
    fabEl.setAttribute('aria-label', fabEtiqueta);
  }
  function irA(seccion) {
    cerrarMenu();
    if (location.hash.replace('#', '') !== seccion) location.hash = seccion;
  }

  // ============================================================
  // Deslizar entre apartados. Se decide al soltar el dedo:
  //  · más de 40 px en horizontal y horizontal > vertical × 1.2
  //  · todo el gesto dura menos de 1000 ms
  //  · el dedo empezó a moverse (más de 8 px) antes de 420 ms; si no, es una
  //    pulsación larga para mover una tarjeta y no cambia de pantalla.
  // Funciona en toda la pantalla (también sobre las tarjetas y sus listas).
  // ============================================================
  const NO_DESLIZAR = 'input, textarea, select, [contenteditable], .fab, .grafica-desliza, .hoja-velo, .modal-velo, #mp-cal, #mp-radial';
  const DESLIZAR_MIN_PX = 40;
  const DESLIZAR_PROPORCION = 1.2;
  const DESLIZAR_MAX_MS = 1000;
  const DESLIZAR_INICIO_PX = 8;
  const DESLIZAR_INICIO_MS = 420;

  function deslizar(alDeslizar) {
    let t = null;
    document.addEventListener('touchstart', (e) => {
      t = null;
      if (e.touches.length !== 1 || ocupado || document.body.classList.contains('hoja-abierta') || document.getElementById('mp-cal') || menu) return;
      if (e.target.closest && e.target.closest(NO_DESLIZAR)) return;
      const p = e.touches[0];
      t = { x: p.clientX, y: p.clientY, t: Date.now(), movio: false };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (!t) return;
      if (e.touches.length > 1 || ocupado) { t = null; return; } // dos dedos o una tarjeta levantada
      if (t.movio) return;
      const p = e.touches[0];
      if (Math.hypot(p.clientX - t.x, p.clientY - t.y) > DESLIZAR_INICIO_PX) {
        // Si tardó en empezar a moverse, era una pulsación larga: no cuenta como deslizar.
        if (Date.now() - t.t >= DESLIZAR_INICIO_MS) { t = null; return; }
        t.movio = true;
      }
    }, { passive: true });
    document.addEventListener('touchcancel', () => { t = null; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!t) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - t.x, dy = p.clientY - t.y, dt = Date.now() - t.t;
      const movio = t.movio;
      t = null;
      if (ocupado || !movio || dt >= DESLIZAR_MAX_MS) return;
      if (Math.abs(dx) > DESLIZAR_MIN_PX && Math.abs(dx) > Math.abs(dy) * DESLIZAR_PROPORCION) alDeslizar(dx < 0 ? 1 : -1);
    }, { passive: true });
    // Que el navegador no "arrastre" los enlaces (eso cancelaba el gesto con pointercancel).
    document.addEventListener('dragstart', (e) => {
      if (e.target && e.target.closest && e.target.closest('a')) e.preventDefault();
    });
  }

  return { ordenable, fab, cerrarMenu, deslizar, get ocupado() { return ocupado; } };
})();
