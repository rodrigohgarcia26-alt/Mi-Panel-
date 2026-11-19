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

  /** Las dos últimas notas. El "+" abre "Nueva nota". */
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
        return Datos.exportar().then(() => { App.refrescar(); U.aviso('Respaldo creado.'); });
      }
      if (e.target.closest('[data-accion="nueva-nota"]')) return nuevaNota(cont); // el "+" no abre la pantalla
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t) App.ir(t.dataset.ir);
    });
    cont.addEventListener('keydown', (e) => {
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); App.ir(t.dataset.ir); }
    });
    // En Hoy se puede empezar a mover una tarjeta también sobre sus listas (como antes).
    Gestos.ordenable(rejilla, { pantalla: 'hoy', listas: false });
  }

  /** Cuadro "Nueva nota". */
  function nuevaNota(cont) {
    U.hoja({
      titulo: 'Nueva nota',
      html: `<form class="form" id="f-nota" novalidate>
          <div class="campo">
            <label for="nota-texto" class="solo-lector">Nota</label>
            <input id="nota-texto" type="text" maxlength="2000" placeholder="Escribe tu nota…" autocomplete="off" enterkeyhint="done">
          </div>
          <button type="submit" class="btn primario ancho">Guardar</button>
        </form>`,
      alAbrir(panel, cerrar) {
        panel.querySelector('#f-nota').addEventListener('submit', (e) => {
          e.preventDefault();
          const inp = panel.querySelector('#nota-texto');
          const texto = inp.value.trim();
          if (!texto) { inp.focus(); return U.aviso('Escribe algo antes de guardar.'); }
          Datos.d.notas.push({ id: U.id(), texto, fecha: new Date().toISOString(), ejemplo: false });
          Datos.guardar();
          cerrar();
          const el = cont.querySelector('.tarjeta-hoy[data-tarjeta="notas"]');
          if (el) el.innerHTML = tarjetaNotas();
          U.aviso('Nota guardada.');
        });
      },
    });
  }

  return { titulo: 'Hoy', render };
})();
