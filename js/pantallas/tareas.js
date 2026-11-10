/* ============================================================
   Pantalla TAREAS
   ============================================================ */
'use strict';

/** Funciones de tareas que también usa la pantalla Hoy. */
const Tareas = (() => {
  const peso = (t) => (t.prioridad === 'Alta' ? 0 : 1);
  /** Días que faltan para entregar (negativo si ya venció; null si no tiene fecha). */
  const dias = (t) => (t.fecha ? U.difDias(U.hoy(), t.fecha) : null);
  const cmpDias = (a, b) => {
    const da = dias(a), db = dias(b);
    return da === db ? 0 : da === null ? 1 : db === null ? -1 : da - db;
  };

  /** Por días que faltan (sin fecha al final); empate: Alta primero. */
  function ordenar(lista) { return [...lista].sort((a, b) => cmpDias(a, b) || peso(a) - peso(b)); }
  /** Alta primero; empate: por días que faltan. */
  function porPrioridad(lista) { return [...lista].sort((a, b) => peso(a) - peso(b) || cmpDias(a, b)); }

  /** Tareas pendientes repartidas por grupo. "Esta semana" son los próximos 7 días. */
  function grupos() {
    const pend = ordenar(Datos.d.tareas.filter((t) => !t.hecha));
    return {
      atrasadas: pend.filter((t) => dias(t) !== null && dias(t) < 0),
      hoy: pend.filter((t) => dias(t) === 0),
      semana: pend.filter((t) => dias(t) >= 1 && dias(t) <= 7),
      despues: pend.filter((t) => dias(t) === null || dias(t) > 7), // solo tareas viejas
      todas: pend,
    };
  }

  /** Tiempo que queda: "Hoy", "1 día", "3 días", "7+ días" o "−1 día" (en rojo). */
  function tiempo(t) {
    const d = dias(t);
    if (d === null) return { texto: '—', clase: '' };
    if (d < 0) return { texto: `−${U.plural(-d, 'día', 'días')}`, clase: 'rojo' };
    if (d === 0) return { texto: 'Hoy', clase: 'azul' };
    if (d > 7) return { texto: '7+ días', clase: '' };
    return { texto: U.plural(d, 'día', 'días'), clase: '' };
  }
  const prioridad = (t) => (t.prioridad === 'Alta' ? 'Alta' : 'Media');
  /** Etiqueta de prioridad (Alta en ámbar, Media en gris). */
  const htmlPrioridad = (t) => `<span class="prio ${prioridad(t) === 'Alta' ? 'alta' : 'media'}">${prioridad(t)}</span>`;

  return { ordenar, porPrioridad, grupos, tiempo, dias, prioridad, htmlPrioridad };
})();

const PTareas = (() => {
  const AREAS = ['Escuela', 'Personal', 'Casa', 'Otros'];
  const FILTROS = [
    { id: 'pendientes', nombre: 'Pendientes' },
    { id: 'hoy', nombre: 'Para hoy' },
    { id: 'semana', nombre: 'Esta semana' },
    { id: 'hechas', nombre: 'Hechas' },
  ];
  let filtro = 'pendientes';
  let abiertas = new Set(); // desplegables abiertos mientras estás en la pantalla

  const hechas = () => Datos.d.tareas.filter((x) => x.hecha).sort((a, b) => (b.hechaEn || '').localeCompare(a.hechaEn || ''));

  function cuenta(id, g) {
    switch (id) {
      case 'hoy': return g.atrasadas.length + g.hoy.length;
      case 'semana': return g.atrasadas.length + g.hoy.length + g.semana.length;
      case 'hechas': return hechas().length;
      default: return g.todas.length;
    }
  }

  /** Fila de tarea en tres columnas: Tarea (con el círculo) · Prioridad · Tiempo. */
  function htmlTarea(t) {
    const tm = t.hecha ? { texto: t.hechaEn ? U.haceDias(t.hechaEn) : '', clase: '' } : Tareas.tiempo(t);
    return `<li class="tarea ${t.hecha ? 'hecha' : ''}" data-tarea="${t.id}">
      <button type="button" class="circulo" data-marcar="${t.id}" aria-pressed="${t.hecha}" aria-label="${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${U.esc(t.texto)}"><span>${U.I.palomita}</span></button>
      <span class="tarea-texto" role="button" tabindex="0" aria-label="${U.esc(t.texto)}, prioridad ${Tareas.prioridad(t)}, ${U.esc(tm.texto)}. Opciones">${U.esc(t.texto)}</span>
      ${Tareas.htmlPrioridad(t)}
      <span class="tiempo ${tm.clase}">${tm.texto}</span>
    </li>`;
  }
  const lista = (ts, vacio) => `<ul class="lista">${ts.length ? ts.map(htmlTarea).join('') : `<li class="vacio chico">${vacio}</li>`}</ul>`;
  /** Títulos de las columnas, alineados con las filas. */
  const columnas = (col3 = 'Tiempo') => `<span class="col" aria-hidden="true">Prioridad</span><span class="col" aria-hidden="true">${col3}</span>`;

  /** Tarjeta fija (no desplegable). */
  function tarjeta(clave, clase, titulo, ts, vacio, col3) {
    return `<section class="tarjeta grupo ${clase}" ${clave ? `data-tarjeta="${clave}"` : ''}>
      <div class="grupo-cab"><h2 class="grupo-titulo">${titulo} <span class="n">${ts.length}</span></h2>${ts.length ? columnas(col3) : ''}</div>
      ${clase.includes('atrasadas') ? `<div class="atrasadas-lista">${lista(ts, vacio)}</div>` : lista(ts, vacio)}
    </section>`;
  }

  /** Línea de resumen para cuando "Esta semana" está cerrada: "Examen · 1 día". */
  const lineaResumen = (rotulo, t) => `<span class="resumen-linea"><span class="rotulo">${rotulo}</span><span class="t">${U.esc(t.texto)}</span><span class="texto2 chico">· ${Tareas.tiempo(t).texto}</span></span>`;

  /** Tarjeta desplegable. En "Esta semana", cerrada muestra PRÓXIMA y ALTA. */
  function desplegable(id, titulo, ts, vacio, conResumen) {
    let resumen = '';
    if (conResumen && ts.length) {
      const proxima = ts[0]; // ya vienen ordenadas por días (y Alta primero si empatan)
      const alta = ts.find((t) => t.prioridad === 'Alta');
      resumen = `<span class="resumen-cerrado">${lineaResumen('Próxima', proxima)}${alta && alta !== proxima ? lineaResumen('Alta', alta) : ''}</span>`;
    }
    return `<details class="tarjeta grupo desplegable" data-grupo="${id}" ${id === 'semana' ? 'data-tarjeta="semana"' : ''} ${abiertas.has(id) ? 'open' : ''}>
      <summary><span class="sum-fila"><span class="grupo-titulo">${titulo} <span class="n">${ts.length}</span></span><span class="flecha" aria-hidden="true">›</span></span>${resumen}</summary>
      <div class="contenido">
        ${ts.length ? `<div class="grupo-cab"><span></span>${columnas()}</div>` : ''}
        ${lista(ts, vacio)}
      </div>
    </details>`;
  }

  function render(cont) {
    abiertas = new Set(filtro === 'semana' ? ['semana'] : []); // "Esta semana" cerrada al entrar
    cont.innerHTML = `
      <div class="chips" role="group" aria-label="Filtrar tareas" id="chips"></div>
      <div class="grupos" id="grupos" aria-live="polite"></div>`;

    pintar(cont);
    Gestos.ordenable(cont.querySelector('#grupos'), { pantalla: 'tareas' });
    Gestos.fab(() => nuevaTarea(cont), 'Nueva tarea');

    // Recordar qué desplegables abriste (para que no se cierren al marcar una tarea).
    cont.addEventListener('toggle', (e) => {
      const g = e.target.dataset && e.target.dataset.grupo;
      if (!g) return;
      if (e.target.open) abiertas.add(g); else abiertas.delete(g);
    }, true);

    cont.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filtro]');
      if (chip) {
        filtro = chip.dataset.filtro;
        if (filtro === 'semana') abiertas.add('semana');
        return pintar(cont);
      }

      const m = e.target.closest('[data-marcar]');
      if (m) return marcar(cont, m.dataset.marcar);

      // Tocar la tarea (fuera del círculo) abre sus opciones.
      const fila = e.target.closest('[data-tarea]');
      if (fila) opciones(cont, fila.dataset.tarea);
    });
    cont.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.tarea-texto')) {
        e.preventDefault();
        opciones(cont, e.target.closest('[data-tarea]').dataset.tarea);
      }
    });
  }

  function marcar(cont, id) {
    const t = Datos.d.tareas.find((x) => x.id === id);
    if (!t) return;
    t.hecha = !t.hecha;
    t.hechaEn = t.hecha ? new Date().toISOString() : null;
    Datos.guardar();
    pintar(cont);
    if (t.hecha) U.aviso('¡Tarea hecha! La encuentras en "Hechas".');
  }

  /** Cuadro con "Marcar como hecha" y "Eliminar" (con confirmación). */
  function opciones(cont, id) {
    const t = Datos.d.tareas.find((x) => x.id === id);
    if (!t) return;
    U.hoja({
      titulo: 'Tarea',
      html: `<p class="hoja-texto">${U.esc(t.texto)}</p>
        <p class="texto2 chico hoja-detalle">Prioridad ${Tareas.prioridad(t)}${t.hecha ? '' : ` · ${Tareas.tiempo(t).texto}`}</p>
        <div class="pila">
          <button type="button" class="btn primario" data-op="marcar">${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}</button>
          <button type="button" class="btn peligro" data-op="eliminar">Eliminar</button>
        </div>`,
      alAbrir(panel, cerrar) {
        panel.addEventListener('click', async (e) => {
          const b = e.target.closest('[data-op]');
          if (!b) return;
          cerrar();
          if (b.dataset.op === 'marcar') return marcar(cont, id);
          const ok = await U.confirmar({
            titulo: '¿Eliminar la tarea?',
            mensaje: `“${t.texto}” se borrará.`,
            aceptar: 'Eliminar',
            peligro: true,
          });
          if (!ok) return;
          const antes = Datos.foto();
          Datos.d.tareas = Datos.d.tareas.filter((x) => x.id !== id);
          Datos.guardar();
          pintar(cont);
          App.conDeshacer('Tarea eliminada.', antes);
        });
      },
    });
  }

  /** Cuadro "Nueva tarea". La fecha de vencimiento se guarda como hoy + N días. */
  function nuevaTarea(cont) {
    U.hoja({
      titulo: 'Nueva tarea',
      html: `<form class="form" id="f-tarea" novalidate>
          <div class="campo">
            <label for="t-texto">Tarea</label>
            <input id="t-texto" type="text" maxlength="160" placeholder="¿Qué tienes que hacer?" autocomplete="off" enterkeyhint="done">
          </div>
          <div class="fila2">
            <div class="campo"><label for="t-tiempo">Tiempo de entrega</label>
              <select id="t-tiempo">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}">${U.plural(n, 'día', 'días')}</option>`).join('')}</select></div>
            <div class="campo"><label for="t-area">Área</label>
              <select id="t-area">${AREAS.map((a) => `<option>${a}</option>`).join('')}</select></div>
          </div>
          <fieldset class="segmentado">
            <legend>Prioridad</legend>
            <div class="segmentos">
              ${['Media', 'Alta'].map((p) => `<label><input type="radio" name="prioridad" value="${p}" ${p === 'Media' ? 'checked' : ''}><span>${p}</span></label>`).join('')}
            </div>
          </fieldset>
          <button class="btn primario ancho" type="submit">Agregar tarea</button>
        </form>`,
      alAbrir(panel, cerrar) {
        panel.querySelector('#f-tarea').addEventListener('submit', (e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const inp = f.querySelector('#t-texto');
          const texto = inp.value.trim();
          if (!texto) { inp.focus(); return U.aviso('Escribe la tarea.'); }
          const n = Number(f.querySelector('#t-tiempo').value) || 1;
          Datos.d.tareas.push({
            id: U.id(), texto,
            fecha: U.sumarDias(U.hoy(), n),
            hora: null,
            area: f.querySelector('#t-area').value,
            prioridad: f.querySelector('input[name="prioridad"]:checked').value === 'Alta' ? 'Alta' : 'Media',
            hecha: false, hechaEn: null, creada: new Date().toISOString(), ejemplo: false,
          });
          Datos.guardar();
          cerrar();
          if (filtro === 'hechas') filtro = 'pendientes';
          pintar(cont);
          U.aviso('Tarea agregada.');
        });
      },
    });
  }

  function pintar(cont) {
    const g = Tareas.grupos();
    cont.querySelector('#chips').innerHTML = FILTROS.map((f) => `
      <button type="button" class="chip" data-filtro="${f.id}" aria-pressed="${f.id === filtro}">
        <span>${f.nombre}</span><span class="n">${cuenta(f.id, g)}</span>
      </button>`).join('');

    let html;
    if (filtro === 'hechas') {
      html = tarjeta(null, '', 'Hechas', hechas(), 'Todavía no marcas tareas como hechas.', 'Hecha');
    } else {
      const piezas = {
        // "Atrasadas" solo aparece si hay tareas atrasadas; entonces se queda fija arriba al hacer scroll.
        atrasadas: g.atrasadas.length ? tarjeta('atrasadas', 'atrasadas fija', 'Atrasadas', g.atrasadas, '') : '',
        hoy: tarjeta('hoy', '', 'Hoy', g.hoy, 'Nada para hoy.'),
        semana: filtro !== 'hoy' ? desplegable('semana', 'Esta semana', g.semana, 'Nada más esta semana.', true) : '',
      };
      html = Datos.orden('tareas').map((k) => piezas[k]).join('');
      // Tareas viejas con más de 7 días (o sin fecha): al final, sin moverse.
      if (filtro === 'pendientes' && g.despues.length) html += desplegable('despues', 'Más adelante', g.despues, '', false);
    }
    cont.querySelector('#grupos').innerHTML = html;
  }

  return { titulo: 'Tareas', render };
})();
