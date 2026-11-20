/* ============================================================
   Pantalla HOY: resumen compacto en una cuadrícula de 2 columnas.
   Mantén presionada una tarjeta (~450 ms) y suéltala sobre otra
   para intercambiarlas (js/gestos.js). El orden se guarda en "mipanel-orden".
   De Tareas, Hábitos y Dinero, la que más usas (últimos 30 días, "mipanel-uso")
   va grande a todo el ancho; las otras dos van chicas, una junto a la otra.
   ============================================================ */
'use strict';

const PHoy = (() => {
  const MAX_LINEAS = 4;          // tareas que caben en la tarjeta de Tareas
  const ANCHAS = ['manana', 'notas'];                  // siempre a todo el ancho
  const ADAPTABLES = ['tareas', 'habitos', 'dinero'];  // grande o chica según el uso
  // A dónde lleva cada tarjeta (las notas viven en "Más").
  const DESTINO = { tareas: 'tareas', habitos: 'habitos', dinero: 'dinero', manana: 'tareas', notas: 'mas' };

  const cabTarjeta = (icono, titulo, extra = '') => `
    <div class="th-cab">
      <span class="th-icono">${U.I[icono]}</span>
      <h2>${titulo}</h2>${extra}
      <span class="th-flecha" aria-hidden="true">›</span>
    </div>`;

  /** Línea de "Mañana": texto, prioridad (Alta/Media) y días que faltan. Sin horas. */
  function lineaSiguiente(t) {
    return `<li>
      <span class="t">${U.esc(t.texto)}</span>
      ${Tareas.htmlPrioridad(t)}
      <span class="cuando">${Tareas.tiempo(t).texto}</span>
    </li>`;
  }

  // ---------- Tarjetas ----------
  /** Pendientes de hoy y atrasadas (atrasadas primero; las de hoy con Alta primero). */
  function pendientesHoy() {
    const g = Tareas.grupos();
    return [...g.atrasadas, ...Tareas.porPrioridad(g.hoy)];
  }
  /** Tareas con entrega esta semana (lunes a domingo): cuántas hay y cuántas están hechas. */
  function semanaTareas() {
    const lunes = U.inicioSemana(U.hoy());
    const domingo = U.sumarDias(lunes, 6);
    const ts = Datos.d.tareas.filter((t) => t.fecha && t.fecha >= lunes && t.fecha <= domingo);
    return { hechas: ts.filter((t) => t.hecha).length, total: ts.length };
  }

  /** Tareas GRANDE: tabla Tarea | Prioridad | Tiempo y avance de la semana. */
  function tareasGrande() {
    const ts = pendientesHoy();
    const sem = semanaTareas();
    const pct = sem.total ? Math.round((sem.hechas / sem.total) * 100) : 0;
    const extra = ts.length - MAX_LINEAS;
    const fila = (t) => {
      const e = Tareas.tiempo(t);
      return `<li class="th-fila">
        <span class="th-tarea"><span class="th-circ" aria-hidden="true"></span><span class="t">${U.esc(t.texto)}</span></span>
        ${Tareas.htmlPrioridad(t)}
        <span class="tiempo ${e.clase}">${e.texto}</span>
      </li>`;
    };
    return `${cabTarjeta('tareas', 'Tareas', `<span class="th-etq">${U.plural(ts.length, 'pendiente', 'pendientes')}</span>`)}
      ${ts.length ? `<div class="th-cols" aria-hidden="true"><span>Tarea</span><span>Prioridad</span><span>Tiempo</span></div>
        <ul class="th-tabla">${ts.slice(0, MAX_LINEAS).map(fila).join('')}</ul>
        ${extra > 0 ? `<p class="th-mas">y ${extra} más</p>` : ''}`
        : '<p class="th-vacio">Nada pendiente para hoy.</p>'}
      <div class="th-semana">
        <p>Esta semana: <b>${sem.hechas} de ${sem.total}</b> ${sem.hechas === 1 && sem.total === 1 ? 'hecha' : 'hechas'}</p>
        <div class="barra verde" role="progressbar" aria-label="Tareas de esta semana hechas" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      </div>`;
  }

  /** Tareas CHICA: número de pendientes y la más urgente. */
  function tareasChica() {
    const ts = pendientesHoy();
    if (!ts.length) return `${cabTarjeta('tareas', 'Tareas')}<p class="th-vacio">Nada pendiente para hoy.</p>`;
    const t = ts[0];
    const e = U.etiquetaFecha(t.fecha) || { texto: '', clase: '' };
    return `${cabTarjeta('tareas', 'Tareas')}
      <p class="th-num"><b>${ts.length}</b><span>${ts.length === 1 ? 'pendiente' : 'pendientes'}</span></p>
      <hr class="th-sep">
      <div class="th-urg">
        <p class="t">${U.esc(t.texto)}</p>
        ${e.texto ? `<p class="cuando ${e.clase}">${e.texto}</p>` : ''}
      </div>`;
  }

  /** Hábitos GRANDE: anillo a la izquierda y la lista de todos los hábitos a la derecha. */
  function habitosGrande() {
    const hoy = U.hoy();
    const hab = Datos.d.habitos;
    if (!hab.length) return `${cabTarjeta('habitos', 'Hábitos')}<p class="th-vacio">Agrega tu primer hábito.</p>`;
    const hechos = hab.filter((h) => h.dias[hoy]).length;
    return `${cabTarjeta('habitos', 'Hábitos', `<span class="th-etq ${hechos === hab.length ? 'verde' : ''}">${hechos} de ${hab.length} hoy</span>`)}
      <div class="th-hab">
        ${U.anillo(hechos, hab.length, 84)}
        <ul class="th-hab-lista">${hab.map((h) => `
          <li class="${h.dias[hoy] ? 'hecho' : ''}">
            <span class="th-check" aria-hidden="true">${h.dias[hoy] ? U.I.palomita : ''}</span>
            <span class="n">${U.esc(h.nombre)}<span class="solo-lector">${h.dias[hoy] ? ': hecho' : ': falta'}</span></span>
          </li>`).join('')}
        </ul>
      </div>`;
  }

  function habitosChica() {
    const hoy = U.hoy();
    const hab = Datos.d.habitos;
    if (!hab.length) return `${cabTarjeta('habitos', 'Hábitos')}<p class="th-vacio">Agrega tu primer hábito.</p>`;
    const hechos = hab.filter((h) => h.dias[hoy]).length;
    const faltan = hab.filter((h) => !h.dias[hoy]).map((h) => U.minus(h.nombre));
    return `${cabTarjeta('habitos', 'Hábitos')}
      <div class="th-anillo">${U.anillo(hechos, hab.length, 60)}</div>
      <p class="th-faltan ${faltan.length ? '' : 'verde fuerte'}">${faltan.length ? `Faltan: ${U.esc(U.unirY(faltan))}` : '¡Todos listos!'}</p>`;
  }

  /** Dinero GRANDE: gastado hoy, barra del mes y las 2 categorías con más gasto. */
  function dineroGrande() {
    const hoy = U.hoy();
    const r = Dinero.resumenMes(U.mesDe(hoy));
    const hoyGasto = Datos.d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha === hoy).reduce((s, m) => s + m.monto, 0);
    const presu = Datos.d.presupuesto;
    const pct = presu > 0 ? Math.min(100, Math.round((r.gastos / presu) * 100)) : 0;
    const porCat = {};
    r.movs.filter((m) => m.tipo === 'gasto').forEach((m) => { porCat[m.categoria] = (porCat[m.categoria] || 0) + m.monto; });
    const top = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return `${cabTarjeta('dinero', 'Dinero', `<span class="th-etq ${r.balance < 0 ? 'rojo' : 'verde'}">Balance ${U.dinero(r.balance)}</span>`)}
      <div class="th-din">
        <div class="th-din-hoy">
          <p class="th-grande">${U.dinero(hoyGasto)}</p>
          <p class="th-sub">gastados hoy</p>
        </div>
        <div class="th-din-mes">
          <div class="barra ${Dinero.colorBarra(r.gastos, presu)}" role="progressbar" aria-label="Presupuesto del mes usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
          <p><b>${U.dinero(r.gastos)}</b> de ${U.dinero(presu)} este mes</p>
        </div>
      </div>
      <div class="th-cats">${top.length ? top.map(([c, v]) => {
        const p = r.gastos > 0 ? Math.round((v / r.gastos) * 100) : 0;
        return `<div class="th-cat">
          <div class="fila"><span class="fuerte">${U.esc(c)}</span><span>${U.dinero(v)} <span class="texto2">· ${p}%</span></span></div>
          <div class="barra" aria-hidden="true"><span style="width:${p}%"></span></div>
        </div>`;
      }).join('') : '<p class="th-vacio">Sin gastos este mes.</p>'}</div>`;
  }

  function dineroChica() {
    const hoy = U.hoy();
    const r = Dinero.resumenMes(U.mesDe(hoy));
    const hoyGasto = Datos.d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha === hoy).reduce((s, m) => s + m.monto, 0);
    const presu = Datos.d.presupuesto;
    const pct = presu > 0 ? Math.min(100, Math.round((r.gastos / presu) * 100)) : 0;
    return `${cabTarjeta('dinero', 'Dinero')}
      <p class="th-grande">${U.dinero(hoyGasto)}</p>
      <p class="th-sub">gastado hoy</p>
      <div class="barra ${Dinero.colorBarra(r.gastos, presu)}" role="progressbar" aria-label="Presupuesto del mes usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <p class="th-sub">Balance <b class="${r.balance < 0 ? 'rojo' : 'verde'}">${U.dinero(r.balance)}</b></p>`;
  }

  /** Las tres tareas siguientes (las de menos días; 1 día = mañana), con Alta primero y luego Media. */
  function tarjetaManana() {
    const siguientes = Tareas.ordenar(Datos.d.tareas.filter((t) => !t.hecha && Tareas.dias(t) >= 1)).slice(0, 3);
    if (!siguientes.length) return `${cabTarjeta('manana', 'Mañana')}<p class="th-vacio">Nada pendiente en los próximos días.</p>`;
    return `${cabTarjeta('manana', 'Mañana')}
      <ul class="th-lista">${Tareas.porPrioridad(siguientes).map(lineaSiguiente).join('')}</ul>`;
  }

  /** Las dos últimas notas. El "+" abre la ventana "Agregar" con "Nota" elegida. */
  function tarjetaNotas() {
    const ultimas = [...Datos.d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 2);
    const mas = `<button type="button" class="th-agregar" data-accion="nueva-nota" aria-label="Nueva nota"><span>${U.I.mas}</span></button>`;
    return `${cabTarjeta('notas', 'Notas', mas)}
      ${ultimas.length ? ultimas.map((n) => `<div class="th-nota-item"><p class="th-nota">${U.esc(n.texto)}</p><p class="th-cuando">${U.momento(n.fecha)}</p></div>`).join('')
        : '<p class="th-vacio">Aún no tienes notas.</p>'}`;
  }

  const GRANDES = { tareas: tareasGrande, habitos: habitosGrande, dinero: dineroGrande };
  const CHICAS = { tareas: tareasChica, habitos: habitosChica, dinero: dineroChica };
  const FIJAS = { manana: tarjetaManana, notas: tarjetaNotas };

  /** Se mantiene el orden que elegiste; solo cambia el tamaño (grande = todo el ancho). */
  function htmlTarjeta(clave, grande) {
    let tam, html;
    if (ADAPTABLES.includes(clave)) {
      const esGrande = clave === grande;
      tam = esGrande ? 'ancha grande' : 'media';
      html = (esGrande ? GRANDES : CHICAS)[clave]();
    } else {
      tam = ANCHAS.includes(clave) ? 'ancha' : 'media';
      html = FIJAS[clave]();
    }
    return `<section class="tarjeta tarjeta-hoy ${tam}" data-tarjeta="${clave}"
      data-ir="${DESTINO[clave]}" role="link" tabindex="0">${html}</section>`;
  }

  function avisoRespaldo() {
    const ult = Datos.d.ultimoRespaldo;
    const dias = ult ? U.difDias(U.aISO(new Date(ult)), U.hoy()) : null;
    if (dias !== null && dias < 7) return '';
    return `<div class="tarjeta aviso">
        <p class="chico">${dias === null ? 'Aún no respaldas tus datos.' : `Último respaldo: ${U.haceDias(ult)}.`}</p>
        <button type="button" class="btn chico" data-accion="respaldar">Respaldar</button>
      </div>`;
  }

  // ---------- Pintar ----------
  function render(cont) {
    const grande = Datos.seccionGrande();
    cont.innerHTML = `<div class="hoy-rejilla" id="hoy-rejilla">${Datos.orden().map((k) => htmlTarjeta(k, grande)).join('')}</div>${avisoRespaldo()}`;
    const rejilla = cont.querySelector('#hoy-rejilla');

    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion="respaldar"]')) {
        return Copias.exportarArchivo().then(() => { App.refrescar(); U.aviso('Respaldo creado.'); });
      }
      if (e.target.closest('[data-accion="nueva-nota"]')) return agregar('nota'); // el "+" no abre la pantalla
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t) App.ir(t.dataset.ir);
    });
    cont.addEventListener('keydown', (e) => {
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); App.ir(t.dataset.ir); }
    });
    // En Hoy se puede empezar a mover una tarjeta también sobre sus listas (como antes).
    Gestos.ordenable(rejilla, { pantalla: 'hoy', listas: false });
    Gestos.fab(() => agregar(), 'Agregar');
  }

  // ============================================================
  // Ventana "Agregar" (botón "+" de Hoy y "+" de la tarjeta Notas).
  // Guarda con las mismas funciones que usan los formularios de cada pantalla (Datos.agregar…).
  // ============================================================
  const OPCIONES = [
    { id: 'tarea', nombre: 'Tarea' },
    { id: 'habito', nombre: 'Hábito' },
    { id: 'dinero', nombre: 'Dinero' },
    { id: 'nota', nombre: 'Nota' },
    { id: 'meta', nombre: 'Meta' },
  ];
  const AREAS = ['Escuela', 'Trabajo', 'Casa', 'Personal'];
  const DURACION_AVISO = 1800;
  let opcionAgregar = 'tarea';  // se queda la última que elegiste
  let tipoDinero = 'gasto';

  function formAgregar(op) {
    const campoTexto = (id, etiqueta, ph, max) => `<div class="campo">
        <label for="${id}">${etiqueta}</label>
        <input id="${id}" type="text" maxlength="${max}" placeholder="${ph}" autocomplete="off" enterkeyhint="done">
      </div>`;
    switch (op) {
      case 'tarea':
        return `${campoTexto('ag-texto', 'Qué tienes que hacer', 'Ej. Entregar el reporte', 160)}
          <div class="fila2">
            <div class="campo"><label for="ag-tiempo">Tiempo</label>
              <select id="ag-tiempo">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}">${U.plural(n, 'día', 'días')}</option>`).join('')}</select></div>
            <div class="campo"><label for="ag-area">Área</label>
              <select id="ag-area">${AREAS.map((x) => `<option>${x}</option>`).join('')}</select></div>
          </div>
          <fieldset class="segmentado">
            <legend>Prioridad</legend>
            <div class="segmentos">
              ${['Media', 'Alta'].map((p) => `<label><input type="radio" name="ag-prio" value="${p}" ${p === 'Media' ? 'checked' : ''}><span>${p}</span></label>`).join('')}
            </div>
          </fieldset>
          <button class="btn primario ancho" type="submit">Guardar tarea</button>`;
      case 'habito':
        return `${campoTexto('ag-texto', 'Hábito', 'Ej. Caminar 20 minutos', 60)}
          <button class="btn primario ancho" type="submit">Guardar</button>`;
      case 'dinero':
        return `<fieldset class="segmentado">
            <legend class="solo-lector">Tipo de movimiento</legend>
            <div class="segmentos">
              <label><input type="radio" name="ag-tipo" value="gasto" ${tipoDinero === 'gasto' ? 'checked' : ''}><span>Gasto</span></label>
              <label><input type="radio" name="ag-tipo" value="ingreso" ${tipoDinero === 'ingreso' ? 'checked' : ''}><span>Ingreso</span></label>
            </div>
          </fieldset>
          <div class="fila2">
            <div class="campo"><label for="ag-monto">Monto</label>
              <div class="campo-dinero"><span aria-hidden="true">$</span><input id="ag-monto" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div></div>
            <div class="campo"><label for="ag-cat">Categoría</label><select id="ag-cat">${categorias()}</select></div>
          </div>
          ${campoTexto('ag-nota', 'Nota (opcional)', 'Ej. Tacos con amigos', 80)}
          <button class="btn primario ancho" type="submit">Guardar</button>`;
      case 'nota':
        return `<div class="campo"><label for="ag-texto" class="solo-lector">Nota</label>
            <input id="ag-texto" type="text" maxlength="2000" placeholder="Escribe tu nota…" autocomplete="off" enterkeyhint="done"></div>
          <button class="btn primario ancho" type="submit">Guardar</button>`;
      default: // meta
        return `<div class="campo"><label for="ag-texto" class="solo-lector">Meta</label>
            <input id="ag-texto" type="text" maxlength="80" placeholder="Una meta nueva" autocomplete="off" enterkeyhint="done"></div>
          <button class="btn primario ancho" type="submit">Guardar</button>`;
    }
  }
  const categorias = () => (tipoDinero === 'gasto' ? Dinero.CAT_GASTO : Dinero.CAT_INGRESO).map((c) => `<option>${c}</option>`).join('');

  /** Guarda lo del formulario. Regresa el aviso, o null si falta un campo obligatorio. */
  function guardarAgregar(op, f) {
    const texto = (f.querySelector('#ag-texto') || {}).value;
    const t = (texto || '').trim();
    const falta = (sel) => { const el = f.querySelector(sel); if (el) el.focus(); return null; };
    switch (op) {
      case 'tarea':
        if (!t) return falta('#ag-texto');
        Datos.agregarTarea({
          texto: t,
          dias: Number(f.querySelector('#ag-tiempo').value) || 1,
          area: f.querySelector('#ag-area').value,
          prioridad: f.querySelector('input[name="ag-prio"]:checked').value,
        });
        return 'Tarea guardada';
      case 'habito':
        if (!t) return falta('#ag-texto');
        Datos.agregarHabito(t);
        return 'Hábito guardado';
      case 'dinero': {
        const monto = Math.round(Number(f.querySelector('#ag-monto').value) * 100) / 100;
        if (!(monto > 0)) return falta('#ag-monto');
        Datos.agregarMovimiento({ tipo: tipoDinero, monto, categoria: f.querySelector('#ag-cat').value, nota: f.querySelector('#ag-nota').value.trim() });
        return tipoDinero === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado';
      }
      case 'nota':
        if (!t) return falta('#ag-texto');
        Datos.agregarNota(t);
        return 'Nota guardada';
      default:
        if (!t) return falta('#ag-texto');
        Datos.agregarMeta(t);
        return 'Meta guardada';
    }
  }

  /** Abre la ventana "Agregar". Sin "op", se queda con la última opción elegida. */
  function agregar(op) {
    if (op) opcionAgregar = op;
    U.hoja({
      titulo: 'Agregar',
      html: `<div class="ag-opciones" role="group" aria-label="Qué quieres agregar">
          ${OPCIONES.map((o) => `<button type="button" class="ag-op" data-op="${o.id}" aria-pressed="${o.id === opcionAgregar}">${o.nombre}</button>`).join('')}
        </div>
        <form class="form" id="f-agregar" novalidate>${formAgregar(opcionAgregar)}</form>`,
      alAbrir(panel, cerrar) {
        const form = panel.querySelector('#f-agregar');
        panel.querySelector('.ag-opciones').addEventListener('click', (e) => {
          const b = e.target.closest('[data-op]');
          if (!b || b.dataset.op === opcionAgregar) return;
          opcionAgregar = b.dataset.op;
          panel.querySelectorAll('.ag-op').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          form.innerHTML = formAgregar(opcionAgregar);
          const primero = form.querySelector('input[type="text"], input[type="number"]');
          if (primero) primero.focus({ preventScroll: true });
        });
        form.addEventListener('change', (e) => {
          if (e.target.name !== 'ag-tipo') return;
          tipoDinero = e.target.value;
          form.querySelector('#ag-cat').innerHTML = categorias();
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const aviso = guardarAgregar(opcionAgregar, form);
          if (!aviso) return; // falta un campo obligatorio: no se guarda
          cerrar();
          App.refrescar();
          U.aviso(aviso, { duracion: DURACION_AVISO });
        });
      },
    });
  }

  // ============================================================
  // Calendario (se abre al tocar la fecha de arriba)
  // ============================================================
  const DIAS_SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
  const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  /** Cuántas tareas caen en cada día: su fecha guardada (hoy + días de "tiempo de entrega" al crearla). */
  function tareasPorDia() {
    const n = {};
    Datos.d.tareas.forEach((t) => {
      const f = t.fecha || (Number(t.dias) > 0 ? U.sumarDias(U.hoy(), Number(t.dias)) : null);
      if (f) n[f] = (n[f] || 0) + 1;
    });
    return n;
  }

  function abrirCalendario() {
    cerrarCalendario();
    const hoy = U.hoy();
    let sel = hoy;
    let mes = U.mesDe(hoy);
    const conteo = tareasPorDia();
    const antes = document.activeElement;

    const raiz = document.createElement('div');
    raiz.id = 'mp-cal';
    raiz.className = 'cal-velo';
    raiz.innerHTML = `<div class="cal" role="dialog" aria-modal="true" aria-labelledby="cal-t">
        <div class="cal-cab">
          <button type="button" class="btn-icono" data-cal="-1" aria-label="Mes anterior">${U.I.izq}</button>
          <h2 id="cal-t" class="cal-titulo" aria-live="polite"></h2>
          <button type="button" class="btn-icono" data-cal="1" aria-label="Mes siguiente">${U.I.der}</button>
          <button type="button" class="btn-icono cal-x" data-cal="cerrar" aria-label="Cerrar">${U.I.x}</button>
        </div>
        <div class="cal-sem" aria-hidden="true">${DIAS_SEMANA.map((d) => `<span>${d}</span>`).join('')}</div>
        <div class="cal-rejilla" role="grid"></div>
        <div class="cal-pie">
          <div><p class="cal-dia fuerte"></p><p class="cal-n texto2 chico"></p></div>
          <button type="button" class="btn chico" data-cal="hoy">Hoy</button>
        </div>
      </div>`;
    document.body.appendChild(raiz);

    function pintar() {
      raiz.querySelector('.cal-titulo').textContent = U.nombreMes(mes);
      const primero = U.aFecha(`${mes}-01`);
      const hueco = (primero.getDay() + 6) % 7; // la semana empieza en lunes
      let html = '<span></span>'.repeat(hueco);
      for (let i = 1; i <= U.diasEnMes(mes); i++) {
        const f = `${mes}-${String(i).padStart(2, '0')}`;
        const n = conteo[f] || 0;
        const clases = ['cal-d', f === hoy ? 'hoy' : '', f === sel ? 'sel' : ''].join(' ');
        html += `<button type="button" class="${clases}" data-f="${f}" aria-pressed="${f === sel}"
          aria-label="${U.fechaLarga(f)}${f === hoy ? ', hoy' : ''}${n ? `, ${U.plural(n, 'tarea', 'tareas')}` : ''}">${i}${n ? '<span class="cal-punto" aria-hidden="true"></span>' : ''}</button>`;
      }
      raiz.querySelector('.cal-rejilla').innerHTML = html;
      const d = U.aFecha(sel);
      raiz.querySelector('.cal-dia').textContent = `${NOMBRES_DIA[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${U.MESES[d.getMonth()]}`;
      const n = conteo[sel] || 0;
      raiz.querySelector('.cal-n').textContent = n ? U.plural(n, 'tarea', 'tareas') : 'Sin tareas';
    }

    raiz.addEventListener('click', (e) => {
      if (e.target === raiz) return cerrarCalendario();
      const b = e.target.closest('[data-cal], [data-f]');
      if (!b) return;
      if (b.dataset.f) { sel = b.dataset.f; pintar(); return raiz.querySelector(`[data-f="${sel}"]`).focus(); }
      const a = b.dataset.cal;
      if (a === 'cerrar') return cerrarCalendario();
      if (a === 'hoy') { sel = hoy; mes = U.mesDe(hoy); return pintar(); }
      mes = U.sumarMeses(mes, Number(a));
      pintar();
    });
    const teclas = (e) => { if (e.key === 'Escape') cerrarCalendario(); };
    document.addEventListener('keydown', teclas);
    window.addEventListener('hashchange', cerrarCalendario);
    cerrarCal = () => {
      document.removeEventListener('keydown', teclas);
      window.removeEventListener('hashchange', cerrarCalendario);
      raiz.remove();
      if (antes && antes.isConnected && antes.focus) antes.focus({ preventScroll: true });
    };
    pintar();
    raiz.querySelector('.cal-x').focus();
  }
  let cerrarCal = null;
  function cerrarCalendario() { if (cerrarCal) { const c = cerrarCal; cerrarCal = null; c(); } }

  return { titulo: 'Hoy', render, abrirCalendario };
})();
