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
  let actual = null;
  let fechaPintada = U.hoy();

  // ---------- Tema claro / oscuro ----------
  const temaEfectivo = () => Datos.d.tema || (medioOscuro.matches ? 'oscuro' : 'claro');
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
  function ponerTema(t) { Datos.d.tema = t; Datos.guardar(); aplicarTema(); }
  medioOscuro.addEventListener('change', () => { if (!Datos.d.tema) { aplicarTema(); if (actual === 'ajustes') refrescar(); } });

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
    pintarCabecera(nombre);
    const cont = document.createElement('div');
    main.replaceChildren(cont);
    PANTALLAS[nombre].render(cont);
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

  // Si la app se queda abierta y cambia el día, se actualiza al volver a ella.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fechaPintada !== U.hoy()) refrescar();
  });

  // ---------- Modo sin internet (service worker) ----------
  function registrarSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', async () => {
      try {
        const habiaControl = !!navigator.serviceWorker.controller;
        const reg = await navigator.serviceWorker.register('sw.js');
        const avisarNueva = (sw) => U.aviso('Hay una versión nueva de la app.', {
          accion: 'Actualizar', duracion: 20000, alAccion: () => sw.postMessage('saltar'),
        });
        if (reg.waiting && navigator.serviceWorker.controller) avisarNueva(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nuevo = reg.installing;
          if (!nuevo) return;
          nuevo.addEventListener('statechange', () => {
            if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisarNueva(nuevo);
          });
        });
        let recargando = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!habiaControl || recargando) return;
          recargando = true;
          location.reload();
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
