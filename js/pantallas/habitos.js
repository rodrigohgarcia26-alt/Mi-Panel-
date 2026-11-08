/* ============================================================
   Pantalla HÁBITOS
   ============================================================ */
'use strict';

const PHabitos = (() => {
  let semanasAtras = 0; // 0 = los 7 días que terminan hoy

  /** Días seguidos cumplidos, contando desde hoy (o desde ayer si hoy aún no se marca). */
  function racha(h) {
    let dia = U.hoy();
    if (!h.dias[dia]) dia = U.sumarDias(dia, -1);
    let n = 0;
    while (h.dias[dia]) { n++; dia = U.sumarDias(dia, -1); }
    return n;
  }
  /** Porcentaje de los últimos 30 días (incluyendo hoy) en que se cumplió. */
  function pct30(h) {
    const hoy = U.hoy();
    let n = 0;
    for (let i = 0; i < 30; i++) if (h.dias[U.sumarDias(hoy, -i)]) n++;
    return Math.round((n / 30) * 100);
  }

  function diasVisibles() {
    const fin = U.sumarDias(U.hoy(), -7 * semanasAtras);
    return Array.from({ length: 7 }, (_, i) => U.sumarDias(fin, i - 6));
  }

  function render(cont) {
    cont.innerHTML = `
      <div class="tarjeta navegador" id="nav-semana"></div>
      <div class="tarjeta" id="tabla-habitos"></div>
      <form class="tarjeta form" id="f-habito" novalidate>
        <div class="campo">
          <label for="h-nombre">Nuevo hábito</label>
          <div class="form-linea">
            <input id="h-nombre" type="text" maxlength="60" placeholder="Ej. Meditar 5 minutos" autocomplete="off" enterkeyhint="done">
            <button class="btn primario" type="submit">Agregar</button>
          </div>
        </div>
      </form>`;
    pintar(cont);

    cont.querySelector('#f-habito').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = cont.querySelector('#h-nombre');
      const nombre = inp.value.trim();
      if (!nombre) { inp.focus(); return U.aviso('Escribe el nombre del hábito.'); }
      Datos.d.habitos.push({ id: U.id(), nombre, dias: {}, creado: new Date().toISOString() });
      Datos.guardar();
      inp.value = '';
      pintar(cont);
      U.aviso('Hábito agregado.');
    });

    cont.addEventListener('click', (e) => {
      const nav = e.target.closest('[data-semana]');
      if (nav && !nav.disabled) {
        semanasAtras = Math.max(0, semanasAtras + Number(nav.dataset.semana));
        return pintar(cont);
      }
      const c = e.target.closest('[data-h][data-d]');
      if (c && !c.disabled) {
        const h = Datos.d.habitos.find((x) => x.id === c.dataset.h);
        if (!h) return;
        const f = c.dataset.d;
        if (h.dias[f]) delete h.dias[f]; else h.dias[f] = true;
        Datos.olvidarMarcaEjemplo(h.id, f);
        Datos.guardar();
        // Solo se actualiza este hábito para que se sienta rápido.
        c.setAttribute('aria-pressed', String(!!h.dias[f]));
        const datos = cont.querySelector(`[data-datos="${h.id}"]`);
        if (datos) datos.textContent = textoDatos(h);
        return;
      }
      const x = e.target.closest('[data-eliminar]');
      if (x) {
        const antes = Datos.foto();
        const h = Datos.d.habitos.find((y) => y.id === x.dataset.eliminar);
        Datos.d.habitos = Datos.d.habitos.filter((y) => y.id !== x.dataset.eliminar);
        Datos.guardar();
        pintar(cont);
        App.conDeshacer(`Se eliminó “${h ? h.nombre : 'el hábito'}”.`, antes);
      }
    });
  }

  const textoDatos = (h) => `Racha de ${U.plural(racha(h), 'día', 'días')} · ${pct30(h)}% en 30 días`;

  function pintar(cont) {
    const dias = diasVisibles();
    const hoy = U.hoy();
    cont.querySelector('#nav-semana').innerHTML = `
      <button type="button" class="btn-icono" data-semana="1" aria-label="Semana anterior">${U.I.izq}</button>
      <p class="navegador-titulo" aria-live="polite">${semanasAtras === 0 ? 'Últimos 7 días' : `Hace ${U.plural(semanasAtras, 'semana', 'semanas')}`}<small>${U.rango(dias[0], dias[6])}</small></p>
      <button type="button" class="btn-icono" data-semana="-1" aria-label="Semana siguiente" ${semanasAtras === 0 ? 'disabled' : ''}>${U.I.der}</button>`;

    const hab = Datos.d.habitos;
    const cabeceraDias = `<div class="rejilla7 dias-fila" aria-hidden="true">${dias.map((d) => `
      <div class="dia-col ${d === hoy ? 'hoy' : ''}">${U.diaCorto(d)}<b>${U.aFecha(d).getDate()}</b></div>`).join('')}</div>`;

    cont.querySelector('#tabla-habitos').innerHTML = hab.length ? `${cabeceraDias}
      <ul class="lista">${hab.map((h) => `
        <li class="habito">
          <div class="habito-cab">
            <div>
              <p class="habito-nombre">${U.esc(h.nombre)}</p>
              <p class="habito-datos" data-datos="${h.id}">${textoDatos(h)}</p>
            </div>
            <button type="button" class="btn-icono peligro" data-eliminar="${h.id}" aria-label="Eliminar hábito: ${U.esc(h.nombre)}">${U.I.x}</button>
          </div>
          <div class="rejilla7" role="group" aria-label="Días de ${U.esc(h.nombre)}">${dias.map((d) => `
            <button type="button" class="casilla ${d === hoy ? 'es-hoy' : ''}" data-h="${h.id}" data-d="${d}"
              aria-pressed="${!!h.dias[d]}" aria-label="${U.esc(h.nombre)}, ${U.fechaLarga(d)}${d === hoy ? ' (hoy)' : ''}" ${d > hoy ? 'disabled' : ''}>
              <span>${U.I.palomita}</span></button>`).join('')}
          </div>
        </li>`).join('')}
      </ul>` : '<p class="vacio">Aún no tienes hábitos. Agrega uno abajo.</p>';
  }

  return { titulo: 'Hábitos', render, racha };
})();
