/* ============================================================
   Pantalla DINERO
   ============================================================ */
'use strict';

/** Cálculos de dinero que también usa la pantalla Hoy. */
const Dinero = (() => {
  function delMes(mes) { return Datos.d.movimientos.filter((m) => U.mesDe(m.fecha) === mes); }
  function resumenMes(mes) {
    const movs = delMes(mes);
    const ingresos = movs.filter((m) => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const gastos = movs.filter((m) => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
    return { movs, ingresos, gastos, balance: ingresos - gastos };
  }
  /** Color de la barra del presupuesto: normal, ámbar arriba del 80 %, rojo si se pasó. */
  function colorBarra(gastado, presupuesto) {
    if (presupuesto <= 0) return '';
    const r = gastado / presupuesto;
    return r > 1 ? 'rojo' : r >= 0.8 ? 'ambar' : '';
  }
  return { delMes, resumenMes, colorBarra };
})();

const PDinero = (() => {
  const CAT_GASTO = ['Comida', 'Transporte', 'Escuela', 'Ocio', 'Casa', 'Salud', 'Otros'];
  const CAT_INGRESO = ['Familia', 'Beca', 'Trabajo', 'Ventas', 'Otros'];
  let mes = null;
  let tipo = 'gasto';

  function render(cont) {
    mes = U.mesDe(U.hoy()); // siempre abre en el mes actual
    // La tarjeta del mes (con las flechas) queda fija arriba; las demás se pueden mover
    // (orden guardado en "mipanel-orden-dinero").
    const piezas = {
      resumen: '<div class="resumen3" id="resumen" data-tarjeta="resumen"></div>',
      presupuesto: `<section class="tarjeta" data-tarjeta="presupuesto" aria-labelledby="t-presu">
        <div class="presu-cab">
          <h2 id="t-presu">Presupuesto del mes</h2>
          <div class="campo-dinero"><span aria-hidden="true">$</span>
            <input id="presupuesto" type="number" inputmode="decimal" min="0" step="any" value="${Datos.d.presupuesto}" aria-label="Monto del presupuesto mensual en pesos"></div>
        </div>
        <div id="presu-detalle"></div>
      </section>`,
      categorias: '<section class="tarjeta" data-tarjeta="categorias" aria-labelledby="t-cat"><h2 id="t-cat">En qué se va el dinero</h2><div id="categorias"></div></section>',
      movimientos: '<section class="tarjeta" data-tarjeta="movimientos" aria-labelledby="t-movs"><h2 id="t-movs">Movimientos del mes</h2><ul class="lista" id="movimientos"></ul></section>',
    };
    cont.innerHTML = `
      <div class="tarjeta navegador" id="nav-mes"></div>
      <div class="pila-tarjetas" id="din-tarjetas">${Datos.orden('dinero').map((k) => piezas[k]).join('')}</div>`;

    pintar(cont);
    Gestos.ordenable(cont.querySelector('#din-tarjetas'), { pantalla: 'dinero' });
    Gestos.fab(() => nuevoMovimiento(cont), 'Nuevo movimiento');

    cont.querySelector('#presupuesto').addEventListener('change', (e) => {
      const v = Number(e.target.value);
      if (!(v >= 0) || e.target.value === '') { e.target.value = Datos.d.presupuesto; return U.aviso('Escribe un monto válido.'); }
      Datos.d.presupuesto = Math.round(v * 100) / 100;
      Datos.guardar();
      pintar(cont);
      U.aviso('Presupuesto guardado.');
    });

    cont.addEventListener('click', (e) => {
      const n = e.target.closest('[data-mes]');
      if (n) {
        mes = n.dataset.mes === 'hoy' ? U.mesDe(U.hoy()) : U.sumarMeses(mes, Number(n.dataset.mes));
        return pintar(cont);
      }
      const x = e.target.closest('[data-eliminar]');
      if (x) {
        const antes = Datos.foto();
        Datos.d.movimientos = Datos.d.movimientos.filter((m) => m.id !== x.dataset.eliminar);
        Datos.guardar();
        pintar(cont);
        App.conDeshacer('Movimiento eliminado.', antes);
      }
    });
  }

  /** Cuadro "Nuevo movimiento". */
  function nuevoMovimiento(cont) {
    U.hoja({
      titulo: 'Nuevo movimiento',
      html: `<form class="form" id="f-mov" novalidate>
          <fieldset class="segmentado">
            <legend class="solo-lector">Tipo de movimiento</legend>
            <div class="segmentos">
              <label><input type="radio" name="tipo" value="gasto" ${tipo === 'gasto' ? 'checked' : ''}><span>Gasto</span></label>
              <label><input type="radio" name="tipo" value="ingreso" ${tipo === 'ingreso' ? 'checked' : ''}><span>Ingreso</span></label>
            </div>
          </fieldset>
          <div class="fila2">
            <div class="campo"><label for="m-monto">Monto</label>
              <div class="campo-dinero"><span aria-hidden="true">$</span><input id="m-monto" type="number" inputmode="decimal" min="0" step="any" placeholder="0"></div></div>
            <div class="campo"><label for="m-cat">Categoría</label><select id="m-cat"></select></div>
          </div>
          <div class="campo"><label for="m-fecha">Fecha</label><input id="m-fecha" type="date"></div>
          <div class="campo"><label for="m-nota">Nota (opcional)</label><input id="m-nota" type="text" maxlength="80" placeholder="Ej. Tacos con amigos" autocomplete="off" enterkeyhint="done"></div>
          <button class="btn primario ancho" type="submit">Guardar</button>
        </form>`,
      alAbrir(panel, cerrar) {
        llenarCategorias(panel);
        // Si estás viendo el mes actual, la fecha es hoy; si es otro mes, el día 1 de ese mes.
        panel.querySelector('#m-fecha').value = mes === U.mesDe(U.hoy()) ? U.hoy() : `${mes}-01`;
        panel.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener('change', () => {
          tipo = panel.querySelector('input[name="tipo"]:checked').value;
          llenarCategorias(panel);
        }));
        panel.querySelector('#f-mov').addEventListener('submit', (e) => {
          e.preventDefault();
          const montoEl = panel.querySelector('#m-monto');
          const monto = Math.round(Number(montoEl.value) * 100) / 100;
          if (!(monto > 0)) { montoEl.focus(); return U.aviso('Escribe un monto mayor a $0.'); }
          const fecha = panel.querySelector('#m-fecha').value || U.hoy();
          Datos.d.movimientos.push({
            id: U.id(), tipo, monto,
            categoria: panel.querySelector('#m-cat').value,
            fecha,
            nota: panel.querySelector('#m-nota').value.trim(),
            ejemplo: false,
          });
          Datos.guardar();
          cerrar();
          mes = U.mesDe(fecha); // muestra el mes del movimiento recién guardado
          pintar(cont);
          U.aviso(`${tipo === 'gasto' ? 'Gasto' : 'Ingreso'} de ${U.dinero(monto)} guardado.`);
        });
      },
    });
  }

  function llenarCategorias(raiz) {
    const cats = tipo === 'gasto' ? CAT_GASTO : CAT_INGRESO;
    raiz.querySelector('#m-cat').innerHTML = cats.map((c) => `<option>${c}</option>`).join('');
  }

  function pintar(cont) {
    const hoy = U.hoy();
    const mesHoy = U.mesDe(hoy);
    const r = Dinero.resumenMes(mes);
    const presu = Datos.d.presupuesto;

    cont.querySelector('#nav-mes').innerHTML = `
      <button type="button" class="btn-icono" data-mes="-1" aria-label="Mes anterior">${U.I.izq}</button>
      <div class="navegador-titulo" aria-live="polite">${U.nombreMes(mes)}${mes === mesHoy
        ? '<small>Este mes</small>'
        : '<button type="button" class="btn-texto este-mes" data-mes="hoy">Ir a este mes</button>'}</div>
      <button type="button" class="btn-icono" data-mes="1" aria-label="Mes siguiente">${U.I.der}</button>`;

    cont.querySelector('#resumen').innerHTML = `
      <div class="cuadro ingresos"><span class="etiqueta">Ingresos</span><p class="valor">${U.dinero(r.ingresos)}</p></div>
      <div class="cuadro"><span class="etiqueta">Gastos</span><p class="valor">${U.dinero(r.gastos)}</p></div>
      <div class="cuadro"><span class="etiqueta">Balance</span><p class="valor ${r.balance < 0 ? 'rojo' : ''}">${U.dinero(r.balance)}</p></div>`;

    // Presupuesto
    const pct = presu > 0 ? Math.min(100, Math.round((r.gastos / presu) * 100)) : 0;
    const quedan = presu - r.gastos;
    let detalle;
    if (presu <= 0) detalle = 'Escribe un presupuesto para ver cuánto te queda.';
    else if (quedan < 0) detalle = `<span class="rojo fuerte">Te pasaste por ${U.dinero(-quedan)}.</span>`;
    else if (mes < mesHoy) detalle = `Te sobraron ${U.dinero(quedan)} este mes.`;
    else {
      const diasRestantes = mes === mesHoy ? U.diasEnMes(mes) - U.aFecha(hoy).getDate() + 1 : U.diasEnMes(mes);
      detalle = `Te quedan <b>${U.dinero(quedan)}</b>, unos <b>${U.dinero(Math.floor((quedan / diasRestantes) * 100) / 100)}</b> por día.`;
    }
    cont.querySelector('#presu-detalle').innerHTML = `
      <div class="barra ${Dinero.colorBarra(r.gastos, presu)}" role="progressbar" aria-label="Presupuesto usado" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
      <p class="th-linea texto2 chico" style="justify-content:space-between"><span>Gastado: ${U.dinero(r.gastos)} de ${U.dinero(presu)}</span><span>${pct}%</span></p>
      <p style="margin-top:6px">${detalle}</p>`;

    // Por categoría (solo gastos)
    const porCat = {};
    r.movs.filter((m) => m.tipo === 'gasto').forEach((m) => { porCat[m.categoria] = (porCat[m.categoria] || 0) + m.monto; });
    const cats = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
    cont.querySelector('#categorias').innerHTML = cats.length ? `<ul class="lista categorias">${cats.map(([c, v]) => {
      const p = Math.round((v / r.gastos) * 100);
      return `<li><div class="fila"><span class="fuerte">${U.esc(c)}</span><span>${U.dinero(v)} <span class="texto2 chico">· ${p}%</span></span></div>
        <div class="barra" aria-hidden="true"><span style="width:${p}%"></span></div></li>`;
    }).join('')}</ul>` : '<p class="vacio">Sin gastos este mes.</p>';

    // Movimientos
    const movs = [...r.movs].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
    cont.querySelector('#movimientos').innerHTML = movs.length ? movs.map((m) => `
      <li class="movimiento">
        <span class="mov-icono ${m.tipo}" aria-hidden="true">${U.esc(m.categoria.charAt(0))}</span>
        <div class="mov-cuerpo">
          <p class="t">${U.esc(m.nota || m.categoria)}</p>
          <p class="texto2 chico">${m.nota ? `${U.esc(m.categoria)} · ` : ''}${U.fechaCorta(m.fecha)}</p>
        </div>
        <span class="mov-monto ${m.tipo}">${m.tipo === 'gasto' ? '−' : '+'}${U.dinero(m.monto)}</span>
        <button type="button" class="btn-icono peligro" data-eliminar="${m.id}" aria-label="Eliminar ${m.tipo} de ${U.dinero(m.monto)} (${U.esc(m.categoria)})">${U.I.basura}</button>
      </li>`).join('') : '<li class="vacio">No hay movimientos en este mes.</li>';
  }

  return { titulo: 'Dinero', render };
})();
