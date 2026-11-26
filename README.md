# Fintacc · Plataforma de alimentación segura

Proyecto final · Diseño y Programación Web · 2026
Abril Marsico y Candela Cusinier

Plataforma web responsive para personas celíacas, hecha con **HTML, CSS, JavaScript y Supabase (Auth, PostgreSQL, Storage y Realtime)**. Reúne locales, productos y recetas sin TACC, reseñas de la comunidad y un sistema de puntos en comercios aliados.

## Funcionalidades

| Módulo     | Qué se puede hacer                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bienvenida | Página pública que presenta la plataforma: cómo funciona, módulos y sección para comercios aliados.                                                                                        |
| Cuenta     | Registro, ingreso y cierre de sesión con Supabase Auth. Desde el perfil se cambia el nombre y la contraseña.                                                                               |
| Recetas    | Recetas sin TACC: buscar, filtrar por momento del día, ver información nutricional, marcar ingredientes y cocinar en modo paso a paso.                                                     |
| Productos  | Productos sin TACC: buscar por nombre o marca, filtrar por categoría y ver en qué locales comprar cada producto. El listado se pagina en la base y carga más productos al hacer scroll.    |
| Locales    | Lista y mapa, filtro por cercanía (1, 3 o 5 km), buscador, horario, menú sin TACC, logo y perfil de la marca.                                                                              |
| Comunidad  | Leer y publicar reviews de otras personas celíacas con puntuación en locales y productos. Las reviews nuevas aparecen en tiempo real.                                                      |
| Puntos     | El cliente muestra su código Fintacc en la caja y la marca carga la compra (1 punto cada $1.000). El cliente canjea puntos por cupones con QR y la marca los valida.                       |
| Marcas     | Perfil público de cada marca con descripción, sitio web, Instagram, locales y productos. Las marcas con cuenta editan su perfil y cargan productos, locales y recetas desde el backoffice. |

Cuentas, marcas, locales, productos, recetas, reseñas, puntos y cupones se guardan en Supabase. Los locales, productos y marcas cargados son comercios reales sin TACC de CABA, tomados de fuentes públicas; ninguno figura como verificado hasta que el equipo lo confirme.

## Tecnologías

| Tecnología                                                                  | Uso                                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| HTML, CSS y JavaScript (ES2022)                                             | Interfaz de la SPA, sin frameworks ni paso de build.                                   |
| [Supabase](https://supabase.com/) (`@supabase/supabase-js` 2, desde CDN)    | Auth, base de datos PostgreSQL con RLS, Storage para imágenes y Realtime para reviews. |
| [Leaflet](https://leafletjs.com/) 1.9 + OpenStreetMap (desde CDN)           | Mapa de locales y filtro por cercanía.                                                 |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) | QR del código del cliente y de los cupones (`js/vendor/qrcode.js`).                    |
| Google Fonts (Poppins e Inter)                                              | Tipografías.                                                                           |
| [Prettier](https://prettier.io/)                                            | Formato del código (configuración en `.prettierrc`).                                   |
| JSDoc                                                                       | Documentación de funciones, parámetros y tipos en todos los archivos de `js/`.         |

Las librerías se cargan desde CDN en `index.html`, así que no hay dependencias para instalar con npm.

## Instalación y ejecución

Requisitos: un navegador actualizado, un proyecto de Supabase y una forma de servir archivos por HTTP (Live Server de VS Code, XAMPP o Node.js).

```bash
# 1. Clonar el repositorio
git clone https://github.com/abrilmarsico-davinci/proyecto-final-fintacc.git
cd proyecto-final-fintacc

# 2. Configurar Supabase (ver "Configurar Supabase" más abajo)

# 3. Servir la carpeta por HTTP. Con Node.js instalado:
npx serve .
# Abrir la URL que indica la consola (por defecto http://localhost:3000)
```

Sin Node.js, abrí la carpeta en VS Code y usá **Open with Live Server** sobre `index.html`, o copiá el proyecto dentro de `htdocs` de XAMPP. Abrir `index.html` directo desde el explorador de archivos no alcanza: el navegador bloquea algunas funciones, como la cámara para leer QR.

## Backend

- Supabase Auth para registro, ingreso, sesiones y cambio de contraseña; perfiles y datos de negocio en PostgreSQL.
- Políticas RLS en todas las tablas: el catálogo es público, cada marca edita lo que cargó y la administración edita todo.
- Trigger de puntos de bienvenida y funciones transaccionales para cargar puntos, canjear y validar cupones.
- Backoffice para administración y marcas: productos, locales, categorías y recetas con fotos (bucket `brand_assets`).
- Formulario de solicitud de alta de comercios. Las solicitudes quedan pendientes en Supabase.

## Cliente web

- Paginación con `.range()` y `count: "exact"`: el listado de productos se filtra y se pide de a 12 en la base, y un `IntersectionObserver` pide la página siguiente cuando el final de la lista entra en pantalla (scroll infinito).
- Caché en memoria del catálogo (`js/servicios/catalogo.js`): se reutiliza durante dos minutos al navegar entre pantallas y se descarta al crear, editar o borrar registros.
- Previsualización de imágenes con `FileReader`: el logo y las fotos del backoffice se ven apenas se eligen, mientras se suben a Storage.
- Avisos globales (`js/componentes/avisos.js`): `avisar(texto, tipo)` muestra avisos de información, éxito o error en una región en vivo que los lectores de pantalla anuncian.
- Supabase Realtime: las reviews nuevas aparecen al instante en la página de bienvenida y en las fichas de locales y productos.
- Mapa Leaflet con OpenStreetMap, filtro por cercanía y geolocalización que pide permiso solo cuando se usa.

## Configurar Supabase

1. Creá un proyecto en Supabase.
2. En **SQL Editor**, ejecutá los scripts en este orden (se pueden volver a correr sin romper datos existentes):

   | Archivo                           | Qué crea                                                                                                                      |
   | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
   | `supabase/schema.sql`             | Perfiles, locales, solicitudes de comercios, compras, reseñas, cupones, movimientos, trigger de bienvenida y canje de cupones |
   | `supabase/contenido.sql`          | Productos, recetas, categorías, datos de los locales, perfil de marca, permisos del backoffice y bucket de imágenes           |
   | `supabase/brand_profiles.sql`     | Vista pública con el perfil de cada marca                                                                                     |
   | `supabase/marcas-y-contenido.sql` | Tabla de marcas y edición del perfil público                                                                                  |
   | `supabase/puntos.sql`             | Carga de puntos, validación de cupones y actividad de la marca                                                                |
   | `supabase/perfil-y-realtime.sql`  | Edición del nombre del perfil y publicación de la tabla de reviews en Realtime                                                |

3. Copiá la URL del proyecto y su **publishable key** (o la clave legacy `anon`) desde la configuración del proyecto.
4. Pegalas en `js/supabase-config.js`, en `FINTACC_SUPABASE_URL` y `FINTACC_SUPABASE_PUBLISHABLE_KEY`.
5. Serví esta carpeta por HTTP, por ejemplo con Live Server de VS Code o con XAMPP (copiando el proyecto dentro de `htdocs`).
6. Administrá registros y tablas desde **Supabase → Table Editor**; las cuentas se ven en **Authentication → Users**. Si dejás activa la confirmación por email, configurá la URL local en **Authentication → URL Configuration** para que el enlace de confirmación vuelva a la web.

No uses la `service_role` ni una secret key en el frontend. Las tablas se protegen con RLS; la publishable key se puede exponer junto a políticas correctas, como explica la [documentación oficial de seguridad de Supabase](https://supabase.com/docs/guides/database/secure-data). Para una prueba de clase, desactivá la confirmación de email en Auth si querés iniciar sesión inmediatamente después del registro; si queda activada, hay que confirmar el correo primero.

## Preparar una cuenta de marca para la demo

1. Registrá un usuario desde la web con el correo que usará la marca.
2. En Supabase **SQL Editor**, asignale el rol `brand` y vinculalo a su marca y a sus locales. Reemplazá el email y los `id` por los que quieras usar:

   ```sql
   update public.profiles
   set role = 'brand'
   where id = (select id from auth.users where email = 'marca@ejemplo.com');

   update public.brands
   set owner_user_id = (select id from auth.users where email = 'marca@ejemplo.com')
   where id = 'cocelia';

   update public.stores
   set merchant_user_id = (select id from auth.users where email = 'marca@ejemplo.com')
   where brand_id = 'cocelia';
   ```

3. Ingresá con esa cuenta: en **Puntos** carga compras y valida cupones; en **Mi perfil → Perfil público** edita su página.

## Circuito de puntos

1. El cliente abre **Puntos → Mostrar mi código** y lo muestra en la caja (QR o código de 8 caracteres; también sirve su email).
2. La marca dueña del local carga el monto en **Puntos → Cargar puntos**. La función `award_points` acredita 1 punto cada $1.000 y no permite repetir un número de ticket en el mismo local.
3. El cliente canjea sus puntos por un cupón (`redeem_coupon`) y muestra el QR en la caja.
4. La marca lo valida con **Validar cupón** (`use_coupon`) y el cupón queda como usado.
5. La marca ve sus compras cargadas y cupones validados en **Actividad** (`brand_activity`).

Las solicitudes del formulario de comercios quedan con estado `pending`; su aprobación y vinculación a una cuenta se realizan desde Supabase.

Las cuentas de demo solo sirven para probar el prototipo. Antes de desplegar a usuarios reales hay que configurar HTTPS, secretos/gestión de sesiones, moderación de comercios y credenciales de producción.

## Diseño

- **Tipografía como protagonista:** titulares gigantes en Poppins y textos en Inter.
- **Íconos de línea** propios en SVG, del mismo grosor, para recetas, productos y locales.
- **Logo Fintacc:** la barra superior, el perfil y el pie usan los archivos oficiales del logo y el isotipo.
- **Grillas bento** con bloques de color de la paleta (petróleo, naranja, menta, tostado y marrón).
- **Navegación flotante** con efecto vidrio (`backdrop-filter`).
- **Sello circular giratorio** con el isotipo, como elemento distintivo de la marca.
- **Línea de tiempo con puntos** en "Cómo funciona" y en los niveles del sistema de puntos.
- Las animaciones se desactivan si el sistema pide reducir el movimiento.

## Responsive

- **Escritorio:** navegación flotante, bento en el inicio, grillas de tarjetas con barra de filtros, lista y mapa de locales lado a lado, y fichas de detalle en dos columnas.
- **Celular (menos de 960 px):** menú desplegable, bento de dos columnas, grillas de dos columnas y selector Lista / Mapa en locales.

## Estructura

```
index.html                         → estructura base y carga de los scripts en orden
css/styles.css                     → sistema visual (paleta, tipografías, componentes)
js/config.js                       → identidad, puntos, canjes y niveles
js/supabase-config.js              → URL y publishable key del proyecto Supabase
js/vendor/qrcode.js                → librería qrcode-generator (MIT) para los QR
js/servicios/                      → toda la comunicación con Supabase
  supabase.js                      → cliente, manejo de errores y usuario actual
  auth.js                          → registro, ingreso, sesión, nombre y contraseña
  catalogo.js                      → productos, locales, recetas, categorías y marcas
  reviews.js                       → lectura, publicación y suscripción Realtime
  puntos.js                        → canjes, carga de puntos, cupones y actividad
  comercios.js                     → solicitudes de alta de comercios
  imagenes.js                      → subida de imágenes a Storage
  backoffice.js                    → ABM del backoffice y perfil público de la marca
js/utilidades.js                   → formato, escape de HTML, lectura de imágenes y conversiones
js/estado.js                       → estado de la sesión, catálogo e interfaz
js/componentes/                    → piezas reutilizables de la interfaz
  iconos.js                        → íconos SVG y colores por categoría
  estructura.js                    → barras de navegación, pie y layout
  tarjetas.js                      → tarjetas de recetas, productos y locales
  reviews.js                       → sección de reviews
  modales.js                       → diálogos accesibles (foco, Escape, QR, formularios)
  avisos.js                        → avisos globales de información, éxito y error
js/pantallas/                      → una función por pantalla
  bienvenida.js, acceso.js, inicio.js, recetas.js, productos.js, locales.js,
  marca.js, puntos.js, perfil.js, editor-marca.js, backoffice.js, no-encontrada.js
js/eventos.js                      → delegación de clicks, búsquedas y formularios
js/router.js                       → router por hash, Realtime y arranque de la app
supabase/*.sql                     → tablas, RLS, funciones, triggers y Realtime
assets/                            → imagotipo, isotipo y favicon de Fintacc
```

La plataforma es una SPA (single page application): cada pantalla es una función que devuelve HTML, y el router lee el hash de la URL (`#/recetas`, `#/local/sintaxis-palermo`) para decidir cuál mostrar. Los clicks se manejan con delegación de eventos a partir del atributo `data-accion`.

Las pantallas no consultan Supabase directamente: llaman a las funciones de `js/servicios/`, que concentran las consultas, las funciones RPC, Storage y Realtime. Los scripts se cargan como scripts clásicos en el orden de `index.html` (servicios, estado, componentes, pantallas, eventos y router), así que comparten el ámbito global sin necesidad de un bundler.

### Convención de nombres

El código está escrito en español: funciones, variables, clases de CSS, ids, valores de `data-accion` y rutas (`#/backoffice`, `#/perfil`). La base de datos conserva sus columnas en inglés (`name`, `brand`, `merchant_user_id`), y los servicios y las funciones `normalizar*` hacen de puente entre los dos. Los roles de la base se usan a través de la constante `ROLES` (`ROLES.marca`, `ROLES.administracion`). "Review" se mantiene como término del dominio, igual que el nombre de la tabla.

## Accesibilidad

- Estructura semántica: `header`, `nav` con nombre accesible, `main`, `section`, `article`, `aside`, `figure` y `footer`.
- Enlace "Saltar al contenido" al inicio de la página, y foco en el contenido principal al cambiar de pantalla.
- Todos los campos tienen su `label`. Los errores se anuncian con `role="alert"` y se asocian al campo con `aria-invalid` y `aria-describedby`.
- Los modales tienen `role="dialog"`, `aria-modal` y nombre accesible. Mantienen el foco adentro, se cierran con Escape y devuelven el foco al botón que los abrió.
- Navegación activa marcada con `aria-current`, filtros con `aria-pressed` y estado del menú con `aria-expanded`.
- Botones de solo ícono con `aria-label` descriptivo (por ejemplo, "Editar Pan lactal").
- Foco visible en todos los elementos interactivos y animaciones desactivadas con `prefers-reduced-motion`.

## Documentación y formato del código

Todas las funciones de `js/` están documentadas con JSDoc (descripción, `@param`, `@returns` y `@typedef` para los datos de Supabase), así que los editores muestran la ayuda al pasar el mouse.

El proyecto usa [Prettier](https://prettier.io/) con la configuración de `.prettierrc`. En VS Code alcanza con instalar la extensión Prettier y activar _Format on Save_, o desde la terminal:

```bash
npx prettier --write .
```
