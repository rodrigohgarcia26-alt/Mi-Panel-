/* ============================================================
   Gestos: mover tarjetas, botón flotante "+" y deslizar entre apartados
   ============================================================ */
'use strict';

const Gestos = (() => {
  const vibrar = (ms) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* sin vibración */ } };
  const limitar = (v, min, max) => Math.max(min, Math.min(max, v));
  /** Parte de arriba de la barra inferior (en px desde arriba de la pantalla). */
  const arribaNav = () => document.getElementById('nav').getBoundingClientRect().top;
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
      const abajo = arribaNav();
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
  // Botón flotante "+": se mueve manteniéndolo presionado ~350 ms.
  // La posición se guarda en "mipanel-fab" como distancia a la orilla derecha (d)
  // y distancia arriba de la barra inferior (a); es la misma en todas las pantallas.
  // ============================================================
  const CLAVE_FAB = 'mipanel-fab';
  const TAM = 52, MARGEN = 8, ESPERA_FAB = 350;
  const fabEl = document.getElementById('fab');
  let fabAccion = null;
  let f = null;              // estado del toque sobre el botón
  let fabSuprimir = 0;       // después de moverlo, el toque no abre el cuadro

  function leerPos() {
    try {
      const p = JSON.parse(localStorage.getItem(CLAVE_FAB));
      if (p && Number.isFinite(p.d) && Number.isFinite(p.a)) return p;
    } catch (e) { /* dañado o bloqueado: posición de siempre */ }
    return { d: 16, a: 16 };
  }
  function guardarPos(p) { try { localStorage.setItem(CLAVE_FAB, JSON.stringify(p)); } catch (e) { /* bloqueado */ } }

  /** Coloca el botón dentro de la pantalla y arriba de la barra inferior. */
  function colocar(left, top) {
    const ancho = document.documentElement.clientWidth;
    left = limitar(left, MARGEN, ancho - TAM - MARGEN);
    top = limitar(top, MARGEN + 4, arribaNav() - TAM - MARGEN);
    fabEl.style.left = `${left}px`;
    fabEl.style.top = `${top}px`;
    fabEl.style.right = 'auto';
    fabEl.style.bottom = 'auto';
    return { left, top };
  }
  function aplicarPos() {
    if (fabEl.hidden) return;
    const p = leerPos();
    colocar(document.documentElement.clientWidth - TAM - p.d, arribaNav() - TAM - p.a);
  }

  fabEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const r = fabEl.getBoundingClientRect();
    f = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moviendo: false, cancelado: false };
    try { fabEl.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
    f.timer = setTimeout(() => {
      if (!f) return;
      f.moviendo = true;
      ocupado = true;
      fabEl.classList.add('moviendo');
      vibrar(15);
    }, ESPERA_FAB);
  });
  fabEl.addEventListener('pointermove', (e) => {
    if (!f || e.pointerId !== f.pid) return;
    if (!f.moviendo) {
      // Se movió antes de tiempo: no es un toque ni un arrastre.
      if (Math.hypot(e.clientX - f.x0, e.clientY - f.y0) > TOLERANCIA) { clearTimeout(f.timer); f.cancelado = true; }
      return;
    }
    e.preventDefault();
    colocar(e.clientX - f.dx, e.clientY - f.dy);
  });
  function fabSoltar(e) {
    if (!f || e.pointerId !== f.pid) return;
    clearTimeout(f.timer);
    if (f.moviendo) {
      fabEl.classList.remove('moviendo');
      // Se usa la posición fijada (no la medida), porque el botón aún se está encogiendo.
      const left = parseFloat(fabEl.style.left), top = parseFloat(fabEl.style.top);
      guardarPos({
        d: Math.round(document.documentElement.clientWidth - TAM - left),
        a: Math.round(arribaNav() - TAM - top),
      });
      ocupado = false;
    }
    if (f.moviendo || f.cancelado) fabSuprimir = Date.now();
    f = null;
  }
  fabEl.addEventListener('pointerup', fabSoltar);
  fabEl.addEventListener('pointercancel', fabSoltar);
  fabEl.addEventListener('contextmenu', (e) => e.preventDefault());
  fabEl.addEventListener('click', () => {
    if (Date.now() - fabSuprimir < 400) return;
    if (fabAccion) fabAccion();
  });
  window.addEventListener('resize', aplicarPos);

  /** Muestra el botón "+" con esa acción, o lo oculta si accion es null. */
  function fab(accion, etiqueta = 'Agregar') {
    fabAccion = accion;
    fabEl.hidden = !accion;
    document.body.classList.toggle('con-fab', !!accion);
    if (accion) { fabEl.setAttribute('aria-label', etiqueta); aplicarPos(); }
  }

  // ============================================================
  // Deslizar entre apartados: rápido (< 350 ms), horizontal (> 70 px y más que en vertical).
  // ============================================================
  const NO_DESLIZAR = 'input, textarea, select, [contenteditable], ul, ol, .grafica-desliza, .grafica-svg, .fab, .hoja-velo, .modal-velo';

  function deslizar(alDeslizar) {
    let t = null;
    document.addEventListener('touchstart', (e) => {
      t = null;
      if (e.touches.length !== 1 || ocupado || document.body.classList.contains('hoja-abierta')) return;
      if (e.target.closest && e.target.closest(NO_DESLIZAR)) return;
      const p = e.touches[0];
      t = { x: p.clientX, y: p.clientY, t: Date.now() };
    }, { passive: true });
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) t = null; }, { passive: true });
    document.addEventListener('touchcancel', () => { t = null; }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (!t) return;
      const p = e.changedTouches[0];
      const dx = p.clientX - t.x, dy = p.clientY - t.y, dt = Date.now() - t.t;
      t = null;
      if (ocupado || dt >= 350) return;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy)) alDeslizar(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  return { ordenable, fab, deslizar, get ocupado() { return ocupado; } };
})();
