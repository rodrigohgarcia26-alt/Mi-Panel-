/* ============================================================
   Pantalla TAREAS
   ============================================================ */
'use strict';

/** Funciones de tareas que también usa la pantalla Hoy. */
const Tareas = (() => {
  const PESO_PRIORIDAD = { Alta: 0, Normal: 1, Baja: 2 };
  const peso = (t) => PESO_PRIORIDAD[t.prioridad] ?? 1;
  /** Compara textos dejando los vacíos al final. */
  const cmpVacioAlFinal = (a, b) => (a || '') === (b || '') ? 0 : !a ? 1 : !b ? -1 : a.localeCompare(b);

  /** Por fecha (sin fecha al final); empate: prioridad y luego hora. */
  function ordenar(lista) {
    return [...lista].sort((a, b) => cmpVacioAlFinal(a.fecha, b.fecha) || peso(a) - peso(b) || cmpVacioAlFinal(a.hora, b.hora));
  }
  /** Las más importantes primero: prioridad Alta, luego por hora (sin hora al final). */
  function porImportancia(lista) {
    return [...lista].sort((a, b) => peso(a) - peso(b) || cmpVacioAlFinal(a.hora, b.hora));
  }

  /** Tareas pendientes repartidas por grupo.
      "Esta semana" son los próximos 7 días (así nunca queda vacía en domingo). */
  function grupos() {
    const hoy = U.hoy();
    const finSemana = U.sumarDias(hoy, 7);
    const pend = ordenar(Datos.d.tareas.filter((t) => !t.hecha));
    return {
      atrasadas: pend.filter((t) => t.fecha && t.fecha < hoy),
      hoy: pend.filter((t) => t.fecha === hoy),
      semana: pend.filter((t) => t.fecha && t.fecha > hoy && t.fecha <= finSemana),
      despues: pend.filter((t) => !t.fecha || t.fecha > finSemana),
      todas: pend,
    };
  }

  /** Texto de la fecha (y hora) para la etiqueta de una tarea. */
  function etiquetaFechaHora(t) {
    const e = U.etiquetaFecha(t.fecha);
    if (!e) return t.hora ? { texto: U.hora(t.hora), clase: '' } : null;
    return t.hora ? { texto: `${e.texto} · ${U.hora(t.hora)}`, clase: e.clase } : e;
  }

  return { ordenar, porImportancia, grupos, etiquetaFechaHora };
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

  function htmlTarea(t) {
    const e = !t.hecha ? Tareas.etiquetaFechaHora(t) : null;
    return `<li class="tarea ${t.hecha ? 'hecha' : ''}">
      <button type="button" class="circulo" data-marcar="${t.id}" aria-pressed="${t.hecha}" aria-label="${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${U.esc(t.texto)}"><span>${U.I.palomita}</span></button>
      <div class="tarea-cuerpo">
        <p class="tarea-texto">${U.esc(t.texto)}</p>
        <div class="etiquetas">
          <span class="etq">${U.esc(t.area)}</span>
          ${t.prioridad !== 'Normal' ? `<span class="etq ${t.prioridad === 'Alta' ? 'alta' : 'baja'}">${t.prioridad}</span>` : ''}
          ${e ? `<span class="etq ${e.clase}">${e.texto}</span>` : ''}
          ${t.hecha && t.hechaEn ? `<span class="etq">Hecha ${U.haceDias(t.hechaEn)}</span>` : ''}
        </div>
      </div>
      <button type="button" class="btn-icono quitar" data-eliminar="${t.id}" aria-label="Borrar tarea: ${U.esc(t.texto)}">${U.I.x}</button>
    </li>`;
  }
  const lista = (ts, vacio) => `<ul class="lista">${ts.length ? ts.map(htmlTarea).join('') : `<li class="vacio chico">${vacio}</li>`}</ul>`;

  /** Tarjeta fija (no desplegable). */
  function tarjeta(clase, titulo, ts, vacio) {
    return `<section class="tarjeta grupo ${clase}">
      <h2 class="grupo-titulo">${titulo} <span class="n">${ts.length}</span></h2>
      ${lista(ts, vacio)}
    </section>`;
  }

  /** Línea de resumen para cuando "Esta semana" está cerrada. */
  const lineaResumen = (rotulo, t) => {
    const e = Tareas.etiquetaFechaHora(t);
    return `<span class="resumen-linea"><span class="rotulo">${rotulo}</span><span class="t">${U.esc(t.texto)}</span>${e ? `<span class="texto2 chico">${e.texto}</span>` : ''}</span>`;
  };

  /** Tarjeta desplegable. En "Esta semana", cerrada muestra PRÓXIMA y ALTA. */
  function desplegable(id, titulo, ts, vacio, conResumen) {
    let resumen = '';
    if (conResumen && ts.length) {
      const proxima = ts[0];
      const alta = ts.find((t) => t.prioridad === 'Alta');
      resumen = `<span class="resumen-cerrado">${lineaResumen('Próxima', proxima)}${alta && alta !== proxima ? lineaResumen('Alta', alta) : ''}</span>`;
    }
    return `<details class="tarjeta grupo desplegable" data-grupo="${id}" ${abiertas.has(id) ? 'open' : ''}>
      <summary><span class="sum-fila"><span class="grupo-titulo">${titulo} <span class="n">${ts.length}</span></span><span class="flecha" aria-hidden="true">›</span></span>${resumen}</summary>
      <div class="contenido">${lista(ts, vacio)}</div>
    </details>`;
  }

  function render(cont) {
    abiertas = new Set(filtro === 'semana' ? ['semana'] : []);
    cont.innerHTML = `
      <details class="tarjeta desplegable agregar" id="d-tarea">
        <summary><span class="grupo-titulo">${U.I.mas} Agregar tarea</span><span class="flecha" aria-hidden="true">›</span></summary>
        <form class="form contenido" id="f-tarea" novalidate>
          <div class="campo">
            <label for="t-texto">Tarea</label>
            <input id="t-texto" type="text" maxlength="160" placeholder="¿Qué tienes que hacer?" autocomplete="off" enterkeyhint="done">
          </div>
          <div class="fila2">
            <div class="campo"><label for="t-fecha">Fecha límite</label><input id="t-fecha" type="date" value="${U.hoy()}"></div>
            <div class="campo"><label for="t-hora">Hora (opcional)</label><input id="t-hora" type="time"></div>
          </div>
          <div class="campo"><label for="t-area">Área</label>
            <select id="t-area">${AREAS.map((a) => `<option>${a}</option>`).join('')}</select></div>
          <fieldset class="segmentado">
            <legend>Prioridad</legend>
            <div class="segmentos">
              ${['Alta', 'Normal', 'Baja'].map((p) => `<label><input type="radio" name="prioridad" value="${p}" ${p === 'Normal' ? 'checked' : ''}><span>${p}</span></label>`).join('')}
            </div>
          </fieldset>
          <button class="btn primario ancho" type="submit">Agregar tarea</button>
        </form>
      </details>
      <div class="chips" role="group" aria-label="Filtrar tareas" id="chips"></div>
      <div class="grupos" id="grupos" aria-live="polite"></div>`;

    pintar(cont);

    cont.querySelector('#f-tarea').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const inp = f.querySelector('#t-texto');
      const texto = inp.value.trim();
      if (!texto) { inp.focus(); return U.aviso('Escribe la tarea.'); }
      Datos.d.tareas.push({
        id: U.id(), texto,
        fecha: f.querySelector('#t-fecha').value || null,
        hora: f.querySelector('#t-hora').value || null,
        area: f.querySelector('#t-area').value,
        prioridad: f.querySelector('input[name="prioridad"]:checked').value,
        hecha: false, hechaEn: null, creada: new Date().toISOString(), ejemplo: false,
      });
      Datos.guardar();
      inp.value = '';
      f.querySelector('#t-hora').value = '';
      if (filtro === 'hechas') filtro = 'pendientes';
      pintar(cont);
      U.aviso('Tarea agregada.');
    });

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
      if (m) {
        const t = Datos.d.tareas.find((x) => x.id === m.dataset.marcar);
        if (!t) return;
        t.hecha = !t.hecha;
        t.hechaEn = t.hecha ? new Date().toISOString() : null;
        Datos.guardar();
        pintar(cont);
        if (t.hecha) U.aviso('¡Tarea hecha! La encuentras en "Hechas".');
        return;
      }

      const el = e.target.closest('[data-eliminar]');
      if (el) {
        const antes = Datos.foto();
        Datos.d.tareas = Datos.d.tareas.filter((x) => x.id !== el.dataset.eliminar);
        Datos.guardar();
        pintar(cont);
        App.conDeshacer('Tarea borrada.', antes);
      }
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
      html = tarjeta('', 'Hechas', hechas(), 'Todavía no marcas tareas como hechas.');
    } else {
      // "Atrasadas" siempre visible; con tareas, se queda fija arriba al hacer scroll.
      html = `<section class="tarjeta grupo atrasadas ${g.atrasadas.length ? 'fija' : 'sin'}">
          <h2 class="grupo-titulo">Atrasadas <span class="n">${g.atrasadas.length}</span></h2>
          ${g.atrasadas.length ? `<div class="atrasadas-lista">${lista(g.atrasadas, '')}</div>` : '<p class="texto2 chico">Nada atrasado. ¡Bien!</p>'}
        </section>`;
      html += tarjeta('', 'Hoy', g.hoy, 'Nada para hoy.');
      if (filtro !== 'hoy') html += desplegable('semana', 'Esta semana', g.semana, 'Nada más esta semana.', true);
      if (filtro === 'pendientes' && g.despues.length) html += desplegable('despues', 'Más adelante', g.despues, '', false);
    }
    cont.querySelector('#grupos').innerHTML = html;
  }

  return { titulo: 'Tareas', render };
})();
