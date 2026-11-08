/* ============================================================
   Pantalla MÁS: notas, revisión de la semana y metas
   ============================================================ */
'use strict';

const PMas = (() => {
  const ANIMOS = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'];
  let semanasAtras = 0;
  let timerGuardar = null;

  const lunesActual = () => U.sumarDias(U.inicioSemana(U.hoy()), -7 * semanasAtras);

  function estadisticas(lunes) {
    const domingo = U.sumarDias(lunes, 6);
    const hoy = U.hoy();
    const enRango = (f) => f >= lunes && f <= domingo;
    const d = Datos.d;

    const tareasHechas = d.tareas.filter((t) => t.hecha && t.hechaEn && enRango(U.aISO(new Date(t.hechaEn)))).length;

    // Hábitos: solo se cuentan los días que ya pasaron (no los futuros)
    const ultimo = domingo < hoy ? domingo : hoy;
    let posibles = 0, cumplidos = 0;
    if (lunes <= hoy) {
      for (let f = lunes; f <= ultimo; f = U.sumarDias(f, 1)) {
        d.habitos.forEach((h) => { posibles++; if (h.dias[f]) cumplidos++; });
      }
    }
    const pctHabitos = posibles ? Math.round((cumplidos / posibles) * 100) : null;

    const gastado = d.movimientos.filter((m) => m.tipo === 'gasto' && enRango(m.fecha)).reduce((s, m) => s + m.monto, 0);

    const animos = Object.entries(d.animo).filter(([f]) => enRango(f)).map(([, v]) => v);
    const animo = animos.length ? (animos.reduce((s, v) => s + v, 0) / animos.length) : null;

    return { domingo, tareasHechas, pctHabitos, gastado, animo, nAnimos: animos.length };
  }

  function render(cont) {
    cont.innerHTML = `
      <section class="tarjeta" aria-labelledby="t-notas">
        <h2 id="t-notas">Notas</h2>
        <form class="nota-rapida" id="f-nota" novalidate>
          <label for="nota-nueva" class="solo-lector">Nota rápida</label>
          <input id="nota-nueva" type="text" maxlength="2000" placeholder="Nota rápida…" autocomplete="off" enterkeyhint="done">
          <button type="submit" class="btn primario chico">Guardar</button>
        </form>
        <ul class="lista notas-lista" id="notas"></ul>
      </section>
      <section class="tarjeta" aria-labelledby="t-rev">
        <h2 id="t-rev">Revisión de la semana</h2>
        <div class="navegador" id="nav-rev" style="padding:0 0 10px"></div>
        <div id="rev-datos"></div>
      </section>
      <section class="tarjeta" aria-labelledby="t-metas">
        <h2 id="t-metas">Metas</h2>
        <ul class="lista" id="metas"></ul>
        <form class="form" id="f-meta" novalidate style="margin-top:10px">
          <div class="campo">
            <label for="meta-nombre">Nueva meta</label>
            <div class="form-linea">
              <input id="meta-nombre" type="text" maxlength="80" placeholder="Ej. Ahorrar para una laptop" autocomplete="off" enterkeyhint="done">
              <button class="btn primario" type="submit">Agregar</button>
            </div>
          </div>
        </form>
      </section>`;
    pintarRevision(cont);
    pintarMetas(cont);
    pintarNotas(cont);

    cont.querySelector('#f-nota').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = cont.querySelector('#nota-nueva');
      const texto = inp.value.trim();
      if (!texto) { inp.focus(); return U.aviso('Escribe algo antes de guardar.'); }
      Datos.d.notas.push({ id: U.id(), texto, fecha: new Date().toISOString(), ejemplo: false });
      Datos.guardar();
      inp.value = '';
      pintarNotas(cont);
      U.aviso('Nota guardada.');
    });

    cont.addEventListener('click', (e) => {
      const bn = e.target.closest('[data-borrar-nota]');
      if (bn) {
        const antes = Datos.foto();
        Datos.d.notas = Datos.d.notas.filter((n) => n.id !== bn.dataset.borrarNota);
        Datos.guardar();
        pintarNotas(cont);
        return App.conDeshacer('Nota borrada.', antes);
      }

      const n = e.target.closest('[data-semana]');
      if (n && !n.disabled) { semanasAtras = Math.max(0, semanasAtras + Number(n.dataset.semana)); return pintarRevision(cont); }

      const a = e.target.closest('[data-animo]');
      if (a) {
        const v = Number(a.dataset.animo);
        const hoy = U.hoy();
        if (Datos.d.animo[hoy] === v) delete Datos.d.animo[hoy]; else Datos.d.animo[hoy] = v;
        Datos.guardar();
        return pintarRevision(cont);
      }

      const x = e.target.closest('[data-eliminar-meta]');
      if (x) {
        const antes = Datos.foto();
        Datos.d.metas = Datos.d.metas.filter((m) => m.id !== x.dataset.eliminarMeta);
        Datos.guardar();
        pintarMetas(cont);
        App.conDeshacer('Meta eliminada.', antes);
      }
    });

    // Textos de la revisión: se guardan solos mientras escribes
    cont.addEventListener('input', (e) => {
      const campo = e.target.dataset.rev;
      if (campo) {
        const lunes = lunesActual();
        const rev = Datos.d.revisiones[lunes] || (Datos.d.revisiones[lunes] = { bien: '', mejorar: '' });
        rev[campo] = e.target.value;
        clearTimeout(timerGuardar);
        const marca = cont.querySelector('#rev-guardado');
        if (marca) marca.textContent = 'Guardando…';
        timerGuardar = setTimeout(() => {
          Datos.guardar();
          const m = cont.querySelector('#rev-guardado');
          if (m) m.textContent = 'Guardado ✓';
        }, 500);
        return;
      }
      if (e.target.matches('[data-meta]')) {
        const v = e.target.value;
        e.target.style.setProperty('--v', v + '%');
        e.target.setAttribute('aria-valuetext', v + '%');
        const pct = cont.querySelector(`[data-pct="${e.target.dataset.meta}"]`);
        if (pct) pct.textContent = v + '%';
      }
    });
    cont.addEventListener('change', (e) => {
      if (e.target.matches('[data-meta]')) {
        const m = Datos.d.metas.find((x) => x.id === e.target.dataset.meta);
        if (m) { m.avance = Number(e.target.value); Datos.guardar(); }
        if (m && m.avance === 100) U.aviso(`¡Lograste tu meta “${m.nombre}”!`);
      }
    });

    cont.querySelector('#f-meta').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = cont.querySelector('#meta-nombre');
      const nombre = inp.value.trim();
      if (!nombre) { inp.focus(); return U.aviso('Escribe el nombre de la meta.'); }
      Datos.d.metas.push({ id: U.id(), nombre, avance: 0 });
      Datos.guardar();
      inp.value = '';
      pintarMetas(cont);
      U.aviso('Meta agregada.');
    });
  }

  function pintarRevision(cont) {
    // Si había texto pendiente de guardar, se guarda antes de cambiar de semana.
    if (timerGuardar) { clearTimeout(timerGuardar); timerGuardar = null; Datos.guardar(); }
    const lunes = lunesActual();
    const s = estadisticas(lunes);
    const rev = Datos.d.revisiones[lunes] || { bien: '', mejorar: '' };
    const animoHoy = Datos.d.animo[U.hoy()];

    cont.querySelector('#nav-rev').innerHTML = `
      <button type="button" class="btn-icono" data-semana="1" aria-label="Semana anterior">${U.I.izq}</button>
      <p class="navegador-titulo" aria-live="polite">${semanasAtras === 0 ? 'Esta semana' : semanasAtras === 1 ? 'Semana pasada' : `Hace ${semanasAtras} semanas`}<small>${U.rango(lunes, s.domingo)}</small></p>
      <button type="button" class="btn-icono" data-semana="-1" aria-label="Semana siguiente" ${semanasAtras === 0 ? 'disabled' : ''}>${U.I.der}</button>`;

    cont.querySelector('#rev-datos').innerHTML = `
      <div class="rejilla2">
        <div class="cuadro"><span class="etiqueta">Tareas hechas</span><p class="valor">${s.tareasHechas}</p></div>
        <div class="cuadro"><span class="etiqueta">Hábitos cumplidos</span><p class="valor">${s.pctHabitos === null ? '—' : s.pctHabitos + '%'}</p></div>
        <div class="cuadro"><span class="etiqueta">Dinero gastado</span><p class="valor">${U.dinero(s.gastado)}</p></div>
        <div class="cuadro"><span class="etiqueta">Ánimo promedio</span><p class="valor">${s.animo === null ? '—' : s.animo.toFixed(1).replace('.0', '') + ' <span class="texto2 chico">de 5</span>'}</p></div>
      </div>
      ${semanasAtras === 0 ? `
        <p class="etiqueta" style="margin:14px 0 6px" id="t-animo">¿Cómo te sientes hoy?</p>
        <div class="animo" role="group" aria-labelledby="t-animo">
          ${ANIMOS.map((nombre, i) => `<button type="button" data-animo="${i + 1}" aria-pressed="${animoHoy === i + 1}" aria-label="${i + 1} de 5: ${nombre}"><b>${i + 1}</b><small>${nombre}</small></button>`).join('')}
        </div>` : ''}
      <div class="campo" style="margin-top:14px">
        <label for="rev-bien">Qué salió bien</label>
        <textarea id="rev-bien" data-rev="bien" rows="3" maxlength="2000" placeholder="Algo de lo que estés orgulloso esta semana…">${U.esc(rev.bien)}</textarea>
      </div>
      <div class="campo" style="margin-top:10px">
        <label for="rev-mejorar">Qué quiero mejorar</label>
        <textarea id="rev-mejorar" data-rev="mejorar" rows="3" maxlength="2000" placeholder="Algo que quieras hacer distinto…">${U.esc(rev.mejorar)}</textarea>
      </div>
      <p class="guardado" id="rev-guardado" aria-live="polite"></p>`;
  }

  function pintarNotas(cont) {
    const notas = [...Datos.d.notas].sort((a, b) => b.fecha.localeCompare(a.fecha));
    cont.querySelector('#notas').innerHTML = notas.length ? notas.map((n) => `
      <li class="nota">
        <div><p class="txt">${U.esc(n.texto)}</p><p class="texto2 chico">${U.momento(n.fecha)}</p></div>
        <button type="button" class="btn-icono quitar" data-borrar-nota="${n.id}" aria-label="Borrar nota del ${U.momento(n.fecha)}">${U.I.x}</button>
      </li>`).join('') : '<li class="vacio">Aún no tienes notas.</li>';
  }

  function pintarMetas(cont) {
    const metas = Datos.d.metas;
    cont.querySelector('#metas').innerHTML = metas.length ? metas.map((m) => `
      <li class="meta">
        <div class="meta-cab">
          <span class="t" id="meta-t-${m.id}">${U.esc(m.nombre)}</span>
          <span class="pct" data-pct="${m.id}">${m.avance}%</span>
          <button type="button" class="btn-icono peligro" data-eliminar-meta="${m.id}" aria-label="Eliminar meta: ${U.esc(m.nombre)}">${U.I.basura}</button>
        </div>
        <input type="range" min="0" max="100" step="5" value="${m.avance}" data-meta="${m.id}" style="--v:${m.avance}%" aria-labelledby="meta-t-${m.id}" aria-valuetext="${m.avance}%">
      </li>`).join('') : '<li class="vacio">Agrega una meta y mueve la barra conforme avances.</li>';
  }

  return { titulo: 'Más', render };
})();
