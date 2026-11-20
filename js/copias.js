/* ============================================================
   Copias de seguridad automáticas (en IndexedDB, dentro del celular)

   Una app web no puede "despertarse" sola a las 3:00 am con la app cerrada.
   Por eso, cada vez que se abre la app (o vuelve a primer plano) se revisa:
   si la copia automática está activada y la última copia es anterior a la
   última marca de las 3:00 am, se hace una copia. Así hay como máximo una
   copia automática por día. Se conservan solo las últimas 7.
   (La copia a las 3:00 am exactas con la app cerrada queda para la etapa 2.)
   ============================================================ */
'use strict';

const Copias = (() => {
  const CLAVE_CFG = 'mipanel-copias-cfg';
  const BD = 'mi-panel-copias';
  const ALMACEN = 'copias';
  const MAX_COPIAS = 7;
  const HORA_COPIA = 3;
  const SECCIONES = ['tareas', 'habitos', 'dinero', 'mas'];
  // Ajustes que van siempre en la copia: orden de tarjetas, modo oscuro, posición del "+" y conteos de uso.
  const esAjuste = (k) => /^mipanel-(orden|uso)/.test(k) || k === 'mipanel-tema' || k === 'mipanel-fab';

  let error = null;        // último error (se muestra en la tarjeta de Ajustes)
  let revisando = null;    // evita dos copias automáticas al mismo tiempo

  // ---------- Opciones ----------
  function config() {
    let c = null;
    try { c = JSON.parse(localStorage.getItem(CLAVE_CFG)); } catch (e) { /* dañado o bloqueado */ }
    const sec = (c && c.secciones) || {};
    return {
      auto: !(c && c.auto === false),
      secciones: Object.fromEntries(SECCIONES.map((s) => [s, sec[s] !== false])),
    };
  }
  function ponerConfig(c) { try { localStorage.setItem(CLAVE_CFG, JSON.stringify(c)); } catch (e) { /* bloqueado */ } }
  const elegidas = () => { const s = config().secciones; return SECCIONES.filter((k) => s[k]); };

  // ---------- IndexedDB ----------
  let bdPromesa = null;
  function abrir() {
    if (bdPromesa) return bdPromesa;
    bdPromesa = new Promise((ok, mal) => {
      if (!('indexedDB' in window)) return mal(new Error('Sin IndexedDB'));
      const r = indexedDB.open(BD, 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ALMACEN)) r.result.createObjectStore(ALMACEN, { keyPath: 'id' }); };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
      r.onblocked = () => mal(new Error('IndexedDB bloqueada'));
    }).catch((e) => { bdPromesa = null; throw e; });
    return bdPromesa;
  }
  /** Ejecuta fn(almacén) en una transacción y espera a que termine. */
  async function tx(modo, fn) {
    const bd = await abrir();
    return new Promise((ok, mal) => {
      const t = bd.transaction(ALMACEN, modo);
      let res;
      const r = fn(t.objectStore(ALMACEN));
      if (r) r.onsuccess = () => { res = r.result; };
      t.oncomplete = () => ok(res);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error || new Error('Transacción cancelada'));
    });
  }
  /** Todas las copias, de la más nueva a la más vieja. */
  async function lista() {
    const todas = (await tx('readonly', (a) => a.getAll())) || [];
    return todas.sort((a, b) => b.id - a.id);
  }

  // ---------- Hacer una copia ----------
  function leerAjustes() {
    const o = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (esAjuste(k)) o[k] = localStorage.getItem(k);
      }
    } catch (e) { /* bloqueado */ }
    return o;
  }
  /** tipo: 'auto' | 'manual' | 'seguridad' (antes de restaurar o importar). */
  async function hacer(tipo = 'manual') {
    try {
      const ahora = new Date();
      const secciones = elegidas();
      const copia = { id: ahora.getTime(), fecha: ahora.toISOString(), tipo, secciones, datos: Datos.extraerSecciones(secciones), ajustes: leerAjustes() };
      copia.tamano = new Blob([JSON.stringify(copia)]).size;
      await tx('readwrite', (a) => a.put(copia));
      // Se conservan solo las últimas 7; las más viejas se borran.
      const sobran = (await lista()).slice(MAX_COPIAS);
      if (sobran.length) await tx('readwrite', (a) => { sobran.forEach((c) => a.delete(c.id)); });
      error = null;
      return copia;
    } catch (e) {
      error = 'No se pudo guardar la copia';
      throw e;
    }
  }

  /** Última marca de las 3:00 am: hoy a las 3:00 si ya pasaron; si no, ayer a las 3:00. */
  function ultimaMarca(ahora = new Date()) {
    const m = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), HORA_COPIA, 0, 0, 0);
    if (ahora < m) m.setDate(m.getDate() - 1);
    return m;
  }

  /** Se llama al abrir la app y al volver a primer plano. Nunca lanza errores. */
  function revisar() {
    if (revisando) return revisando;
    revisando = (async () => {
      try {
        if (!config().auto) return null;
        const ultima = (await lista()).find((c) => c.tipo !== 'seguridad');
        if (ultima && ultima.id >= ultimaMarca().getTime()) return null;
        const c = await hacer('auto');
        avisarCambio();
        return c;
      } catch (e) {
        if (!error) error = 'No se pudo guardar la copia';
        avisarCambio();
        return null;
      } finally {
        revisando = null;
      }
    })();
    return revisando;
  }
  // Si Ajustes está abierta, se vuelve a pintar la tarjeta.
  function avisarCambio() { document.dispatchEvent(new CustomEvent('copias-cambio')); }

  // ---------- Restaurar ----------
  function aplicarAjustes(ajustes) {
    if (!ajustes || typeof ajustes !== 'object') return;
    try {
      const actuales = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (esAjuste(k)) actuales.push(k); }
      actuales.forEach((k) => localStorage.removeItem(k));
      Object.entries(ajustes).forEach(([k, v]) => { if (esAjuste(k) && typeof v === 'string') localStorage.setItem(k, v); });
    } catch (e) { /* bloqueado */ }
  }
  /** Reemplaza solo las secciones que traiga la copia (y sus ajustes). Antes hace una copia de seguridad. */
  async function restaurar(id) {
    const copia = (await lista()).find((c) => c.id === id);
    if (!copia) throw new Error('No se encontró esa copia.');
    await hacer('seguridad');
    if (!Datos.reemplazarSecciones(copia.datos || {})) throw new Error('No se pudieron guardar los datos.');
    aplicarAjustes(copia.ajustes);
  }

  // ---------- Archivo ----------
  /** Descarga mi-panel-respaldo-AAAA-MM-DD.json con las secciones elegidas. */
  function exportarArchivo() {
    const secciones = elegidas();
    const obj = {
      app: 'mi-panel',
      version: Datos.VERSION,
      exportado: new Date().toISOString(),
      secciones,
      datos: Datos.extraerSecciones(secciones),
      ajustes: leerAjustes(),
    };
    Datos.marcarRespaldo();
    return Datos.compartirArchivo(JSON.stringify(obj, null, 2), `mi-panel-respaldo-${U.hoy()}.json`);
  }

  /** Lee y revisa un archivo. Regresa {obj, resumen} o lanza un Error con un mensaje claro. No toca tus datos. */
  async function leerArchivo(archivo) {
    let obj;
    try { obj = JSON.parse(await archivo.text()); } catch (e) { throw new Error('Ese archivo no es un respaldo de Mi Panel (no se pudo leer).'); }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('Ese archivo no es un respaldo de Mi Panel.');
    if (!('version' in obj) || typeof obj.version !== 'number') throw new Error('Ese archivo no es un respaldo de Mi Panel: le falta el campo "version".');
    if (obj.version > Datos.VERSION) throw new Error('Este respaldo es de una versión más nueva de la app. Actualiza la app primero.');
    // Formato nuevo (este) o el formato anterior (todos los datos en un solo objeto).
    const nuevo = obj.app === 'mi-panel' && obj.datos && typeof obj.datos === 'object';
    const viejo = !nuevo && Array.isArray(obj.tareas);
    if (!nuevo && !viejo) throw new Error('Ese archivo no es un respaldo de Mi Panel.');
    const nombres = { tareas: 'tareas', habitos: 'hábitos', dinero: 'dinero', mas: 'metas, notas y revisiones' };
    const secs = nuevo ? SECCIONES.filter((s) => obj.datos[s]) : SECCIONES;
    return { obj, nuevo, resumen: U.unirY(secs.map((s) => nombres[s])) || 'nada' };
  }
  /** Reemplaza con lo del archivo ya revisado (antes hace una copia de seguridad, si se puede). */
  async function importarArchivo({ obj, nuevo }) {
    try { await hacer('seguridad'); } catch (e) { /* si IndexedDB falla, se importa de todos modos */ }
    if (nuevo) {
      if (!Datos.reemplazarSecciones(obj.datos)) throw new Error('No se pudieron guardar los datos.');
      aplicarAjustes(obj.ajustes);
    } else {
      Datos.importar(obj);
    }
  }

  // ---------- Textos ----------
  /** "3:00 am" */
  function horaCorta(d) {
    const h = d.getHours();
    return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
  }
  /** "hoy", "ayer" o "lun 10 nov" */
  function diaCorto(d) {
    const dif = U.difDias(U.aISO(d), U.hoy());
    return dif === 0 ? 'hoy' : dif === 1 ? 'ayer' : U.fechaCorta(U.aISO(d));
  }
  const tamano = (b) => (b < 1024 ? `${b} B` : `${Math.round(b / 1024)} KB`);

  /** Al abrir la app y al volver a ella. */
  function iniciar() {
    revisar();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
  }

  return {
    iniciar, revisar, hacer, lista, restaurar, exportarArchivo, leerArchivo, importarArchivo,
    config, ponerConfig, horaCorta, diaCorto, tamano, SECCIONES, MAX_COPIAS,
    get error() { return error; },
  };
})();
