-- Fintacc · perfil público de las marcas
-- La tabla profiles solo deja leer el perfil propio (RLS), por eso "Ver perfil de la marca"
-- no encontraba la marca. Esta vista expone solo los datos públicos de las cuentas con rol 'brand'
-- (sin puntos, email ni otros datos personales). Ejecutar en Supabase → SQL Editor.

create or replace view public.brand_profiles as
select id, name, brand_name, brand_description, logo_url,
       featured_categories, featured_products, featured_stores
from public.profiles
where role = 'brand';

grant select on public.brand_profiles to anon, authenticated;
