/* ============================================================
   Utilidades: fechas, dinero, texto seguro, avisos e íconos
   ============================================================ */
'use strict';

const U = (() => {
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DIAS_C = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  // ---------- Fechas (siempre como texto "AAAA-MM-DD" en hora local) ----------
  const dos = (n) => String(n).padStart(2, '0');
  const aISO = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const hoy = () => aISO(new Date());
  const aFecha = (iso) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d); };
  const sumarDias = (iso, n) => { const d = aFecha(iso); d.setDate(d.getDate() + n); return aISO(d); };
  /** Días que van de a hasta b (b - a). */
  const difDias = (a, b) => Math.round((aFecha(b) - aFecha(a)) / 86400000);
  /** Lunes de la semana de esa fecha. */
  const inicioSemana = (iso) => { const d = aFecha(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return aISO(d); };
  const mesDe = (iso) => iso.slice(0, 7);
  const sumarMeses = (mes, n) => { const [a, m] = mes.split('-').map(Number); const d = new Date(a, m - 1 + n, 1); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}`; };
  const diasEnMes = (mes) => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate(); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const nombreDia = (iso) => DIAS[aFecha(iso).getDay()];
  const diaCorto = (iso) => DIAS_C[aFecha(iso).getDay()];
  const nombreMes = (mes) => { const [a, m] = mes.split('-').map(Number); return `${cap(MESES[m - 1])} ${a}`; };
  /** "lun 10 nov" */
  const fechaCorta = (iso) => { const d = aFecha(iso); return `${DIAS_C[d.getDay()]} ${d.getDate()} ${MESES_C[d.getMonth()]}`; };
  /** "lunes 10 de noviembre" */
  const fechaLarga = (iso) => { const d = aFecha(iso); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  /** "1 – 7 nov" o "29 oct – 4 nov" */
  const rango = (a, b) => {
    const da = aFecha(a), db = aFecha(b);
    return da.getMonth() === db.getMonth()
      ? `${da.getDate()} – ${db.getDate()} ${MESES_C[db.getMonth()]}`
      : `${da.getDate()} ${MESES_C[da.getMonth()]} – ${db.getDate()} ${MESES_C[db.getMonth()]}`;
  };
  /** Fecha y hora de un momento guardado (ISO completo): "sáb 8 nov, 10:32" o "hoy, 10:32". */
  const momento = (isoCompleto) => {
    const d = new Date(isoCompleto);
    const hora = d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    const dif = difDias(aISO(d), hoy());
    if (dif === 0) return `hoy, ${hora}`;
    if (dif === 1) return `ayer, ${hora}`;
    return `${fechaCorta(aISO(d))}, ${hora}`;
  };
  /** "hoy", "ayer", "hace 5 días" */
  const haceDias = (isoCompleto) => {
    const dif = difDias(aISO(new Date(isoCompleto)), hoy());
    if (dif <= 0) return 'hoy';
    if (dif === 1) return 'ayer';
    return `hace ${dif} días`;
  };
  /** Etiqueta de vencimiento de una tarea. */
  const etiquetaFecha = (iso) => {
    if (!iso) return null;
    const d = difDias(hoy(), iso);
    if (d < 0) return { texto: d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`, clase: 'rojo' };
    if (d === 0) return { texto: 'Hoy', clase: 'azul' };
    if (d === 1) return { texto: 'Mañana', clase: '' };
    return { texto: fechaCorta(iso), clase: '' };
  };

  // ---------- Dinero ----------
  // Sin centavos: "$85". Con centavos: siempre dos decimales, "$245.50".
  const fmtEntero = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtCentavos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dinero = (n) => {
    const v = Math.round((Number(n) || 0) * 100) / 100;
    return (Number.isInteger(v) ? fmtEntero : fmtCentavos).format(v);
  };
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  /** ["a","b","c"] → "a, b y c" */
  const unirY = (l) => l.length < 2 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`;
  /** Primera letra en minúscula (para frases como "Faltan: hacer ejercicio"). */
  const minus = (s) => s.charAt(0).toLocaleLowerCase('es-MX') + s.slice(1);
  /** "09:30" → "9:30" */
  const hora = (hhmm) => hhmm ? hhmm.replace(/^0(\d)/, '$1') : '';

  /** Anillo de avance (SVG). n de total, con el texto "n/total" al centro. */
  function anillo(n, total, tam = 64) {
    const r = 26, c = 2 * Math.PI * r;
    const p = total ? Math.min(1, n / total) : 0;
    return `<svg class="anillo" viewBox="0 0 64 64" width="${tam}" height="${tam}" role="img" aria-label="${n} de ${total}">
      <circle cx="32" cy="32" r="${r}" class="anillo-pista"/>
      <circle cx="32" cy="32" r="${r}" class="anillo-avance ${p >= 1 ? 'completo' : ''}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>
      <text x="32" y="32" dy=".35em" text-anchor="middle">${n}/${total}</text>
    </svg>`;
  }

  // ---------- Texto seguro para insertar en HTML ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ---------- Aviso flotante (toast), con botón opcional "Deshacer" ----------
  let timerToast = null;
  function aviso(mensaje, opciones = {}) {
    const t = document.getElementById('toast');
    t.innerHTML = `<span>${esc(mensaje)}</span>${opciones.accion ? `<button type="button">${esc(opciones.accion)}</button>` : ''}`;
    if (opciones.accion) {
      t.querySelector('button').addEventListener('click', () => { ocultar(); opciones.alAccion && opciones.alAccion(); });
    }
    t.classList.add('visible');
    clearTimeout(timerToast);
    timerToast = setTimeout(ocultar, opciones.duracion || (opciones.accion ? 6000 : 2600));
    function ocultar() { t.classList.remove('visible'); }
  }

  // ---------- Confirmación dentro de la app (en vez de alert/confirm) ----------
  function confirmar({ titulo, mensaje, aceptar = 'Aceptar', cancelar = 'Cancelar', peligro = false }) {
    return new Promise((resolver) => {
      const raiz = document.getElementById('modal-raiz');
      const antes = document.activeElement;
      raiz.innerHTML = `
        <div class="modal-velo">
          <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="modal-t" aria-describedby="modal-m">
            <h2 id="modal-t">${esc(titulo)}</h2>
            <p id="modal-m">${esc(mensaje)}</p>
            <div class="modal-botones">
              <button type="button" class="btn" data-r="no">${esc(cancelar)}</button>
              <button type="button" class="btn ${peligro ? 'peligro-lleno' : 'primario'}" data-r="si">${esc(aceptar)}</button>
            </div>
          </div>
        </div>`;
      const velo = raiz.firstElementChild;
      const botones = velo.querySelectorAll('button');
      const cerrar = (r) => {
        document.removeEventListener('keydown', teclas);
        raiz.innerHTML = '';
        if (antes && antes.focus) antes.focus();
        resolver(r);
      };
      const teclas = (e) => {
        if (e.key === 'Escape') cerrar(false);
        if (e.key === 'Tab') { // mantener el foco dentro del cuadro
          e.preventDefault();
          const i = [...botones].indexOf(document.activeElement);
          botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus();
        }
      };
      document.addEventListener('keydown', teclas);
      velo.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (b) cerrar(b.dataset.r === 'si');
        else if (e.target === velo) cerrar(false);
      });
      botones[0].focus();
    });
  }

  // ---------- Cuadro que sale de abajo ("Nueva tarea", opciones, etc.) ----------
  // Se cierra con la X, tocando fuera o con Escape. Mientras está abierto, el botón "+" se oculta.
  let cerrarHojaActual = null;
  function hoja({ titulo, html, alAbrir }) {
    cerrarHoja();
    const raiz = document.getElementById('hoja-raiz');
    const antes = document.activeElement;
    raiz.innerHTML = `
      <div class="hoja-velo">
        <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-t">
          <div class="hoja-cab">
            <h2 id="hoja-t">${esc(titulo)}</h2>
            <button type="button" class="btn-icono" data-cerrar aria-label="Cerrar">${I.x}</button>
          </div>
          <div class="hoja-cuerpo">${html}</div>
        </div>
      </div>`;
    const velo = raiz.firstElementChild;
    const panel = velo.firstElementChild;
    document.body.classList.add('hoja-abierta');

    // En iPhone el teclado tapa la parte de abajo: se sube el cuadro lo que mida el teclado.
    const vv = window.visualViewport;
    const ajustar = () => {
      if (!vv) return;
      panel.style.marginBottom = `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`;
      panel.style.maxHeight = `${Math.round(vv.height * 0.92)}px`;
    };
    if (vv) { vv.addEventListener('resize', ajustar); vv.addEventListener('scroll', ajustar); }

    const teclas = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', teclas);
    // Solo se cierra si el toque empezó y terminó fuera del cuadro.
    let tocoFuera = false;
    velo.addEventListener('pointerdown', (e) => { tocoFuera = e.target === velo; });
    velo.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]') || (e.target === velo && tocoFuera)) cerrar();
    });

    function cerrar() {
      if (cerrarHojaActual !== cerrar) return;
      cerrarHojaActual = null;
      document.removeEventListener('keydown', teclas);
      if (vv) { vv.removeEventListener('resize', ajustar); vv.removeEventListener('scroll', ajustar); }
      raiz.innerHTML = '';
      document.body.classList.remove('hoja-abierta');
      if (antes && antes.isConnected && antes.focus) antes.focus({ preventScroll: true });
    }
    cerrarHojaActual = cerrar;

    if (alAbrir) alAbrir(panel, cerrar);
    const primero = panel.querySelector('.hoja-cuerpo input[type="text"], .hoja-cuerpo input[type="number"], .hoja-cuerpo textarea')
      || panel.querySelector('.hoja-cuerpo button') || panel.querySelector('[data-cerrar]');
    if (primero) primero.focus();
    return cerrar;
  }
  function cerrarHoja() { if (cerrarHojaActual) cerrarHojaActual(); }

  // ---------- Íconos (SVG) ----------
  const svg = (c) => `<svg viewBox="0 0 24 24" aria-hidden="true">${c}</svg>`;
  const I = {
    luna: svg('<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'),
    sol: svg('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M5.3 18.7l1.5-1.5M17.2 6.8l1.5-1.5"/>'),
    tuerca: svg('<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><circle cx="12" cy="12" r="3.2"/>'),
    basura: svg('<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.2a2 2 0 0 0 2 1.8h5a2 2 0 0 0 2-1.8l1-12.2M9.5 7V4.5h5V7"/>'),
    x: svg('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
    palomita: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    izq: svg('<path d="M14.5 6l-6 6 6 6"/>'),
    der: svg('<path d="M9.5 6l6 6-6 6"/>'),
    tareas: svg('<circle cx="12" cy="12" r="8.5"/><path d="M8.2 12.3l2.6 2.6 5-5.3"/>'),
    habitos: svg('<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="M14.5 17l2 2 3.5-3.8"/>'),
    dinero: svg('<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/>'),
    notas: svg('<path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5v4.5h4.5M9 12.5h7M9 16h5"/>'),
    mas: svg('<path d="M12 5.5v13M5.5 12h13"/>'),
    manana: svg('<path d="M3 17.5h18M6.5 17.5a5.5 5.5 0 0 1 11 0M12 6.5v2.5M5.2 10.2l1.6 1.6M18.8 10.2l-1.6 1.6M7 21h10"/>'),
  };

  return {
    hoy, aISO, aFecha, sumarDias, difDias, inicioSemana, mesDe, sumarMeses, diasEnMes, cap,
    nombreDia, diaCorto, nombreMes, fechaCorta, fechaLarga, rango, momento, haceDias, etiquetaFecha,
    dinero, plural, unirY, minus, hora, anillo, esc, id, aviso, confirmar, hoja, cerrarHoja, I, MESES,
  };
})();
