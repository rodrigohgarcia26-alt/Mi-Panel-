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
js/gestos.js           Botón flotante "+", mover tarjetas y deslizar entre apartados
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
2. Abre `sw.js` y sube el número de versión: `const VERSION = 'v3';` → `'v4'` (la siguiente vez `'v5'`, etc.).
   **Si no cambias este número, el celular seguirá mostrando la versión vieja.**
3. En GitHub: **Add file → Upload files**, arrastra los archivos cambiados (incluyendo `sw.js`) → **Commit changes**.
4. Abre la app con internet. La versión nueva se instala sola y la app se recarga una vez.
   Si no cambia, ciérrala por completo y ábrela de nuevo.

Por seguridad, antes de una actualización grande: **Ajustes → Exportar**.

## Datos

Todo se guarda en `localStorage`:

- `mi-panel-datos`: tareas, hábitos, dinero, notas, etc., como un JSON con campo `version` (ahora **3**).
- `mipanel-tema`: `claro` u `oscuro` (si no existe, se sigue el tema del celular).
- `mipanel-orden`: orden de las tarjetas de Hoy.
- `mipanel-orden-tareas`, `mipanel-orden-habitos`, `mipanel-orden-dinero`, `mipanel-orden-mas`: orden de las tarjetas de cada pantalla
  (Ajustes → "Restablecer orden de las tarjetas" las borra).
- `mipanel-fab`: posición del botón "+" (distancia a la orilla derecha y arriba de la barra inferior), igual en todas las pantallas.

Al pasar de la versión 1 a la 2, la app deja una copia intacta de tus datos anteriores en
`mi-panel-datos-v1-respaldo`, mueve el tema y el orden a sus claves nuevas y agrega la tarjeta "Mañana".
Al pasar de la versión 2 a la 3, deja una copia en `mi-panel-datos-v2-respaldo` y cambia la prioridad
"Normal" (y "Baja") a "Media". Las tareas siguen guardando su fecha de vencimiento (hoy + N días al crearlas);
la app muestra los días que faltan.

Si en el futuro cambia la estructura, `normalizar()` en `js/datos.js` es el lugar para convertir los datos viejos.
