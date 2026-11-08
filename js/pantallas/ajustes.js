/* ============================================================
   Pantalla AJUSTES
   ============================================================ */
'use strict';

const PAjustes = (() => {
  function textoRespaldo() {
    const u = Datos.d.ultimoRespaldo;
    return u ? `Último respaldo: ${U.haceDias(u)} (${U.momento(u)})` : 'Último respaldo: nunca';
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

      <section class="tarjeta" aria-labelledby="t-resp">
        <h2 id="t-resp">Respaldo</h2>
        <p class="fuerte" id="ultimo-resp">${textoRespaldo()}</p>
        <p class="texto2 chico" style="margin-top:6px">Tus datos viven solo en el navegador de este celular. Si borras los datos del navegador (o desinstalas la app) sin un respaldo, <b>se pierden</b>. Exporta un respaldo de vez en cuando y guárdalo en tu Drive, correo o Archivos.</p>
        <div class="botones2">
          <button type="button" class="btn primario" data-accion="exportar">Exportar</button>
          <button type="button" class="btn" data-accion="importar">Importar</button>
        </div>
        <input type="file" id="archivo-respaldo" accept=".json,application/json" hidden>
      </section>

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

    cont.addEventListener('click', async (e) => {
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
        case 'exportar':
          await Datos.exportar();
          cont.querySelector('#ultimo-resp').textContent = textoRespaldo();
          U.aviso('Respaldo exportado.');
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
      let obj;
      try { obj = await Datos.leerRespaldo(archivo); } catch (err) { return U.aviso(err.message, { duracion: 5000 }); }
      const fecha = obj.ultimoRespaldo ? ` del ${U.momento(obj.ultimoRespaldo)}` : '';
      const ok = await U.confirmar({
        titulo: '¿Reemplazar tus datos?',
        mensaje: `Se cambiarán TODOS tus datos actuales por los del respaldo${fecha} (${U.plural(obj.tareas.length, 'tarea', 'tareas')}, ${U.plural((obj.movimientos || []).length, 'movimiento', 'movimientos')}). Lo que tienes ahora se perderá.`,
        aceptar: 'Sí, reemplazar',
        peligro: true,
      });
      if (!ok) return;
      Datos.importar(obj);
      App.refrescar();
      U.aviso('Respaldo importado.');
    });
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
