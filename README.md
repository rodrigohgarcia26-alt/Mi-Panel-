# Mi Panel

App personal (PWA) para el celular: tareas, hábitos, dinero, notas, revisión semanal y metas.
Funciona 100 % sin internet y guarda todo en el propio celular.

## Archivos

```
index.html             Página principal
manifest.webmanifest   Datos para "instalar" la app (nombre, íconos, colores)
sw.js                  Service worker: guarda la app para usarla sin internet
css/estilos.css        Diseño (modo claro y oscuro)
js/util.js             Fechas, pesos, avisos, íconos
js/datos.js            Guardado en localStorage, ejemplos, respaldo
js/app.js              Navegación, cabecera, tema, actualizaciones
js/pantallas/*.js      Una por pantalla: hoy, tareas, habitos, dinero, mas, ajustes
fuentes/               Bricolage Grotesque y Figtree (locales, licencia OFL)
iconos/                Íconos de la app
```

## Probarla en la computadora

Abrir `index.html` con doble clic funciona, pero sin el modo sin internet.
Para probarla completa, en esta carpeta:

```
python3 -m http.server 8000
```

y abre http://localhost:8000 en Chrome. Para ver cómo se ve en el celular: F12 → ícono de celular.

## Subirla a GitHub Pages (gratis)

1. Crea una cuenta en https://github.com (si no tienes).
2. Arriba a la derecha: **+ → New repository**. Nombre: `mi-panel`. Déjalo **Public**. **Create repository**.
3. En la página del repositorio, toca **uploading an existing file**.
4. Arrastra **todo el contenido** de esta carpeta (los archivos y las carpetas `css`, `js`, `fuentes`, `iconos`), no la carpeta en sí.
   `index.html` debe quedar en la raíz del repositorio. Toca **Commit changes**.
5. Ve a **Settings → Pages**. En *Branch* elige `main` y carpeta `/ (root)`. **Save**.
6. Espera 1 o 2 minutos. Tu app quedará en `https://TU-USUARIO.github.io/mi-panel/`.

## Instalarla en el celular

Abre la dirección de arriba **con internet una vez**.

- **Android (Chrome):** menú ⋮ → **Instalar app** (o "Agregar a pantalla principal").
- **iPhone (Safari, no otro navegador):** botón **Compartir** (cuadro con flecha) → **Agregar a pantalla de inicio** → **Agregar**.

Después ábrela desde su ícono. Ya funciona sin internet.

> Importante en iPhone: la app instalada y Safari guardan datos por separado.
> Usa siempre la app desde su ícono.

## Actualizar la app sin perder tus datos

Tus datos viven en el celular, no en GitHub, así que subir archivos nuevos no los borra.

1. Cambia lo que quieras en los archivos.
2. Abre `sw.js` y sube el número de versión: `const VERSION = 'v1';` → `'v2'` (la siguiente vez `'v3'`, etc.).
   **Si no cambias este número, el celular seguirá mostrando la versión vieja.**
3. En GitHub: **Add file → Upload files**, arrastra los archivos cambiados (incluyendo `sw.js`) → **Commit changes**.
4. Abre la app con internet. Saldrá el aviso "Hay una versión nueva" → toca **Actualizar**.
   Si no sale, ciérrala por completo y ábrela de nuevo.

Por seguridad, antes de una actualización grande: **Ajustes → Exportar**.

## Datos

Todo se guarda en `localStorage` bajo la clave `mi-panel-datos`, como un JSON con campo `version`.
Si en el futuro cambia la estructura, `normalizar()` en `js/datos.js` es el lugar para convertir los datos viejos.
