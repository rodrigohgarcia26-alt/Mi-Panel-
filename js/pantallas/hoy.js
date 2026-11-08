/* ============================================================
   Pantalla HOY: resumen en 4 tarjetas que se pueden reordenar
   ============================================================ */
'use strict';

const PHoy = (() => {
  const ESPERA_LEVANTAR = 450;   // ms que hay que mantener presionado
  const TOLERANCIA = 10;         // px que se puede mover el dedo antes de que cuente como scroll
  let ultimoArrastre = 0;        // para no abrir la pantalla justo después de soltar

  // ---------- Cálculos para el resumen ----------
  function resumenTareas() {
    const hoy = U.hoy();
    const pend = Tareas.ordenar(Datos.d.tareas.filter((t) => !t.hecha));
    const hechasHoy = Datos.d.tareas.filter((t) => t.hecha && t.hechaEn && U.aISO(new Date(t.hechaEn)) === hoy).length;
    return { pend, urgente: pend[0], hechasHoy };
  }

  // ---------- Tarjetas ----------
  const cabTarjeta = (icono, titulo, flecha = true) => `
    <div class="th-cab">
      <span class="th-icono">${U.I[icono]}</span>
      <h2>${titulo}</h2>
      ${flecha ? '<span class="th-flecha" aria-hidden="true">›</span>' : ''}
    </div>`;

  function tarjetaTareas() {
    const { pend, urgente, hechasHoy } = resumenTareas();
    let urg = '';
    if (urgente) {
      const e = U.etiquetaFecha(urgente.fecha);
      urg = `<p class="th-urgente"><span class="texto2 chico">Lo más urgente</span>
        <span class="t">${U.esc(urgente.texto)}</span>
        ${e ? `<span class="chico fuerte ${e.clase}">${e.texto}</span>` : '<span class="chico texto2">Sin fecha</span>'}</p>`;
    }
    return `${cabTarjeta('tareas', 'Tareas')}
      <p class="th-grande">${pend.length ? U.plural(pend.length, 'pendiente', 'pendientes') : 'Todo al día'}</p>
      ${urg}
      <p class="th-linea texto2 chico">${hechasHoy ? `${U.plural(hechasHoy, 'tarea hecha', 'tareas hechas')} hoy` : 'Aún no marcas tareas hechas hoy'}</p>`;
  }

  function tarjetaHabitos() {
    const hoy = U.hoy();
    const hab = Datos.d.habitos;
    if (!hab.length) {
      return `${cabTarjeta('habitos', 'Hábitos')}<p class="texto2">Aún no tienes hábitos. Toca para agregar uno.</p>`;
    }
    const hechos = hab.filter((h) => h.dias[hoy]);
    const faltan = hab.filter((h) => !h.dias[hoy]).map((h) => h.nombre);
    const pct = Math.round((hechos.length / hab.length) * 100);
    return `${cabTarjeta('habitos', 'Hábitos')}
      <p class="th-grande">${hechos.length} de ${hab.length} hoy</p>
      <div class="barra verde" role="progressbar" aria-label="Avance de hábitos de hoy" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <p class="th-linea chico ${faltan.length ? 'texto2' : 'verde fuerte'}">${faltan.length ? `Faltan: ${U.esc(faltan.join(', '))}` : '¡Completaste todos tus hábitos de hoy!'}</p>`;
  }

  function tarjetaDinero() {
    const hoy = U.hoy();
    const r = Dinero.resumenMes(U.mesDe(hoy));
    const hoyGasto = Datos.d.movimientos.filter((m) => m.tipo === 'gasto' && m.fecha === hoy).reduce((s, m) => s + m.monto, 0);
    const presu = Datos.d.presupuesto;
    const pct = presu > 0 ? Math.min(100, Math.round((r.gastos / presu) * 100)) : 0;
    const color = Dinero.colorBarra(r.gastos, presu);
    return `${cabTarjeta('dinero', 'Dinero')}
      <p class="th-grande">${U.dinero(hoyGasto)} <span class="texto2" style="font-size:1rem;font-weight:500">gastados hoy</span></p>
      <div class="barra ${color}" role="progressbar" aria-label="Presupuesto del mes usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <div class="th-linea th-sep chico">
        <span class="texto2">Este mes: <b class="${r.gastos > presu ? 'rojo' : ''}">${U.dinero(r.gastos)}</b> de ${U.dinero(presu)}</span>
        <span>Balance: <b class="${r.balance < 0 ? 'rojo' : 'verde'}">${U.dinero(r.balance)}</b></span>
      </div>`;
  }

  function tarjetaNotas() {
    const notas = [...Datos.d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha));
    const [ultima, ...anteriores] = notas;
    return `${cabTarjeta('notas', 'Notas', false)}
      <label for="nota-texto" class="solo-lector">Escribe una nota</label>
      <textarea id="nota-texto" rows="3" maxlength="2000" placeholder="Escribe algo para no olvidarlo…"></textarea>
      <div class="nota-acciones"><button type="button" class="btn primario chico" data-accion="guardar-nota">Guardar</button></div>
      ${ultima ? `<div class="ultima-nota">
          <p class="cuando">Última nota · ${U.momento(ultima.fecha)}</p>
          <p class="txt">${U.esc(ultima.texto)}</p>
        </div>` : '<p class="texto2 chico" style="margin-top:10px">Todavía no guardas notas.</p>'}
      ${anteriores.length ? `<details class="notas-anteriores">
          <summary>Notas anteriores (${anteriores.length})</summary>
          <ul>${anteriores.map((n) => `<li><div><p class="texto2 chico">${U.momento(n.fecha)}</p><p class="txt" style="white-space:pre-wrap;overflow-wrap:anywhere">${U.esc(n.texto)}</p></div>
            <button type="button" class="btn-icono peligro" data-borrar-nota="${n.id}" aria-label="Eliminar nota del ${U.momento(n.fecha)}">${U.I.basura}</button></li>`).join('')}
          </ul></details>` : ''}
      ${ultima ? `<div style="display:flex;justify-content:flex-end"><button type="button" class="btn-texto" data-borrar-nota="${ultima.id}" style="color:var(--rojo)">Eliminar última nota</button></div>` : ''}`;
  }

  const CONSTRUCTORES = { tareas: tarjetaTareas, habitos: tarjetaHabitos, dinero: tarjetaDinero, notas: tarjetaNotas };

  function htmlTarjeta(clave) {
    const abre = clave !== 'notas';
    return `<section class="tarjeta tarjeta-hoy" data-tarjeta="${clave}" ${abre ? `data-ir="${clave}" role="link" tabindex="0" aria-roledescription="tarjeta"` : ''}>${CONSTRUCTORES[clave]()}</section>`;
  }

  function avisoRespaldo() {
    const ult = Datos.d.ultimoRespaldo;
    const dias = ult ? U.difDias(U.aISO(new Date(ult)), U.hoy()) : null;
    if (dias !== null && dias < 7) return '';
    return `<div class="tarjeta aviso">
        <p class="chico">${dias === null ? 'Aún no haces un respaldo de tus datos.' : `Último respaldo: ${U.haceDias(ult)}.`}</p>
        <button type="button" class="btn chico" data-accion="respaldar">Respaldar</button>
      </div>`;
  }

  // ---------- Pintar ----------
  function render(cont) {
    cont.innerHTML = `<div class="hoy-lista" id="hoy-lista">${Datos.d.ordenHoy.map(htmlTarjeta).join('')}</div>${avisoRespaldo()}`;
    const lista = cont.querySelector('#hoy-lista');

    // Abrir la pantalla de cada tarjeta (con dedo, mouse o teclado)
    cont.addEventListener('click', (e) => {
      if (e.target.closest('[data-accion="guardar-nota"]')) return guardarNota(cont);
      const bn = e.target.closest('[data-borrar-nota]');
      if (bn) return borrarNota(bn.dataset.borrarNota);
      if (e.target.closest('[data-accion="respaldar"]')) {
        return Datos.exportar().then(() => { App.refrescar(); U.aviso('Respaldo creado.'); });
      }
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (!t || Date.now() - ultimoArrastre < 500) return;
      App.ir(t.dataset.ir);
    });
    cont.addEventListener('keydown', (e) => {
      const t = e.target.closest('.tarjeta-hoy[data-ir]');
      if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); App.ir(t.dataset.ir); }
    });
    activarArrastre(lista);
  }

  function guardarNota(cont) {
    const ta = cont.querySelector('#nota-texto');
    const texto = ta.value.trim();
    if (!texto) { ta.focus(); return U.aviso('Escribe algo antes de guardar.'); }
    Datos.d.notas.push({ id: U.id(), texto, fecha: new Date().toISOString(), ejemplo: false });
    Datos.guardar();
    repintarTarjeta('notas');
    U.aviso('Nota guardada.');
  }
  function borrarNota(id) {
    const antes = Datos.foto();
    Datos.d.notas = Datos.d.notas.filter((n) => n.id !== id);
    Datos.guardar();
    repintarTarjeta('notas');
    App.conDeshacer('Nota eliminada.', antes);
  }
  function repintarTarjeta(clave) {
    const el = document.querySelector(`.tarjeta-hoy[data-tarjeta="${clave}"]`);
    if (el) el.innerHTML = CONSTRUCTORES[clave]();
  }

  // ---------- Arrastrar para reordenar (dedo y mouse) ----------
  function activarArrastre(lista) {
    let s = null; // estado del arrastre actual

    const noArrastrable = (el) => el.closest('textarea, input, select, button, a, summary, details, label');

    lista.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const el = e.target.closest('.tarjeta-hoy');
      if (!el || noArrastrable(e.target)) return;
      s = { el, pid: e.pointerId, x0: e.clientX, y0: e.clientY, py0: e.clientY + window.scrollY, ultimoY: e.clientY, levantada: false };
      s.timer = setTimeout(levantar, ESPERA_LEVANTAR);
    });

    function levantar() {
      if (!s) return;
      s.levantada = true;
      s.top0 = s.el.offsetTop;
      s.el.classList.add('levantada');
      s.el.style.transform = 'scale(1.03)';
      lista.classList.add('arrastrando');
      try { s.el.setPointerCapture(s.pid); } catch (e) { /* el puntero ya se soltó */ }
      if (navigator.vibrate) { try { navigator.vibrate(25); } catch (e) { /* sin vibración */ } }
      autoScroll();
    }

    lista.addEventListener('pointermove', (e) => {
      if (!s || e.pointerId !== s.pid) return;
      if (!s.levantada) {
        // Si el dedo se mueve antes de tiempo, es un scroll normal: se cancela.
        if (Math.hypot(e.clientX - s.x0, e.clientY - s.y0) > TOLERANCIA) cancelar();
        return;
      }
      e.preventDefault();
      s.ultimoY = e.clientY;
      mover();
    });

    function mover() {
      const yLista = s.ultimoY + window.scrollY - (lista.getBoundingClientRect().top + window.scrollY);
      const hermanos = [...lista.children].filter((c) => c !== s.el);
      // La tarjeta va antes del primer hermano cuyo centro esté debajo del dedo.
      let antesDe = null;
      for (const h of hermanos) {
        if (yLista < h.offsetTop + h.offsetHeight / 2) { antesDe = h; break; }
      }
      if (antesDe !== s.el.nextElementSibling && !(antesDe === null && s.el === lista.lastElementChild)) {
        // Animación suave de las demás tarjetas (técnica FLIP)
        const previas = new Map(hermanos.map((h) => [h, h.offsetTop]));
        // Se mueven las OTRAS tarjetas, nunca la que se arrastra: si se sacara de la página,
        // aunque sea un instante, el navegador le quitaría el dedo y empezaría a hacer scroll.
        const hijos = [...lista.children];
        const iEl = hijos.indexOf(s.el);
        const iDestino = antesDe ? hijos.indexOf(antesDe) : hijos.length;
        if (iDestino < iEl) {
          // Sube: las tarjetas entre el destino y la arrastrada pasan debajo de ella.
          const ref = s.el.nextSibling;
          hijos.slice(iDestino, iEl).forEach((n) => lista.insertBefore(n, ref));
        } else {
          // Baja: las tarjetas entre la arrastrada y el destino pasan arriba de ella.
          hijos.slice(iEl + 1, iDestino).forEach((n) => lista.insertBefore(n, s.el));
        }
        hermanos.forEach((h) => {
          const dy = previas.get(h) - h.offsetTop;
          if (!dy) return;
          h.style.transition = 'none';
          h.style.transform = `translateY(${dy}px)`;
          requestAnimationFrame(() => {
            h.style.transition = 'transform .18s ease';
            h.style.transform = '';
          });
        });
      }
      const dy = (s.ultimoY + window.scrollY - s.py0) - (s.el.offsetTop - s.top0);
      s.el.style.transform = `translateY(${dy}px) scale(1.03)`;
    }

    // Si el dedo llega a la orilla de la pantalla, se desplaza solo.
    function autoScroll() {
      if (!s || !s.levantada) return;
      const borde = 90;
      const abajo = window.innerHeight - 80; // encima de la barra inferior
      let v = 0;
      if (s.ultimoY < borde) v = -Math.ceil((borde - s.ultimoY) / 8);
      else if (s.ultimoY > abajo - borde) v = Math.ceil((s.ultimoY - (abajo - borde)) / 8);
      if (v) { window.scrollBy(0, v); mover(); }
      s.raf = requestAnimationFrame(autoScroll);
    }

    function soltar() {
      const el = s.el;
      cancelAnimationFrame(s.raf);
      el.style.transition = 'transform .18s ease, box-shadow .18s ease';
      el.style.transform = '';
      el.classList.remove('levantada');
      lista.classList.remove('arrastrando');
      setTimeout(() => { el.style.transition = ''; }, 200);
      const orden = [...lista.querySelectorAll('.tarjeta-hoy')].map((t) => t.dataset.tarjeta);
      if (orden.join() !== Datos.d.ordenHoy.join()) { Datos.d.ordenHoy = orden; Datos.guardar(); }
      ultimoArrastre = Date.now();
      s = null;
    }
    function cancelar() {
      if (!s) return;
      clearTimeout(s.timer);
      if (s.levantada) return soltar();
      s = null;
    }
    lista.addEventListener('pointerup', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    lista.addEventListener('pointercancel', (e) => { if (s && e.pointerId === s.pid) cancelar(); });
    // Solo cuenta si la tarjeta misma pierde el puntero. (Con el dedo, el elemento tocado
    // pierde la captura cuando se la pasamos a la tarjeta; eso NO es soltar.)
    lista.addEventListener('lostpointercapture', (e) => { if (s && s.levantada && e.pointerId === s.pid && e.target === s.el) cancelar(); });

    // Evitar el scroll de la página mientras se arrastra (necesita passive:false).
    lista.addEventListener('touchmove', (e) => { if (s && s.levantada) e.preventDefault(); }, { passive: false });
    // Evitar el menú contextual del celular al mantener presionado.
    lista.addEventListener('contextmenu', (e) => {
      if ((s && s.levantada) || (e.target.closest('.tarjeta-hoy') && !e.target.closest('textarea'))) e.preventDefault();
    });
    // Evitar que el navegador intente "arrastrar" texto o imágenes con el mouse.
    lista.addEventListener('dragstart', (e) => e.preventDefault());
  }

  return { titulo: 'Hoy', render };
})();
