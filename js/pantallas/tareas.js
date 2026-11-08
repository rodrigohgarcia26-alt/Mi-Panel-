/* ============================================================
   Pantalla TAREAS
   ============================================================ */
'use strict';

/** Funciones de tareas que también usa la pantalla Hoy. */
const Tareas = (() => {
  const PESO_PRIORIDAD = { Alta: 0, Normal: 1, Baja: 2 };
  /** Primero las que tienen fecha (la más próxima o vencida), luego sin fecha; empate: prioridad. */
  function ordenar(lista) {
    return [...lista].sort((a, b) => {
      if (a.fecha !== b.fecha) {
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      }
      return (PESO_PRIORIDAD[a.prioridad] ?? 1) - (PESO_PRIORIDAD[b.prioridad] ?? 1);
    });
  }
  return { ordenar };
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

  function filtrar(id) {
    const hoy = U.hoy();
    const lunes = U.inicioSemana(hoy);
    const domingo = U.sumarDias(lunes, 6);
    const t = Datos.d.tareas;
    switch (id) {
      case 'hoy': return Tareas.ordenar(t.filter((x) => !x.hecha && x.fecha && x.fecha <= hoy)); // hoy y vencidas
      case 'semana': return Tareas.ordenar(t.filter((x) => !x.hecha && x.fecha && x.fecha <= domingo && x.fecha >= lunes));
      case 'hechas': return [...t.filter((x) => x.hecha)].sort((a, b) => (b.hechaEn || '').localeCompare(a.hechaEn || ''));
      default: return Tareas.ordenar(t.filter((x) => !x.hecha));
    }
  }

  const VACIOS = {
    pendientes: 'No tienes tareas pendientes. ¡Bien!',
    hoy: 'Nada para hoy.',
    semana: 'Nada pendiente para esta semana.',
    hechas: 'Todavía no marcas tareas como hechas.',
  };

  function htmlTarea(t) {
    const e = !t.hecha ? U.etiquetaFecha(t.fecha) : null;
    return `<li class="tarea ${t.hecha ? 'hecha' : ''}">
      <button type="button" class="circulo" data-marcar="${t.id}" aria-pressed="${t.hecha}" aria-label="${t.hecha ? 'Marcar como pendiente' : 'Marcar como hecha'}: ${U.esc(t.texto)}"><span>${U.I.palomita}</span></button>
      <div class="tarea-cuerpo">
        <p class="tarea-texto">${U.esc(t.texto)}</p>
        <div class="etiquetas">
          ${e ? `<span class="etq ${e.clase}">${e.texto}</span>` : ''}
          ${t.hecha && t.hechaEn ? `<span class="etq">Hecha ${U.haceDias(t.hechaEn)}</span>` : ''}
          <span class="etq">${U.esc(t.area)}</span>
          ${t.prioridad !== 'Normal' ? `<span class="etq ${t.prioridad === 'Alta' ? 'alta' : 'baja'}">Prioridad ${t.prioridad.toLowerCase()}</span>` : ''}
        </div>
      </div>
      <button type="button" class="btn-icono peligro" data-eliminar="${t.id}" aria-label="Eliminar tarea: ${U.esc(t.texto)}">${U.I.basura}</button>
    </li>`;
  }

  function render(cont) {
    cont.innerHTML = `
      <form class="tarjeta form" id="f-tarea" novalidate>
        <div class="campo">
          <label for="t-texto">Nueva tarea</label>
          <input id="t-texto" type="text" maxlength="160" placeholder="¿Qué tienes que hacer?" autocomplete="off" enterkeyhint="done">
        </div>
        <div class="fila2">
          <div class="campo"><label for="t-fecha">Fecha</label><input id="t-fecha" type="date" value="${U.hoy()}"></div>
          <div class="campo"><label for="t-area">Área</label>
            <select id="t-area">${AREAS.map((a) => `<option>${a}</option>`).join('')}</select></div>
        </div>
        <fieldset class="segmentado">
          <legend>Prioridad</legend>
          <div class="segmentos">
            ${['Alta', 'Normal', 'Baja'].map((p) => `<label><input type="radio" name="prioridad" value="${p}" ${p === 'Normal' ? 'checked' : ''}><span>${p}</span></label>`).join('')}
          </div>
        </fieldset>
        <button class="btn primario ancho" type="submit">Agregar tarea</button>
      </form>
      <div class="chips" role="group" aria-label="Filtrar tareas" id="chips"></div>
      <div class="tarjeta lista-tarjeta"><ul class="lista" id="lista-tareas" aria-live="polite"></ul></div>`;

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
        area: f.querySelector('#t-area').value,
        prioridad: f.querySelector('input[name="prioridad"]:checked').value,
        hecha: false, hechaEn: null, creada: new Date().toISOString(), ejemplo: false,
      });
      Datos.guardar();
      inp.value = '';
      if (filtro === 'hechas') filtro = 'pendientes';
      pintar(cont);
      U.aviso('Tarea agregada.');
    });

    cont.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filtro]');
      if (chip) { filtro = chip.dataset.filtro; return pintar(cont); }

      const m = e.target.closest('[data-marcar]');
      if (m) {
        const t = Datos.d.tareas.find((x) => x.id === m.dataset.marcar);
        if (!t) return;
        t.hecha = !t.hecha;
        t.hechaEn = t.hecha ? new Date().toISOString() : null;
        Datos.guardar();
        pintar(cont);
        if (t.hecha) U.aviso('¡Tarea hecha!');
        return;
      }

      const el = e.target.closest('[data-eliminar]');
      if (el) {
        const antes = Datos.foto();
        Datos.d.tareas = Datos.d.tareas.filter((x) => x.id !== el.dataset.eliminar);
        Datos.guardar();
        pintar(cont);
        App.conDeshacer('Tarea eliminada.', antes);
      }
    });
  }

  function pintar(cont) {
    cont.querySelector('#chips').innerHTML = FILTROS.map((f) => `
      <button type="button" class="chip" data-filtro="${f.id}" aria-pressed="${f.id === filtro}">
        ${f.nombre} <span class="n">${filtrar(f.id).length}</span>
      </button>`).join('');
    const lista = filtrar(filtro);
    cont.querySelector('#lista-tareas').innerHTML = lista.length
      ? lista.map(htmlTarea).join('')
      : `<li class="vacio">${VACIOS[filtro]}</li>`;
  }

  return { titulo: 'Tareas', render };
})();
