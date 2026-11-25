# Fintacc · Plataforma de alimentación segura

Proyecto final · Diseño y Programación Web · 2026
Abril Marsico y Candela Cusinier

Plataforma web responsive para personas celíacas, hecha con **HTML, CSS, JavaScript y Supabase (Auth, PostgreSQL y Storage)**. Reúne locales, productos y recetas sin TACC, reseñas de la comunidad y un sistema de puntos en comercios aliados.

## Funcionalidades

| Módulo    | Qué se puede hacer                                                                                                                                                                         |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Landing   | Página pública que presenta la plataforma: cómo funciona, módulos y sección para comercios aliados.                                                                                        |
| Cuenta    | Registro, ingreso y cierre de sesión con Supabase Auth.                                                                                                                                    |
| Recetas   | Recetas sin TACC: buscar, filtrar por momento del día, ver información nutricional, marcar ingredientes y cocinar en modo paso a paso.                                                     |
| Productos | Productos sin TACC: buscar por nombre o marca, filtrar por categoría y ver en qué locales comprar cada producto.                                                                           |
| Locales   | Lista y mapa, filtro por cercanía (1, 3 o 5 km), buscador, horario, menú sin TACC, logo y perfil de la marca.                                                                              |
| Comunidad | Leer y publicar reviews de otras personas celíacas con puntuación en locales y productos.                                                                                                  |
| Puntos    | El cliente muestra su código Fintacc en la caja y la marca carga la compra (1 punto cada $1.000). El cliente canjea puntos por cupones con QR y la marca los valida.                       |
| Marcas    | Perfil público de cada marca con descripción, sitio web, Instagram, locales y productos. Las marcas con cuenta editan su perfil y cargan productos, locales y recetas desde el backoffice. |

Cuentas, marcas, locales, productos, recetas, reseñas, puntos y cupones se guardan en Supabase. Los locales, productos y marcas cargados son comercios reales sin TACC de CABA, tomados de fuentes públicas; ninguno figura como verificado hasta que el equipo lo confirme.

## Backend

- Supabase Auth para registro, ingreso y sesiones; perfiles y datos de negocio en PostgreSQL.
- Políticas RLS en todas las tablas: el catálogo es público, cada marca edita lo que cargó y la administración edita todo.
- Trigger de puntos de bienvenida y funciones transaccionales para cargar puntos, canjear y validar cupones.
- Backoffice para administración y marcas: productos, locales, categorías y recetas con fotos (bucket `brand_assets`).
- Formulario de solicitud de alta de comercios. Las solicitudes quedan pendientes en Supabase.
- Mapa Leaflet con OpenStreetMap, filtro por cercanía y geolocalización que pide permiso solo cuando se usa.

### Configurar Supabase

1. Creá un proyecto en Supabase.
2. En **SQL Editor**, ejecutá los scripts en este orden (se pueden volver a correr sin romper datos existentes):

   | Archivo                           | Qué crea                                                                                                                      |
   | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
   | `supabase/schema.sql`             | Perfiles, locales, solicitudes de comercios, compras, reseñas, cupones, movimientos, trigger de bienvenida y canje de cupones |
   | `supabase/contenido.sql`          | Productos, recetas, categorías, datos de los locales, perfil de marca, permisos del backoffice y bucket de imágenes           |
   | `supabase/brand_profiles.sql`     | Vista pública con el perfil de cada marca                                                                                     |
   | `supabase/marcas-y-contenido.sql` | Tabla de marcas y edición del perfil público                                                                                  |
   | `supabase/puntos.sql`             | Carga de puntos, validación de cupones y actividad de la marca                                                                |

3. Copiá la URL del proyecto y su **publishable key** (o la clave legacy `anon`) desde la configuración del proyecto.
4. Pegalas en `js/supabase-config.js`, en `FINTACC_SUPABASE_URL` y `FINTACC_SUPABASE_PUBLISHABLE_KEY`.
5. Serví esta carpeta por HTTP, por ejemplo con Live Server de VS Code o con XAMPP (copiando el proyecto dentro de `htdocs`).
6. Administrá registros y tablas desde **Supabase → Table Editor**; las cuentas se ven en **Authentication → Users**. Si dejás activa la confirmación por email, configurá la URL local en **Authentication → URL Configuration** para que el enlace de confirmación vuelva a la web.

No uses la `service_role` ni una secret key en el frontend. Las tablas se protegen con RLS; la publishable key se puede exponer junto a políticas correctas, como explica la [documentación oficial de seguridad de Supabase](https://supabase.com/docs/guides/database/secure-data). Para una prueba de clase, desactivá la confirmación de email en Auth si querés iniciar sesión inmediatamente después del registro; si queda activada, hay que confirmar el correo primero.

### Preparar una cuenta de marca para la demo

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

### Circuito de puntos

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
index.html                       → estructura base y carga de archivos
css/styles.css                   → sistema visual (paleta, tipografías, componentes)
js/config.js                     → identidad, puntos, canjes y niveles
js/supabase-config.js            → URL y publishable key del proyecto Supabase
js/app.js                        → pantallas, router e integración con Supabase
js/vendor/qrcode.js              → librería qrcode-generator (MIT) para los cupones
supabase/schema.sql              → tablas base, RLS, trigger de bienvenida y canje
supabase/contenido.sql           → catálogo, backoffice y bucket de imágenes
supabase/brand_profiles.sql      → vista pública de las cuentas de marca
supabase/marcas-y-contenido.sql  → marcas y edición del perfil de marca
supabase/puntos.sql              → circuito de puntos gestionado por la marca
assets/                          → imagotipo, isotipo y favicon de Fintacc
```

La plataforma es una SPA (single page application): cada pantalla es una función que devuelve HTML, y el router lee el hash de la URL (`#/recetas`, `#/local/sintaxis-palermo`) para decidir cuál mostrar. Los clicks se manejan con delegación de eventos a partir del atributo `data-accion`.

## Cómo verla en la computadora

1. Seguí **Configurar Supabase**.
2. Abrí la carpeta en VS Code y serví el proyecto por HTTP con Live Server (o con XAMPP, copiándolo dentro de `htdocs`).
3. Abrí la URL que indica Live Server. Sin servidor (abriendo `index.html` directo) el navegador bloquea algunas funciones, como la cámara para leer QR.

## Formato del código

El proyecto usa [Prettier](https://prettier.io/) con la configuración de `.prettierrc`. En VS Code alcanza con instalar la extensión Prettier y activar _Format on Save_.
