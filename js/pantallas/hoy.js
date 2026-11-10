/* ============================================================
   Pantalla HOY: resumen compacto en una cuadrícula de 2 columnas.
   Mantén presionada una tarjeta (~450 ms) y suéltala sobre otra
   para intercambiarlas (js/gestos.js). El orden se guarda en "mipanel-orden".
   ============================================================ */
'use strict';

const PHoy = (() => {
  const MAX_LINEAS = 4;          // tareas que caben en la tarjeta de Tareas
  const ANCHAS = ['tareas', 'manana', 'notas'];
  // A dónde lleva cada tarjeta (las notas viven en "Más").
  const DESTINO = { tareas: 'tareas', habitos: 'habitos', dinero: 'dinero', manana: 'tareas', notas: 'mas' };

  const cabTarjeta = (icono, titulo, extra = '') => `
    <div class="th-cab">
      <span class="th-icono">${U.I[icono]}</span>
      <h2>${titulo}</h2>${extra}
      <span class="th-flecha" aria-hidden="true">›</span>
    </div>`;

  /** Una línea compacta de tarea (solo lectura): punto de prioridad, texto y tiempo. */
  function lineaTarea(t) {
    const e = Tareas.tiempo(t);
    return `<li>
      ${t.prioridad === 'Alta' ? '<span class="punto-alta" title="Prioridad alta"></span>' : '<span class="punto-normal"></span>'}
      <span class="t">${U.esc(t.texto)}</span>
      <span class="cuando ${e.clase}">${e.texto}</span>
    </li>`;
  }
  /** Línea de "Mañana": texto, prioridad (Alta/Media) y días que faltan. Sin horas. */
  function lineaSiguiente(t) {
    return `<li>
      <span class="t">${U.esc(t.texto)}</span>
      ${Tareas.htmlPrioridad(t)}
      <span class="cuando">${Tareas.tiempo(t).texto}</span>
    </li>`;
  }

  // ---------- Tarjetas ----------
  function tarjetaTareas() {
    const g = Tareas.grupos();
    const ts = [...g.atrasadas, ...Tareas.porPrioridad(g.hoy)];
    if (!ts.length) return `${cabTarjeta('tareas', 'Tareas')}<p class="th-vacio">Nada pendiente para hoy.</p>`;
    const extra = ts.length - MAX_LINEAS;
    return `${cabTarjeta('tareas', 'Tareas', `<span class="th-n">${ts.length}</span>`)}
      <ul class="th-lista">${ts.slice(0, MAX_LINEAS).map(lineaTarea).join('')}</ul>
      ${extra > 0 ? `<p class="th-mas">y ${extra} más</p>` : ''}`;
  }

  function tarjetaHabitos() {
    const hoy = U.hoy();
    const hab = Datos.d.habitos;
    if (!hab.length) return `${cabTarjeta('habitos', 'Hábitos')}<p class="th-vacio">Agrega tu primer hábito.</p>`;
    const hechos = hab.filter((h) => h.dias[hoy]).length;
    const faltan = hab.filter((h) => !h.dias[hoy]).map((h) => U.minus(h.nombre));
    return `${cabTarjeta('habitos', 'Hábitos')}
      <div class="th-anillo">${U.anillo(hechos, hab.length, 60)}</div>
      <p class="th-faltan ${faltan.length ? '' : 'verde fuerte'}">${faltan.length ? `Faltan: ${U.esc(U.unirY(faltan))}` : '¡Todos listos!'}</p>`;
  }

  function tarjetaDinero() {
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

  const CONSTRUCTORES = { tareas: tarjetaTareas, habitos: tarjetaHabitos, dinero: tarjetaDinero, manana: tarjetaManana, notas: tarjetaNotas };


  function htmlTarjeta(clave) {
    return `<section class="tarjeta tarjeta-hoy ${ANCHAS.includes(clave) ? 'ancha' : 'media'}" data-tarjeta="${clave}"
      data-ir="${DESTINO[clave]}" role="link" tabindex="0">${CONSTRUCTORES[clave]()}</section>`;
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
    cont.innerHTML = `<div class="hoy-rejilla" id="hoy-rejilla">${Datos.orden().map(htmlTarjeta).join('')}</div>${avisoRespaldo()}`;
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
