/* ============================================================
   Datos: se guardan en localStorage como un solo JSON
   ============================================================ */
'use strict';

const Datos = (() => {
  const CLAVE = 'mi-panel-datos';
  const VERSION = 1;
  const TARJETAS_HOY = ['tareas', 'habitos', 'dinero', 'notas'];
  const HABITOS_INICIALES = ['Tomar agua', 'Estudiar o leer 1 hora', 'Hacer ejercicio', 'Dormir', 'Comer a mis horas'];

  /** Estructura vacía. */
  function vacio() {
    return {
      version: VERSION,
      tema: null,                 // null = seguir el tema del celular; 'claro' | 'oscuro'
      ordenHoy: [...TARJETAS_HOY],
      tareas: [],                 // {id, texto, fecha, area, prioridad, hecha, hechaEn, creada, ejemplo}
      habitos: [],                // {id, nombre, dias: {"AAAA-MM-DD": true}, creado}
      marcasEjemplo: [],          // [[idHabito, "AAAA-MM-DD"], ...] marcas puestas por los ejemplos
      movimientos: [],            // {id, tipo: 'gasto'|'ingreso', monto, categoria, fecha, nota, ejemplo}
      presupuesto: 3000,
      notas: [],                  // {id, texto, fecha (ISO completo), ejemplo}
      animo: {},                  // {"AAAA-MM-DD": 1..5}
      revisiones: {},             // {"lunes AAAA-MM-DD": {bien, mejorar}}
      metas: [],                  // {id, nombre, avance 0..100}
      ultimoRespaldo: null,       // ISO completo
      creado: new Date().toISOString(),
    };
  }

  /** Datos de ejemplo para la primera vez. */
  function conEjemplos() {
    const d = vacio();
    const hoy = U.hoy();
    const ayer = U.sumarDias(hoy, -1);
    // Si hoy es día 1, "ayer" cae en otro mes: los ejemplos de dinero se quedan en hoy.
    const diaMes = U.mesDe(ayer) === U.mesDe(hoy) ? ayer : hoy;
    const ahora = new Date().toISOString();

    d.tareas = [
      { id: U.id(), texto: 'Entregar reporte de laboratorio', fecha: ayer, area: 'Escuela', prioridad: 'Alta', hecha: false, hechaEn: null, creada: ahora, ejemplo: true },
      { id: U.id(), texto: 'Repasar los apuntes de la semana', fecha: hoy, area: 'Escuela', prioridad: 'Normal', hecha: false, hechaEn: null, creada: ahora, ejemplo: true },
      { id: U.id(), texto: 'Llamar a mi familia', fecha: hoy, area: 'Personal', prioridad: 'Normal', hecha: true, hechaEn: ahora, creada: ahora, ejemplo: true },
    ];
    d.habitos = HABITOS_INICIALES.map((nombre) => ({ id: U.id(), nombre, dias: {}, creado: ahora }));
    // Algunas marcas de ejemplo: 3 de 5 hoy y un poco de historia en la semana.
    const patron = [
      [1, 1, 0, 1, 1, 1, 1], // Tomar agua (de hace 6 días a hoy)
      [1, 0, 1, 1, 0, 1, 1], // Estudiar
      [0, 1, 0, 0, 1, 0, 0], // Ejercicio
      [1, 1, 1, 0, 1, 1, 0], // Dormir
      [0, 1, 1, 1, 0, 1, 1], // Comer a mis horas
    ];
    d.habitos.forEach((h, i) => {
      patron[i].forEach((v, j) => {
        if (!v) return;
        const f = U.sumarDias(hoy, j - 6);
        h.dias[f] = true;
        d.marcasEjemplo.push([h.id, f]);
      });
    });
    d.movimientos = [
      { id: U.id(), tipo: 'gasto', monto: 85, categoria: 'Comida', fecha: hoy, nota: 'Comida en la cafetería', ejemplo: true },
      { id: U.id(), tipo: 'gasto', monto: 40, categoria: 'Transporte', fecha: diaMes, nota: 'Camión de la semana', ejemplo: true },
      { id: U.id(), tipo: 'ingreso', monto: 500, categoria: 'Familia', fecha: diaMes, nota: 'Apoyo de la semana', ejemplo: true },
    ];
    d.notas = [
      { id: U.id(), texto: 'Preguntarle al profe la fecha del examen parcial.', fecha: ahora, ejemplo: true },
    ];
    return d;
  }

  /** Completa campos que falten y actualiza datos de versiones anteriores. */
  function normalizar(entrada) {
    const base = vacio();
    const d = Object.assign(base, entrada || {});
    // (Aquí irán las migraciones cuando exista la versión 2: if (d.version < 2) {...})
    for (const k of ['tareas', 'habitos', 'marcasEjemplo', 'movimientos', 'notas', 'metas']) if (!Array.isArray(d[k])) d[k] = [];
    for (const k of ['animo', 'revisiones']) if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    d.habitos.forEach((h) => { if (!h.dias || typeof h.dias !== 'object') h.dias = {}; });
    // El orden de Hoy debe tener las 4 tarjetas exactamente una vez.
    const orden = Array.isArray(d.ordenHoy) ? d.ordenHoy.filter((t, i, a) => TARJETAS_HOY.includes(t) && a.indexOf(t) === i) : [];
    TARJETAS_HOY.forEach((t) => { if (!orden.includes(t)) orden.push(t); });
    d.ordenHoy = orden;
    if (!(Number(d.presupuesto) >= 0)) d.presupuesto = 3000;
    if (!['claro', 'oscuro'].includes(d.tema)) d.tema = null;
    d.version = VERSION;
    return d;
  }

  let d;
  function cargar() {
    let crudo = null;
    try { crudo = localStorage.getItem(CLAVE); } catch (e) { /* almacenamiento bloqueado */ }
    if (!crudo) { d = conEjemplos(); guardar(); return d; }
    try {
      d = normalizar(JSON.parse(crudo));
    } catch (e) {
      // Si el JSON está dañado, se guarda una copia aparte para no perderlo y se empieza de nuevo.
      try { localStorage.setItem(CLAVE + '-danado-' + Date.now(), crudo); } catch (e2) { /* sin espacio */ }
      d = conEjemplos();
      guardar();
    }
    return d;
  }

  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(d));
      return true;
    } catch (e) {
      U.aviso('No se pudo guardar: el almacenamiento está lleno o bloqueado.');
      return false;
    }
  }

  /** Copia del estado actual, para poder "Deshacer". */
  const foto = () => JSON.stringify(d);
  function restaurar(f) { d = normalizar(JSON.parse(f)); guardar(); }

  function borrarEjemplos() {
    d.tareas = d.tareas.filter((t) => !t.ejemplo);
    d.movimientos = d.movimientos.filter((m) => !m.ejemplo);
    d.notas = d.notas.filter((n) => !n.ejemplo);
    d.marcasEjemplo.forEach(([hid, f]) => { const h = d.habitos.find((x) => x.id === hid); if (h) delete h.dias[f]; });
    d.marcasEjemplo = [];
    guardar();
  }
  const hayEjemplos = () => d.tareas.some((t) => t.ejemplo) || d.movimientos.some((m) => m.ejemplo) || d.notas.some((n) => n.ejemplo) || d.marcasEjemplo.length > 0;

  function borrarTodo() {
    const tema = d.tema;
    d = vacio();
    d.tema = tema;
    guardar();
  }

  /** Quita una marca de la lista de ejemplos cuando el usuario la cambia a mano. */
  function olvidarMarcaEjemplo(hid, f) {
    d.marcasEjemplo = d.marcasEjemplo.filter(([h, x]) => !(h === hid && x === f));
  }

  // ---------- Respaldo ----------
  function exportar() {
    d.ultimoRespaldo = new Date().toISOString();
    guardar();
    const texto = JSON.stringify(d, null, 2);
    const nombre = `mi-panel-respaldo-${U.hoy()}.json`;
    const archivo = new File([texto], nombre, { type: 'application/json' });
    const esIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // En iPhone se abre el menú "Compartir" para guardarlo en Archivos; en lo demás se descarga.
    if (esIOS && navigator.canShare && navigator.canShare({ files: [archivo] })) {
      return navigator.share({ files: [archivo], title: 'Respaldo de Mi Panel' }).catch(() => descargar(archivo));
    }
    descargar(archivo);
    return Promise.resolve();
  }
  function descargar(archivo) {
    const url = URL.createObjectURL(archivo);
    const a = document.createElement('a');
    a.href = url; a.download = archivo.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /** Lee y revisa un archivo de respaldo. Regresa los datos o lanza un Error con un mensaje claro. */
  async function leerRespaldo(archivo) {
    let obj;
    try { obj = JSON.parse(await archivo.text()); } catch (e) { throw new Error('El archivo no es un respaldo válido (no es JSON).'); }
    if (!obj || typeof obj !== 'object' || typeof obj.version !== 'number' || !Array.isArray(obj.tareas)) {
      throw new Error('El archivo no parece un respaldo de Mi Panel.');
    }
    if (obj.version > VERSION) throw new Error('Este respaldo es de una versión más nueva de la app. Actualiza la app primero.');
    return obj;
  }
  function importar(obj) { d = normalizar(obj); guardar(); }

  async function pedirPersistencia() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) { /* no disponible */ }
    return false;
  }

  return {
    get d() { return d; },
    cargar, guardar, foto, restaurar, borrarEjemplos, hayEjemplos, borrarTodo, olvidarMarcaEjemplo,
    exportar, leerRespaldo, importar, pedirPersistencia, VERSION,
  };
})();
