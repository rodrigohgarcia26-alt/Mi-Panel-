/* ============================================================
   Pantalla HOY: resumen compacto en una cuadrícula de 2 columnas.
   Mantén presionada una tarjeta (~450 ms) y suéltala sobre otra
   para intercambiarlas. El orden se guarda en "mipanel-orden".
   ============================================================ */
'use strict';

const PHoy = (() => {
  const ESPERA_LEVANTAR = 450;   // ms que hay que mantener presionado
  const TOLERANCIA = 10;         // px que se puede mover el dedo antes de que cuente como scroll
  const MAX_LINEAS = 4;          // tareas que caben en la tarjeta de Tareas
  const ANCHAS = ['tareas', 'manana', 'notas'];
  // A dónde lleva cada tarjeta (las notas viven en "Más").
  const DESTINO = { tareas: 'tareas', habitos: 'habitos', dinero: 'dinero', manana: 'tareas', notas: 'mas' };
  let ultimoArrastre = 0;        // para no abrir la pantalla justo después de soltar

  const cabTarjeta = (icono, titulo, extra = '') => `
    <div class="th-cab">
      <span class="th-icono">${U.I[icono]}</span>
      <h2>${titulo}</h2>${extra}
      <span class="th-flecha" aria-hidden="true">›</span>
    </div>`;

  /** Una línea compacta de tarea (solo lectura). */
  function lineaTarea(t, conFecha) {
    const e = conFecha ? Tareas.etiquetaFechaHora(t) : (t.hora ? { texto: U.hora(t.hora), clase: '' } : null);
    return `<li>
      ${t.prioridad === 'Alta' ? '<span class="punto-alta" title="Prioridad alta"></span>' : '<span class="punto-normal"></span>'}
      <span class="t">${U.esc(t.texto)}</span>
      ${e ? `<span class="cuando ${e.clase}">${e.texto}</span>` : ''}
    </li>`;
  }

  // ---------- Tarjetas ----------
  function tarjetaTareas() {
    const g = Tareas.grupos();
    const ts = [...g.atrasadas, ...Tareas.porImportancia(g.hoy)];
    if (!ts.length) return `${cabTarjeta('tareas', 'Tareas')}<p class="th-vacio">Nada pendiente para hoy.</p>`;
    const extra = ts.length - MAX_LINEAS;
    return `${cabTarjeta('tareas', 'Tareas', `<span class="th-n">${ts.length}</span>`)}
      <ul class="th-lista">${ts.slice(0, MAX_LINEAS).map((t) => lineaTarea(t, true)).join('')}</ul>
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

  function tarjetaManana() {
    const manana = U.sumarDias(U.hoy(), 1);
    const ts = Tareas.porImportancia(Datos.d.tareas.filter((t) => !t.hecha && t.fecha === manana));
    if (!ts.length) return `${cabTarjeta('manana', 'Mañana')}<p class="th-vacio">Nada para mañana.</p>`;
    const extra = ts.length - 3;
    return `${cabTarjeta('manana', 'Mañana', `<span class="th-n">${ts.length}</span>`)}
      <ul class="th-lista">${ts.slice(0, 3).map((t) => lineaTarea(t, false)).join('')}</ul>
      ${extra > 0 ? `<p class="th-mas">y ${extra} más</p>` : ''}`;
  }

  function tarjetaNotas() {
    const ultima = [...Datos.d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    return `${cabTarjeta('notas', 'Notas')}
      ${ultima ? `<p class="th-nota">${U.esc(ultima.texto)}</p><p class="th-sub">${U.momento(ultima.fecha)}</p>` : '<p class="th-vacio">Aún no tienes notas.</p>'}
      <form class="nota-rapida" data-accion="nota" novalidate>
        <label for="nota-texto" class="solo-lector">Nota rápida</label>
        <input id="nota-texto" type="text" maxlength="2000" placeholder="Nota rápida…" autocomplete="off" enterkeyhint="done">
        <button type="submit" class="btn primario chico">Guardar</button>
      </form>`;
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

    cont.addEventListener('submit', (e) => {
      if (e.target.matches('[data-accion="nota"]')) { e.preventDefault(); guardarNota(cont); }
    });
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion="respaldar"]')) {
        return Datos.exportar().then(() => { App.refrescar(); U.aviso('Respaldo creado.'); });
      }
      if (e.target.closest('.nota-rapida')) return; // escribir la nota no abre la pantalla
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (!t || Date.now() - ultimoArrastre < 500) return;
      App.ir(t.dataset.ir);
    });
    cont.addEventListener('keydown', (e) => {
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); App.ir(t.dataset.ir); }
    });
    activarArrastre(rejilla);
  }

  function guardarNota(cont) {
    const inp = cont.querySelector('#nota-texto');
    const texto = inp.value.trim();
    if (!texto) { inp.focus(); return U.aviso('Escribe algo antes de guardar.'); }
    Datos.d.notas.push({ id: U.id(), texto, fecha: new Date().toISOString(), ejemplo: false });
    Datos.guardar();
    const el = cont.querySelector('.tarjeta-hoy[data-tarjeta="notas"]');
    if (el) el.innerHTML = tarjetaNotas();
    U.aviso('Nota guardada.');
  }

  // ---------- Mantener presionado y soltar sobre otra tarjeta para intercambiar ----------
  function activarArrastre(rejilla) {
    let s = null; // estado del arrastre actual

    const noArrastrable = (el) => el.closest('input, textarea, select, button, a, label, form');

    rejilla.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.target.closest('.tarjeta-hoy');
      if (!el || noArrastrable(e.target)) return;
      s = { el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, scroll0: window.scrollY, levantada: false, destino: null };
      s.timer = setTimeout(levantar, ESPERA_LEVANTAR);
    });

    function levantar() {
      if (!s) return;
      s.levantada = true;
      s.el.classList.add('levantada');
      rejilla.classList.add('arrastrando');
      try { s.el.setPointerCapture(s.pid); } catch (e) { /* el puntero ya se soltó */ }
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) { /* sin vibración */ } }
      mover();
      autoScroll();
    }

    rejilla.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.pid) return;
      if (!s.levantada) {
        // Si el dedo se mueve antes de tiempo, es un scroll normal: se cancela.
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > TOLERANCIA) cancelar();
        return;
      }
      e.preventDefault();
      s.x = e.clientX; s.y = e.clientY;
      mover();
    });

    function mover() {
      const dx = s.x - s.x0;
      const dy = s.y - s.y0 + (window.scrollY - s.scroll0);
      s.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`;
      // ¿Sobre qué tarjeta está el dedo?
      let destino = null;
      for (const c of rejilla.children) {
        if (c === s.el) continue;
        const r = c.getBoundingClientRect();
        if (s.x >= r.left && s.x <= r.right && s.y >= r.top && s.y <= r.bottom) { destino = c; break; }
      }
      if (destino !== s.destino) {
        if (s.destino) s.destino.classList.remove('destino');
        if (destino) destino.classList.add('destino');
        s.destino = destino;
      }
    }

    // Si el dedo llega a la orilla de la pantalla, se desplaza solo.
    function autoScroll() {
      if (!s || !s.levantada) return;
      const borde = 80;
      const abajo = window.innerHeight - 72; // encima de la barra inferior
      let v = 0;
      if (s.y < borde) v = -Math.ceil((borde - s.y) / 8);
      else if (s.y > abajo - borde) v = Math.ceil((s.y - (abajo - borde)) / 8);
      if (v) { window.scrollBy(0, v); mover(); }
      s.raf = requestAnimationFrame(autoScroll);
    }

    function soltar() {
      const { el, destino } = s;
      cancelAnimationFrame(s.raf);
      rejilla.classList.remove('arrastrando');
      el.classList.remove('levantada');
      el.style.transform = '';
      if (destino) {
        destino.classList.remove('destino');
        const orden = Datos.orden();
        const a = orden.indexOf(el.dataset.tarjeta), b = orden.indexOf(destino.dataset.tarjeta);
        [orden[a], orden[b]] = [orden[b], orden[a]];
        Datos.ponerOrden(orden);
        // Intercambia los elementos en la página sin volver a dibujar todo.
        const marca = document.createComment('');
        rejilla.replaceChild(marca, el);
        rejilla.replaceChild(el, destino);
        rejilla.replaceChild(destino, marca);
        [el, destino].forEach((c) => { c.classList.add('recien'); setTimeout(() => c.classList.remove('recien'), 300); });
      }
      ultimoArrastre = Date.now();
      s = null;
    }
    function cancelar() {
      if (!s) return;
      clearTimeout(s.timer);
      if (s.levantada) return soltar();
      s = null;
    }
    rejilla.addEventListener('pointerup', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    rejilla.addEventListener('pointercancel', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    rejilla.addEventListener('lostpointercapture', (e) => { if (s && s.levantada && e.pointerId === s.pid && e.target === s.el) cancelar(); });

    // Evitar el scroll de la página mientras se arrastra (necesita passive:false).
    rejilla.addEventListener('touchmove', (e) => { if (s && s.levantada) e.preventDefault(); }, { passive: false });
    // Evitar el menú contextual del celular al mantener presionado.
    rejilla.addEventListener('contextmenu', (e) => {
      if ((s && s.levantada) || (e.target.closest('.tarjeta-hoy') && !e.target.closest('input'))) e.preventDefault();
    });
    rejilla.addEventListener('dragstart', (e) => e.preventDefault());
  }

  return { titulo: 'Hoy', render };
})();
