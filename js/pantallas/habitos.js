/* ============================================================
   Pantalla HÁBITOS
   ============================================================ */
'use strict';

const PHabitos = (() => {
  const PX_DIA = 14;        // ancho de cada día en la gráfica del mes
  const MESES_MIN = 2;      // la gráfica del mes muestra al menos 2 meses anteriores
  let modo = 'semana';      // gráfica: 'semana' | 'mes'

  /** Días seguidos cumplidos, contando desde hoy (o desde ayer si hoy aún no se marca). */
  function racha(h) {
    let dia = U.hoy();
    if (!h.dias[dia]) dia = U.sumarDias(dia, -1);
    let n = 0;
    while (h.dias[dia]) { n++; dia = U.sumarDias(dia, -1); }
    return n;
  }
  /** Cuántos hábitos se cumplieron ese día. */
  const cumplidos = (f) => Datos.d.habitos.reduce((s, h) => s + (h.dias[f] ? 1 : 0), 0);
  /** Los 7 días que terminan hoy. */
  const ultimos7 = () => Array.from({ length: 7 }, (_, i) => U.sumarDias(U.hoy(), i - 6));

  /** % de la semana (lunes a hoy). */
  function pctSemana() {
    const hoy = U.hoy();
    const hab = Datos.d.habitos;
    if (!hab.length) return 0;
    let posibles = 0, hechos = 0;
    for (let f = U.inicioSemana(hoy); f <= hoy; f = U.sumarDias(f, 1)) { posibles += hab.length; hechos += cumplidos(f); }
    return Math.round((hechos / posibles) * 100);
  }

  // ---------- Pintar ----------
  function render(cont) {
    // Tarjetas que se pueden mover (orden guardado en "mipanel-orden-habitos").
    const piezas = {
      resumen: '<section class="tarjeta resumen-habitos" id="resumen-hab" data-tarjeta="resumen"></section>',
      semana: '<section class="tarjeta" id="tabla-habitos" data-tarjeta="semana" aria-label="Tu semana"></section>',
      grafica: `<details class="tarjeta desplegable" id="d-grafica" data-tarjeta="grafica" open>
        <summary><span class="grupo-titulo">Hábitos cumplidos</span><span class="flecha" aria-hidden="true">›</span></summary>
        <div class="contenido">
          <div class="segmentos grafica-modo" role="group" aria-label="Periodo de la gráfica">
            <button type="button" data-modo="semana">Semana</button>
            <button type="button" data-modo="mes">Mes</button>
          </div>
          <div id="grafica"></div>
          <p class="grafica-info texto2 chico" id="grafica-info" aria-live="polite">Toca la gráfica para ver un día.</p>
        </div>
      </details>`,
    };
    cont.innerHTML = `<div class="pila-tarjetas" id="hab-tarjetas">${Datos.orden('habitos').map((k) => piezas[k]).join('')}</div>`;
    pintar(cont);
    Gestos.ordenable(cont.querySelector('#hab-tarjetas'), { pantalla: 'habitos' });
    Gestos.fab(() => nuevoHabito(cont), 'Nuevo hábito');

    cont.addEventListener('click', (e) => {
      const m = e.target.closest('[data-modo]');
      if (m) { modo = m.dataset.modo; return pintarGrafica(cont); }

      const q = e.target.closest('[data-opciones-habito]');
      if (q) return opcionesHabito(cont, q.dataset.opcionesHabito);

      const c = e.target.closest('[data-h][data-d]');
      if (c) {
        const h = Datos.d.habitos.find((x) => x.id === c.dataset.h);
        if (!h) return;
        const f = c.dataset.d;
        if (h.dias[f]) delete h.dias[f]; else h.dias[f] = true;
        Datos.olvidarMarcaEjemplo(h.id, f);
        Datos.guardar();
        c.setAttribute('aria-pressed', String(!!h.dias[f]));
        const r = cont.querySelector(`[data-racha="${h.id}"]`);
        if (r) r.innerHTML = textoRacha(h);
        pintarResumen(cont);
        pintarGrafica(cont);
      }
    });
  }

  /** Cuadro "Nuevo hábito". */
  function nuevoHabito(cont) {
    U.hoja({
      titulo: 'Nuevo hábito',
      html: `<form class="form" id="f-habito" novalidate>
          <div class="campo">
            <label for="h-nombre">Nombre</label>
            <input id="h-nombre" type="text" maxlength="60" placeholder="Ej. Meditar 5 minutos" autocomplete="off" enterkeyhint="done">
          </div>
          <button class="btn primario ancho" type="submit">Guardar</button>
          <p class="texto2 chico">Para quitar un hábito, toca su nombre en la lista.</p>
        </form>`,
      alAbrir(panel, cerrar) {
        panel.querySelector('#f-habito').addEventListener('submit', (e) => {
          e.preventDefault();
          const inp = panel.querySelector('#h-nombre');
          const nombre = inp.value.trim();
          if (!nombre) { inp.focus(); return U.aviso('Escribe el nombre del hábito.'); }
          Datos.d.habitos.push({ id: U.id(), nombre, dias: {}, creado: new Date().toISOString() });
          Datos.guardar();
          cerrar();
          pintar(cont);
          U.aviso('Hábito agregado.');
        });
      },
    });
  }

  /** Al tocar el nombre de un hábito: opción para quitarlo (con confirmación). */
  function opcionesHabito(cont, id) {
    const h = Datos.d.habitos.find((x) => x.id === id);
    if (!h) return;
    U.hoja({
      titulo: 'Hábito',
      html: `<p class="hoja-texto">${U.esc(h.nombre)}</p>
        <p class="texto2 chico hoja-detalle">${textoRacha(h)}</p>
        <div class="pila"><button type="button" class="btn peligro" data-op="quitar">Quitar hábito</button></div>`,
      alAbrir(panel, cerrar) {
        panel.querySelector('[data-op="quitar"]').addEventListener('click', async () => {
          cerrar();
          const ok = await U.confirmar({
            titulo: '¿Quitar este hábito?',
            mensaje: `Se quitará “${h.nombre}” con todas sus marcas.`,
            aceptar: 'Quitar',
            peligro: true,
          });
          if (!ok) return;
          const antes = Datos.foto();
          Datos.d.habitos = Datos.d.habitos.filter((x) => x.id !== id);
          Datos.guardar();
          pintar(cont);
          App.conDeshacer(`Se quitó “${h.nombre}”.`, antes);
        });
      },
    });
  }

  const textoRacha = (h) => { const n = racha(h); return `Racha: <b>${n}</b> ${n === 1 ? 'día' : 'días'}`; };

  function pintar(cont) {
    pintarResumen(cont);
    pintarSemana(cont);
    pintarGrafica(cont);
  }

  function pintarResumen(cont) {
    const hab = Datos.d.habitos;
    const hoy = U.hoy();
    const el = cont.querySelector('#resumen-hab');
    if (!hab.length) { el.innerHTML = '<p class="vacio">Aún no tienes hábitos. Toca + para agregar uno.</p>'; return; }
    const hechos = cumplidos(hoy);
    const faltan = hab.filter((h) => !h.dias[hoy]).map((h) => U.minus(h.nombre));
    el.innerHTML = `
      ${U.anillo(hechos, hab.length, 76)}
      <div class="resumen-texto">
        <p class="grande">Hoy llevas ${hechos} de ${hab.length}</p>
        <p class="${faltan.length ? 'texto2' : 'verde fuerte'}">${faltan.length ? `Faltan: ${U.esc(U.unirY(faltan))}` : '¡Cumpliste todos!'}</p>
        <p class="texto2 chico">Esta semana: <b class="texto">${pctSemana()}%</b></p>
      </div>`;
  }

  function pintarSemana(cont) {
    const hab = Datos.d.habitos;
    const el = cont.querySelector('#tabla-habitos');
    el.hidden = !hab.length;
    if (!hab.length) return;
    const dias = ultimos7();
    const hoy = U.hoy();
    el.innerHTML = `
      <div class="semana-cab">
        <span></span>
        <div class="rejilla7" aria-hidden="true">${dias.map((d) => `<div class="dia-col ${d === hoy ? 'hoy' : ''}">${U.diaCorto(d)}<b>${U.aFecha(d).getDate()}</b></div>`).join('')}</div>
      </div>
      <ul class="lista">${hab.map((h) => `
        <li class="habito">
          <div class="habito-cab">
            <button type="button" class="habito-nombre" data-opciones-habito="${h.id}" aria-label="${U.esc(h.nombre)}: opciones">${U.esc(h.nombre)}</button>
            <p class="habito-racha" data-racha="${h.id}">${textoRacha(h)}</p>
          </div>
          <div class="rejilla7" role="group" aria-label="Días de ${U.esc(h.nombre)}">${dias.map((d) => `
            <button type="button" class="casilla ${d === hoy ? 'es-hoy' : ''}" data-h="${h.id}" data-d="${d}"
              aria-pressed="${!!h.dias[d]}" aria-label="${U.esc(h.nombre)}, ${U.fechaLarga(d)}${d === hoy ? ' (hoy)' : ''}">
              <span>${U.I.palomita}</span></button>`).join('')}
          </div>
        </li>`).join('')}
      </ul>`;
  }

  // ---------- Gráfica de líneas ----------
  /** Escala vertical: 0 abajo, total de hábitos arriba. */
  const escalaY = (max, arriba, abajo) => (n) => abajo - (n / max) * (abajo - arriba);

  function pintarGrafica(cont) {
    cont.querySelectorAll('[data-modo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
    const g = cont.querySelector('#grafica');
    const info = cont.querySelector('#grafica-info');
    const max = Math.max(1, Datos.d.habitos.length);
    info.textContent = 'Toca la gráfica para ver un día.';
    if (modo === 'semana') graficaSemana(g, info, max); else graficaMes(g, info, max);
  }

  /** Punto con aro del color de la tarjeta, para que se lea sobre la línea. */
  const punto = (x, y, r = 4.5) => `<circle cx="${x}" cy="${y}" r="${r}" class="g-punto"/>`;
  const lineas = (max, x0, x1, y) => {
    const paso = max <= 6 ? 1 : Math.ceil(max / 5);
    let s = '';
    for (let n = 0; n <= max; n += paso) s += `<line x1="${x0}" x2="${x1}" y1="${y(n)}" y2="${y(n)}" class="${n === 0 ? 'g-base' : 'g-rejilla'}"/>`;
    return s;
  };
  const textoDia = (f, n, max) => `${U.cap(U.fechaCorta(f))}: ${n} de ${max} ${max === 1 ? 'hábito' : 'hábitos'}`;

  function graficaSemana(g, info, max) {
    const dias = ultimos7();
    const datos = dias.map((f) => ({ f, n: cumplidos(f) }));
    const W = 340, H = 190, izq = 22, der = 22, arriba = 28, abajo = H - 40;
    const x = (i) => izq + (i * (W - izq - der)) / 6;
    const y = escalaY(max, arriba, abajo);
    const hoy = U.hoy();
    g.innerHTML = `<svg class="grafica-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Hábitos cumplidos en los últimos 7 días: ${datos.map((d) => `${U.diaCorto(d.f)} ${d.n}`).join(', ')}">
      ${lineas(max, izq - 10, W - der + 10, y)}
      <line class="g-cruz" x1="0" x2="0" y1="${arriba - 6}" y2="${abajo}" visibility="hidden"/>
      <polyline class="g-linea" points="${datos.map((d, i) => `${x(i)},${y(d.n)}`).join(' ')}"/>
      ${datos.map((d, i) => `${punto(x(i), y(d.n))}
        <text x="${x(i)}" y="${y(d.n) - 11}" text-anchor="middle" class="g-valor">${d.n}</text>
        <text x="${x(i)}" y="${abajo + 17}" text-anchor="middle" class="g-eje ${d.f === hoy ? 'g-hoy' : ''}">${U.diaCorto(d.f)}</text>
        <text x="${x(i)}" y="${abajo + 32}" text-anchor="middle" class="g-eje g-num ${d.f === hoy ? 'g-hoy' : ''}">${U.aFecha(d.f).getDate()}</text>`).join('')}
    </svg>`;
    const svg = g.querySelector('svg');
    tocar(svg, (px) => {
      const vx = (px / svg.getBoundingClientRect().width) * W;
      const i = Math.max(0, Math.min(6, Math.round(((vx - izq) / (W - izq - der)) * 6)));
      return { i, x: x(i) };
    }, datos, info, max);
  }

  function graficaMes(g, info, max) {
    const hoy = U.hoy();
    // Desde el mes más antiguo con datos (o al menos MESES_MIN meses atrás) hasta hoy.
    let inicio = U.sumarMeses(U.mesDe(hoy), -MESES_MIN) + '-01';
    Datos.d.habitos.forEach((h) => Object.keys(h.dias).forEach((f) => { if (f < inicio) inicio = U.mesDe(f) + '-01'; }));
    const nDias = U.difDias(inicio, hoy) + 1;
    const datos = Array.from({ length: nDias }, (_, i) => { const f = U.sumarDias(inicio, i); return { f, n: cumplidos(f) }; });

    const H = 210, arriba = 48, abajo = H - 26, margen = 12;
    // Espacio a la derecha para que quepa el nombre del mes si hoy es principio de mes.
    const der = Math.max(margen, 84 - (U.aFecha(hoy).getDate() - 1) * PX_DIA);
    const W = margen + der + (nDias - 1) * PX_DIA;
    const x = (i) => margen + i * PX_DIA;
    const y = escalaY(max, arriba, abajo);

    // Inicio de cada mes: nombre y promedio al día (hasta hoy si es el mes actual).
    let meses = '';
    datos.forEach((d, i) => {
      if (!d.f.endsWith('-01')) return;
      const mes = U.mesDe(d.f);
      const delMes = datos.filter((o) => U.mesDe(o.f) === mes);
      const prom = delMes.reduce((s, o) => s + o.n, 0) / delMes.length;
      meses += `<line x1="${x(i)}" x2="${x(i)}" y1="6" y2="${abajo}" class="g-mes"/>
        <text x="${x(i) + 6}" y="18" class="g-mes-nombre">${U.cap(U.MESES[Number(mes.slice(5)) - 1])}</text>
        <text x="${x(i) + 6}" y="34" class="g-eje">${prom.toFixed(1).replace('.0', '')} al día</text>`;
    });
    // Números de día cada semana, para ubicarse.
    const ejes = datos.map((d, i) => {
      const dia = U.aFecha(d.f).getDate();
      return [1, 8, 15, 22, 29].includes(dia) || d.f === hoy ? `<text x="${x(i)}" y="${abajo + 17}" text-anchor="middle" class="g-eje ${d.f === hoy ? 'g-hoy' : ''}">${d.f === hoy ? 'hoy' : dia}</text>` : '';
    }).join('');
    const ultimo = datos[datos.length - 1];

    const ejeY = (() => {
      const paso = max <= 6 ? 1 : Math.ceil(max / 5);
      let s = '';
      for (let n = 0; n <= max; n += paso) s += `<text x="20" y="${y(n)}" dy=".35em" text-anchor="end" class="g-eje">${n}</text>`;
      return `<svg class="grafica-ejey" width="26" height="${H}" aria-hidden="true">${s}</svg>`;
    })();

    g.innerHTML = `<div class="grafica-mes">${ejeY}
      <div class="grafica-desliza" tabindex="0" aria-label="Desliza a los lados para ver meses anteriores">
        <svg class="grafica-svg" width="${W}" height="${H}" role="img" aria-label="Hábitos cumplidos por día desde ${U.fechaLarga(inicio)} hasta hoy">
          ${lineas(max, 0, W, y)}${meses}
          <line class="g-cruz" x1="0" x2="0" y1="${arriba - 6}" y2="${abajo}" visibility="hidden"/>
          <polyline class="g-linea" points="${datos.map((d, i) => `${x(i)},${y(d.n)}`).join(' ')}"/>
          ${punto(x(nDias - 1), y(ultimo.n))}
          ${ejes}
        </svg>
      </div></div>`;
    // Abre en el día de hoy (al final).
    const desliza = g.querySelector('.grafica-desliza');
    requestAnimationFrame(() => { desliza.scrollLeft = desliza.scrollWidth; });
    const svg = g.querySelector('.grafica-svg');
    tocar(svg, (px) => {
      const i = Math.max(0, Math.min(nDias - 1, Math.round((px - margen) / PX_DIA)));
      return { i, x: x(i) };
    }, datos, info, max);
  }

  /** Al tocar la gráfica: línea vertical en el día más cercano y su dato abajo. */
  function tocar(svg, buscar, datos, info, max) {
    const cruz = svg.querySelector('.g-cruz');
    let x0 = 0;
    svg.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    svg.addEventListener('click', (e) => {
      if (Math.abs(e.clientX - x0) > 8) return; // fue un deslizamiento, no un toque
      const { i, x } = buscar(e.clientX - svg.getBoundingClientRect().left);
      cruz.setAttribute('x1', x); cruz.setAttribute('x2', x);
      cruz.setAttribute('visibility', 'visible');
      info.textContent = textoDia(datos[i].f, datos[i].n, max);
    });
  }

  return { titulo: 'Hábitos', render, racha };
})();
