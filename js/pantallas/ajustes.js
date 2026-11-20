/* ============================================================
   Pantalla AJUSTES
   ============================================================ */
'use strict';

const PAjustes = (() => {
  const FILAS_COPIA = [
    { id: 'tareas', nombre: 'Tareas', desc: 'Pendientes, hechas y tiempos' },
    { id: 'habitos', nombre: 'Hábitos', desc: 'Tus hábitos y su historial' },
    { id: 'dinero', nombre: 'Dinero', desc: 'Movimientos, presupuesto y categorías' },
    { id: 'mas', nombre: 'Más', desc: 'Metas, notas y revisiones de la semana' },
  ];

  /** Tarjeta "Copias de seguridad" (la lista de copias se llena después, viene de IndexedDB). */
  function htmlCopias() {
    const cfg = Copias.config();
    return `<section class="tarjeta copias" aria-labelledby="t-copias" id="tarjeta-copias">
        <div class="interruptor-zona">
          <div>
            <h2 id="t-copias">Copias de seguridad</h2>
            <p class="texto2 chico" id="copias-sub">Una copia automática cada día a las 3:00 am.</p>
          </div>
          <button type="button" class="interruptor" role="switch" aria-checked="${cfg.auto}" aria-labelledby="t-copias" aria-describedby="copias-sub" data-accion="copia-auto"></button>
        </div>
        <p class="copia-ultima"><span class="punto ${cfg.auto ? 'ok' : 'apagado'}" aria-hidden="true"></span><span id="copia-ultima">Última copia: …</span></p>
        <p class="copia-error rojo chico" id="copia-error" role="alert" ${Copias.error ? '' : 'hidden'}>${U.esc(Copias.error || '')}</p>
        ${cfg.auto ? '<p class="texto2 chico copia-nota">Si el celular está apagado a las 3:00 am, la copia se hace en cuanto abras la app.</p>' : ''}

        <h3 class="copias-sub">Qué se guarda</h3>
        <ul class="copias-filas">${FILAS_COPIA.map((f) => `
          <li class="interruptor-zona">
            <div><p class="fuerte" id="cs-${f.id}">${f.nombre}</p><p class="texto2 chico" id="cs-${f.id}-d">${f.desc}</p></div>
            <button type="button" class="interruptor" role="switch" aria-checked="${cfg.secciones[f.id]}" aria-labelledby="cs-${f.id}" aria-describedby="cs-${f.id}-d" data-seccion-copia="${f.id}"></button>
          </li>`).join('')}
        </ul>

        <h3 class="copias-sub">Copias en el celular</h3>
        <ul class="copias-lista" id="copias-lista"><li class="texto2 chico">Cargando…</li></ul>
        <p class="texto2 chico">Se conservan las últimas ${Copias.MAX_COPIAS}. Las más viejas se borran solas.</p>

        <div class="pila">
          <button type="button" class="btn primario" data-accion="copia-ahora">Hacer copia ahora</button>
        </div>
        <div class="botones2">
          <button type="button" class="btn" data-accion="exportar">Exportar archivo</button>
          <button type="button" class="btn" data-accion="importar">Importar</button>
        </div>
        <input type="file" id="archivo-respaldo" accept=".json,application/json" hidden>
        <p class="texto2 chico copia-final">Las copias viven en el mismo celular. Si borras los datos del navegador se van con todo, así que de vez en cuando exporta el archivo y guárdalo en tu nube o mándatelo por correo.</p>
      </section>`;
  }

  /** Llena "Última copia" y la lista de copias. */
  async function pintarCopias(cont) {
    const ul = cont.querySelector('#copias-lista');
    if (!ul) return;
    let copias = [];
    try { copias = await Copias.lista(); } catch (e) { /* IndexedDB no disponible */ }
    if (!ul.isConnected) return;
    const err = cont.querySelector('#copia-error');
    err.textContent = Copias.error || '';
    err.hidden = !Copias.error;
    const u = copias[0];
    cont.querySelector('#copia-ultima').textContent = u
      ? `Última copia: ${Copias.diaCorto(new Date(u.fecha))} ${Copias.horaCorta(new Date(u.fecha))} · ${Copias.tamano(u.tamano)}`
      : 'Última copia: todavía no hay';
    ul.innerHTML = copias.length ? copias.map((c) => {
      const f = new Date(c.fecha);
      const extra = c.tipo === 'seguridad' ? ' · antes de restaurar' : '';
      return `<li class="copia-item">
          <div><p class="fuerte">${U.cap(Copias.diaCorto(f))}, ${Copias.horaCorta(f)}</p><p class="texto2 chico">${Copias.tamano(c.tamano)}${extra}</p></div>
          <button type="button" class="btn chico" data-restaurar="${c.id}" aria-label="Restaurar la copia de ${Copias.diaCorto(f)}, ${Copias.horaCorta(f)}">Restaurar</button>
        </li>`;
    }).join('') : '<li class="texto2 chico">Todavía no hay copias.</li>';
  }

  function render(cont) {
    const oscuro = App.temaEfectivo() === 'oscuro';
    cont.innerHTML = `
      <section class="tarjeta" aria-labelledby="t-offline">
        <h2 id="t-offline">Funciona sin internet</h2>
        <p class="texto2">Mi Panel guarda todo en este celular. No necesita internet ni cuenta: tus datos no salen de aquí.</p>
        <ul class="estado" id="estado"></ul>
      </section>

      <section class="tarjeta" aria-labelledby="t-tema">
        <div class="interruptor-zona">
          <div>
            <h2 id="t-tema" style="font-size:1.15rem">Modo oscuro</h2>
            <p class="texto2 chico">${Datos.tema() ? 'Elegido por ti' : 'Sigue el tema del celular'}</p>
          </div>
          <button type="button" class="interruptor" role="switch" aria-checked="${oscuro}" aria-labelledby="t-tema" data-accion="tema"></button>
        </div>
        ${Datos.tema() ? '<button type="button" class="btn-texto" data-accion="tema-sistema">Usar el tema del celular</button>' : ''}
      </section>

      <section class="tarjeta" aria-labelledby="t-orden">
        <h2 id="t-orden">Tarjetas</h2>
        <p class="texto2 chico">En cada pantalla puedes mantener presionada una tarjeta para moverla.</p>
        <div class="pila">
          <button type="button" class="btn" data-accion="restablecer-orden">Restablecer orden de las tarjetas</button>
        </div>
      </section>

      ${htmlCopias()}

      <section class="tarjeta" aria-labelledby="t-datos">
        <h2 id="t-datos">Tus datos</h2>
        <p class="texto2 chico">Los ejemplos son las tareas, gastos, nota y marcas de hábitos que venían al abrir la app por primera vez.</p>
        <div class="pila">
          <button type="button" class="btn" data-accion="borrar-ejemplos" ${Datos.hayEjemplos() ? '' : 'disabled'}>${Datos.hayEjemplos() ? 'Borrar los ejemplos' : 'Ya no hay ejemplos'}</button>
          <button type="button" class="btn peligro" data-accion="borrar-todo">Borrar todos los datos</button>
        </div>
      </section>
      <p class="pie">Mi Panel · datos versión ${Datos.VERSION}</p>`;

    pintarEstado(cont);
    pintarCopias(cont);
    // Si se hace una copia automática mientras estás aquí, se actualiza la tarjeta.
    const alCambiar = () => { if (cont.isConnected) pintarCopias(cont); else document.removeEventListener('copias-cambio', alCambiar); };
    document.addEventListener('copias-cambio', alCambiar);

    cont.addEventListener('click', async (e) => {
      const sc = e.target.closest('[data-seccion-copia]');
      if (sc) {
        const cfg = Copias.config();
        cfg.secciones[sc.dataset.seccionCopia] = !cfg.secciones[sc.dataset.seccionCopia];
        Copias.ponerConfig(cfg);
        sc.setAttribute('aria-checked', String(cfg.secciones[sc.dataset.seccionCopia]));
        return;
      }
      const r = e.target.closest('[data-restaurar]');
      if (r) return restaurarCopia(cont, Number(r.dataset.restaurar));
      const b = e.target.closest('[data-accion]');
      if (!b) return;
      switch (b.dataset.accion) {
        case 'tema':
          App.ponerTema(App.temaEfectivo() === 'oscuro' ? 'claro' : 'oscuro');
          App.refrescar();
          break;
        case 'tema-sistema':
          App.ponerTema(null);
          App.refrescar();
          break;
        case 'copia-auto': {
          const cfg = Copias.config();
          cfg.auto = !cfg.auto;
          Copias.ponerConfig(cfg);
          App.refrescar();
          if (cfg.auto) Copias.revisar();
          break;
        }
        case 'copia-ahora':
          b.disabled = true;
          try { await Copias.hacer('manual'); U.aviso('Copia hecha.'); } catch (err) { U.aviso('No se pudo guardar la copia'); }
          b.disabled = false;
          pintarCopias(cont);
          break;
        case 'exportar':
          try { await Copias.exportarArchivo(); U.aviso('Archivo exportado.'); } catch (err) { U.aviso('No se pudo exportar el archivo.'); }
          break;
        case 'restablecer-orden':
          Datos.restablecerOrdenes();
          U.aviso('Listo: las tarjetas volvieron a su orden original.');
          break;
        case 'importar':
          cont.querySelector('#archivo-respaldo').click();
          break;
        case 'borrar-ejemplos': {
          const antes = Datos.foto();
          Datos.borrarEjemplos();
          App.refrescar();
          App.conDeshacer('Se borraron los ejemplos.', antes);
          break;
        }
        case 'borrar-todo': {
          const ok = await U.confirmar({
            titulo: '¿Borrar todos los datos?',
            mensaje: 'Se borrarán tus tareas, hábitos, dinero, notas, revisiones y metas de este celular. Esto no se puede deshacer. Si quieres, primero exporta un respaldo.',
            aceptar: 'Sí, borrar todo',
            peligro: true,
          });
          if (!ok) return;
          Datos.borrarTodo();
          App.refrescar();
          U.aviso('Se borraron todos los datos.');
          break;
        }
      }
    });

    cont.querySelector('#archivo-respaldo').addEventListener('change', async (e) => {
      const archivo = e.target.files[0];
      e.target.value = ''; // permite volver a elegir el mismo archivo
      if (!archivo) return;
      let leido;
      try { leido = await Copias.leerArchivo(archivo); } catch (err) { return U.aviso(err.message, { duracion: 6000 }); }
      const ok = await U.confirmar({
        titulo: '¿Reemplazar tus datos?',
        mensaje: `Se cambiarán ${leido.resumen} por lo que trae el archivo. Antes se hará una copia de lo que tienes ahora.`,
        aceptar: 'Sí, reemplazar',
        peligro: true,
      });
      if (!ok) return;
      try { await Copias.importarArchivo(leido); } catch (err) { return U.aviso('No se pudo importar el archivo. Tus datos no cambiaron.', { duracion: 5000 }); }
      location.reload();
    });
  }

  /** Restaurar una copia: confirmar, copia de seguridad del estado actual, reemplazar y recargar. */
  async function restaurarCopia(cont, id) {
    let copia;
    try { copia = (await Copias.lista()).find((c) => c.id === id); } catch (e) { /* IndexedDB no disponible */ }
    if (!copia) return U.aviso('No se encontró esa copia.');
    const f = new Date(copia.fecha);
    const ok = await U.confirmar({
      titulo: '¿Restaurar esta copia?',
      mensaje: `Tus datos regresarán a como estaban ${Copias.diaCorto(f)} a las ${Copias.horaCorta(f)}. Antes se hará una copia de lo que tienes ahora, por si acaso.`,
      aceptar: 'Sí, restaurar',
      peligro: true,
    });
    if (!ok) return;
    try { await Copias.restaurar(id); } catch (e) { pintarCopias(cont); return U.aviso('No se pudo restaurar. Tus datos no cambiaron.', { duracion: 5000 }); }
    location.reload();
  }

  async function pintarEstado(cont) {
    const ul = cont.querySelector('#estado');
    const listo = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
    let persistente = false;
    try { persistente = !!(navigator.storage && navigator.storage.persisted && await navigator.storage.persisted()); } catch (e) { /* no disponible */ }
    if (!ul.isConnected) return;
    const fila = (ok, texto) => `<li><span class="punto ${ok ? 'ok' : 'no'}" aria-hidden="true"></span><span>${texto}</span></li>`;
    ul.innerHTML = [
      fila(listo, listo ? 'Lista para usarse sin internet' : 'Preparando el modo sin internet… (abre la app una vez con internet)'),
      fila(navigator.onLine, navigator.onLine ? 'Ahora tienes conexión' : 'Ahora estás sin conexión (todo sigue funcionando)'),
      fila(persistente, persistente ? 'Almacenamiento protegido: el navegador no borrará tus datos por falta de espacio' : 'Almacenamiento normal (en iPhone esto es lo habitual; haz respaldos)'),
    ].join('');
  }

  return { titulo: 'Ajustes', render };
})();
