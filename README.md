# Fintacc · Plataforma de alimentación segura

Proyecto final · Diseño y Programación Web · 2026
Abril Marsico y Candela Cusinier

Plataforma web responsive para personas celíacas, hecha con **HTML, CSS, JavaScript y Supabase (Auth + PostgreSQL)**. El sprint 1 era una demo con datos de prueba; el sprint 2 conecta autenticación, reseñas, puntos, compras y altas de comercios.

## Funcionalidades

| Módulo | Qué se puede hacer |
| --- | --- |
| Landing | Página pública que presenta la plataforma: cómo funciona, módulos y sección para comercios aliados. |
| Cuenta | Registro, ingreso y cierre de sesión con Supabase Auth. |
| Recetas | Recetas sin TACC: buscar, filtrar por momento del día, ver información nutricional, marcar ingredientes y cocinar en modo paso a paso. |
| Productos | Productos sin TACC: buscar por nombre o marca, filtrar por categoría y ver en qué locales comprar cada producto. |
| Locales | Lista y mapa, filtro por cercanía (1, 3 o 5 km), buscador, horario, menú sin TACC, logo y perfil de la marca. |
| Comunidad | Leer y publicar reviews de otras personas celíacas con puntuación en locales y productos. |
| Puntos | El cliente muestra su código Fintacc en la caja y la marca carga la compra (1 punto cada $1.000). El cliente canjea puntos por cupones con QR y la marca los valida. |
| Marcas | Perfil público de cada marca con descripción, sitio web, Instagram, locales y productos. Las marcas con cuenta editan su perfil y cargan productos, locales y recetas desde el backoffice. |

La identidad final de la plataforma es **Fintacc**. Cuentas, marcas, locales, productos, recetas, reseñas, puntos y cupones se guardan en Supabase. Los locales, productos y marcas cargados son comercios reales sin TACC de CABA, tomados de fuentes públicas; ninguno figura como verificado hasta que el equipo lo confirme.

## Sprint 2 · Backend

- Supabase Auth para registro, ingreso y sesiones; perfil y datos de negocio en PostgreSQL.
- Políticas RLS, trigger de puntos de bienvenida y funciones transaccionales (`supabase/schema.sql` y `supabase/puntos.sql`).
- Circuito de puntos gestionado por la marca: carga de compras, canje de cupones y validación en la caja.
- Backoffice para administración y marcas: productos, locales, categorías y recetas con fotos.
- Formulario de solicitud de alta de comercios. Las solicitudes quedan pendientes en Supabase.
- Mapa Leaflet con OpenStreetMap, filtro por cercanía y geolocalización que pide permiso solo cuando se usa.

### Configurar Supabase

1. Creá un proyecto en Supabase.
2. En **SQL Editor**, ejecutá en este orden: `supabase/schema.sql`, `supabase/brand_profiles.sql`, `supabase/marcas-y-contenido.sql` y `supabase/puntos.sql`.
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
- **Sin emojis:** íconos de línea propios en SVG, del mismo grosor, para recetas, productos y locales.
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
index.html          → estructura base y carga de archivos
css/styles.css      → sistema visual (colores, tipografías, componentes)
js/data.js          → configuración de marca, niveles y canjes de puntos (y contenido de muestra del sprint 1)
js/app.js           → pantallas, router e integración con Supabase
js/supabase-config.js → URL y publishable key del proyecto Supabase
supabase/schema.sql → tablas, RLS, trigger y RPC transaccionales de Sprint 2
supabase/brand_profiles.sql     → vista pública con los datos de las cuentas de marca
supabase/marcas-y-contenido.sql → marcas, fotos múltiples y permisos de edición del perfil de marca
supabase/puntos.sql             → circuito de puntos gestionado por la marca
js/vendor/qrcode.js → librería qrcode-generator (MIT) para los cupones
assets/             → imagotipo horizontal final e isotipo de Fintacc
```

La plataforma es una SPA (single page application): cada pantalla es una función que devuelve HTML, y el router lee el hash de la URL (`#/recetas`, `#/local/brote`) para decidir cuál mostrar.

## Cómo verla en la computadora

Para probar el backend, seguí **Configurar Supabase** y serví la web por HTTP con XAMPP/Apache o Live Server. La app ya no necesita iniciar `backend/server.py`; ese archivo y la SQLite local corresponden a la implementación anterior.

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
