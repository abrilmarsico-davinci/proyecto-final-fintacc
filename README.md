# Demo · Plataforma de alimentación segura

Proyecto final · Diseño y Programación Web · 2026
Abril Marsico y Candela Cusinier

Plataforma web responsive para personas celíacas, hecha con **HTML, CSS, JavaScript y una API en Python/SQLite**. El sprint 1 era una demo con datos de prueba; el sprint 2 conecta autenticación, reseñas, puntos, compras y altas de comercios al backend.

## Funcionalidades

| Módulo | Qué se puede hacer |
| --- | --- |
| Landing | Página pública que presenta la plataforma: cómo funciona, módulos y sección para comercios aliados. |
| Cuenta | Registrarse con validación de campos, ingresar, cerrar sesión. Botón de usuaria de prueba para la demo. |
| Recetas | Recetas sin TACC: buscar, filtrar por momento del día, ver información nutricional, marcar ingredientes y cocinar en modo paso a paso. |
| Productos | Productos sin TACC: buscar por nombre o marca, filtrar por categoría y ver en qué locales comprar cada producto. |
| Locales | Vista de lista y de mapa, sello de local verificado, qué se verificó y menú sin TACC. |
| Comunidad | Leer y publicar reviews de otras personas celíacas con puntuación en locales y productos. |
| Puntos | Registrar una compra (1 punto cada $1.000), subir de nivel, canjear puntos y mostrar el cupón como código QR. |

Las cuentas, reseñas, compras, puntos y cupones se guardan en SQLite. El navegador conserva únicamente el token de sesión y la preferencia de marca. El catálogo inicial de recetas, productos y locales continúa como contenido de muestra en `js/data.js`.

## Sprint 2 · Backend

- API JSON en `backend/server.py`, sin dependencias externas de Python.
- SQLite en `backend/fintacc.sqlite3` (se crea al iniciar el servidor; no subir este archivo al repositorio).
- Alta e ingreso con hash PBKDF2, sesiones con token y cierre de sesión.
- Reseñas y cupones persistentes. La API aplica la acreditación de puntos solo después de que el comercio valida el ticket.
- Flujo de compra: escaneo del QR de la caja, carga del monto, máximo de 5 compras por usuario en 24 horas y vencimiento de solicitudes a las 24 horas.
- Panel de comercio para mostrar el QR de caja y validar solicitudes con número de ticket.
- Formulario de solicitud de alta de comercios. Las solicitudes quedan pendientes en SQLite.
- Mapa Leaflet con OpenStreetMap y botón de geolocalización, que pide permiso solo cuando se usa.

### Iniciar localmente

1. Instalá Python 3.10 o superior.
2. Desde esta carpeta ejecutá `python backend/server.py`.
3. Abrí `http://localhost:8000` (el backend también sirve los archivos de la web).

La cámara y la geolocalización requieren `localhost` o un sitio publicado con HTTPS. Leaflet, OpenStreetMap y las fuentes se cargan desde internet.

### Cuentas de demostración

- Usuaria: `lucia@demo.com` · contraseña `Fintacc2026!` (también está el acceso rápido en la landing).
- Comercio: `comercio@fintacc.com` · contraseña `Comercio2026!` (local de prueba: Almacén Raíz).

Las cuentas de demo solo sirven para probar el prototipo. Antes de desplegar a usuarios reales hay que configurar HTTPS, secretos/gestión de sesiones, moderación de comercios y credenciales de producción.

## Diseño

- **Tipografía como protagonista:** titulares gigantes en Poppins y textos en Inter.
- **Sin emojis:** íconos de línea propios en SVG, del mismo grosor, para recetas, productos y locales.
- **Logos reales:** la barra superior y el pie usan los archivos del logo, así se respeta la tipografía del logotipo de cada marca.
- **Grillas bento** con bloques de color de la paleta (teal, naranja, menta, tostado y marrón).
- **Navegación flotante** con efecto vidrio (`backdrop-filter`).
- **Sello circular giratorio** con el isotipo, como elemento distintivo de la marca.
- **Línea de tiempo con puntos** en "Cómo funciona" y en los niveles del sistema de puntos.
- Las animaciones se desactivan si el sistema pide reducir el movimiento.

## Responsive

- **Escritorio:** navegación flotante, bento en el inicio, grillas de tarjetas con barra de filtros, lista y mapa de locales lado a lado, y fichas de detalle en dos columnas.
- **Celular (menos de 960 px):** menú desplegable, bento de dos columnas, grillas de dos columnas y selector Lista / Mapa en locales.

## Estructura

```
index.html          → estructura base y carga de archivos
css/styles.css      → sistema visual (colores, tipografías, componentes)
js/data.js          → datos de prueba: recetas, productos, locales, reviews, puntos
js/app.js           → lógica: estado, landing, pantallas, router y eventos
js/vendor/qrcode.js → librería qrcode-generator (MIT) para los cupones
assets/             → logos e isotipos de las dos propuestas de marca
```

La plataforma es una SPA (single page application): cada pantalla es una función que devuelve HTML, y el router lee el hash de la URL (`#/recetas`, `#/local/brote`) para decidir cuál mostrar.

## Cómo verla en la computadora

Para probar el backend, seguí **Iniciar localmente**. Live Server por sí solo sirve la web estática, pero no conecta la API.

## Cómo publicarla en GitHub Pages

1. Creá un repositorio nuevo en GitHub (por ejemplo, `proyecto-final-demo`).
2. Subí todos los archivos de esta carpeta, respetando la estructura.
3. En el repositorio, entrá a **Settings → Pages**.
4. En *Source* elegí **Deploy from a branch**, rama `main` y carpeta `/ (root)`. Guardá.
5. En uno o dos minutos la plataforma queda publicada en `https://TU-USUARIO.github.io/proyecto-final-demo/`.

Ese link es el que se agrega en la presentación y se comparte con la profesora junto con el link al repositorio.

## Próximos sprints

- Conectar catálogo, recetas, productos y locales a la base de datos y crear herramientas de administración.
- Flujo real de revisión y aprobación de las solicitudes de comercios aliados.
- Reemplazar los datos y cuentas de demostración antes de un despliegue público.
