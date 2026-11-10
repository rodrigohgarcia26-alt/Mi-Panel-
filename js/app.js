/* ============================================================
   App: navegación, cabecera, tema y modo sin internet
   ============================================================ */
'use strict';

const App = (() => {
  const PANTALLAS = { hoy: PHoy, tareas: PTareas, habitos: PHabitos, dinero: PDinero, mas: PMas, ajustes: PAjustes };
  const cab = document.getElementById('cabecera');
  const main = document.getElementById('pantalla');
  const nav = document.getElementById('nav');
  const medioOscuro = window.matchMedia('(prefers-color-scheme: dark)');
  // Orden para deslizar entre apartados (Ajustes no entra).
  const ORDEN_DESLIZAR = ['hoy', 'tareas', 'habitos', 'dinero', 'mas'];
  let actual = null;
  let fechaPintada = U.hoy();
  let entrada = null;     // animación de entrada después de deslizar
  let deslizando = false;

  // ---------- Tema claro / oscuro ----------
  const temaEfectivo = () => Datos.tema() || (medioOscuro.matches ? 'oscuro' : 'claro');
  function aplicarTema() {
    const t = temaEfectivo();
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'oscuro' ? '#0E1514' : '#F1F4F3');
    const b = cab.querySelector('[data-accion="tema"]');
    if (b) {
      b.innerHTML = t === 'oscuro' ? U.I.sol : U.I.luna;
      b.setAttribute('aria-label', t === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
    }
  }
  function ponerTema(t) { Datos.ponerTema(t); aplicarTema(); }
  medioOscuro.addEventListener('change', () => { if (!Datos.tema()) { aplicarTema(); if (actual === 'ajustes') refrescar(); } });

  // ---------- Cabecera de cada pantalla ----------
  function pintarCabecera(nombre) {
    const p = PANTALLAS[nombre];
    let izq;
    if (nombre === 'hoy') {
      const h = U.hoy();
      izq = `<div class="cab-hoy">
          <h1 class="dia">${U.cap(U.nombreDia(h))} ${U.aFecha(h).getDate()}</h1>
          <p class="mes">${U.nombreMes(U.mesDe(h))}</p>
          <p class="pista-mover">mantén una tarjeta para moverla</p>
        </div>`;
    } else {
      izq = `<div class="cab-izq">
          <a class="atras" href="#hoy" aria-label="Regresar a Hoy">‹</a>
          <h1 class="cab-titulo">${p.titulo}</h1>
        </div>`;
    }
    cab.innerHTML = `${izq}
      <div class="cab-der">
        <button type="button" class="btn-icono" data-accion="tema"></button>
        ${nombre === 'ajustes' ? '' : `<a class="btn-icono" href="#ajustes" aria-label="Ajustes">${U.I.tuerca}</a>`}
      </div>`;
    aplicarTema();
  }
  cab.addEventListener('click', (e) => {
    if (e.target.closest('[data-accion="tema"]')) {
      ponerTema(temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro');
      if (actual === 'ajustes') refrescar();
    }
  });

  // ---------- Navegación por #secciones ----------
  function ir() {
    let nombre = location.hash.replace('#', '') || 'hoy';
    if (!PANTALLAS[nombre]) nombre = 'hoy';
    const cambio = actual !== null && actual !== nombre;
    actual = nombre;
    fechaPintada = U.hoy();
    document.title = nombre === 'hoy' ? 'Mi Panel' : `${PANTALLAS[nombre].titulo} · Mi Panel`;
    U.cerrarHoja();
    pintarCabecera(nombre);
    Gestos.fab(null); // cada pantalla que lo usa vuelve a mostrar el botón "+"
    const cont = document.createElement('div');
    main.replaceChildren(cont);
    PANTALLAS[nombre].render(cont);
    if (entrada) {
      const clase = entrada;
      entrada = null;
      main.classList.add(clase);
      setTimeout(() => main.classList.remove(clase), 200);
    }
    nav.querySelectorAll('a').forEach((a) => {
      if (a.dataset.seccion === nombre) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (cambio) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  }
  /** Vuelve a dibujar la pantalla actual (por ejemplo, después de importar datos). */
  function refrescar() {
    const y = window.scrollY;
    ir();
    window.scrollTo(0, y);
  }
  /** Aviso con botón "Deshacer" que regresa los datos a como estaban. */
  function conDeshacer(mensaje, fotoAntes) {
    U.aviso(mensaje, { accion: 'Deshacer', alAccion: () => { Datos.restaurar(fotoAntes); refrescar(); U.aviso('Listo, se deshizo.'); } });
  }

  // ---------- Deslizar el dedo: izquierda = siguiente apartado, derecha = anterior ----------
  Gestos.deslizar((dir) => {
    const i = ORDEN_DESLIZAR.indexOf(actual);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ORDEN_DESLIZAR.length || deslizando) return; // en los extremos no pasa nada
    deslizando = true;
    main.classList.add(dir > 0 ? 'sale-izq' : 'sale-der');
    setTimeout(() => {
      main.classList.remove('sale-izq', 'sale-der');
      entrada = dir > 0 ? 'entra-der' : 'entra-izq';
      deslizando = false;
      location.hash = ORDEN_DESLIZAR[j];
    }, 150);
  });

  // Si cambia el día, se actualiza sola (los "días que faltan" de las tareas, etc.):
  // al volver a la app, o cada minuto si sigue abierta (sin interrumpir si estás escribiendo).
  const escribiendo = () => document.body.classList.contains('hoja-abierta')
    || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fechaPintada !== U.hoy()) refrescar();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && fechaPintada !== U.hoy() && !escribiendo() && !Gestos.ocupado) refrescar();
  }, 60000);

  // ---------- Modo sin internet (service worker) ----------
  // La versión nueva se instala sola (skipWaiting + clients.claim en sw.js).
  // Cuando toma el control, la app se recarga una vez para usar los archivos nuevos.
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', async () => {
      try {
        const habiaControl = !!navigator.serviceWorker.controller;
        const reg = await navigator.serviceWorker.register('sw.js');
        if (reg.waiting) reg.waiting.postMessage('saltar'); // por si quedó una versión vieja esperando
        let recargando = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!habiaControl || recargando) return;
          recargando = true;
          // Si estás escribiendo algo, espera a que salgas de la app para no perderlo.
          const recargar = () => location.reload();
          const escribiendo = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && document.activeElement.value;
          if (!escribiendo) return recargar();
          document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') recargar(); }, { once: true });
        });
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
        });
      } catch (e) { /* sin service worker la app sigue funcionando con internet */ }
    });
  }

  // ---------- Arranque (se llama cuando App ya existe, para que las pantallas puedan usarla) ----------
  function iniciar() {
    Datos.cargar();
    aplicarTema();
    window.addEventListener('hashchange', ir);
    // Al perder o recuperar la conexión, Ajustes actualiza su estado.
    window.addEventListener('online', () => { if (actual === 'ajustes') refrescar(); });
    window.addEventListener('offline', () => { if (actual === 'ajustes') refrescar(); });
    ir();
    Datos.pedirPersistencia();
    registrarSW();
  }

  return { iniciar, refrescar, conDeshacer, ponerTema, temaEfectivo, ir: (n) => { location.hash = n; } };
})();

App.iniciar();
