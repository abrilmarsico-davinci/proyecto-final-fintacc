-- Fintacc · perfil público de las marcas
-- Datos públicos de las cuentas con rol 'brand' (sin puntos ni datos personales).

create or replace view public.brand_profiles as
select id, name, brand_name, brand_description, logo_url,
       featured_categories, featured_products, featured_stores
from public.profiles
where role = 'brand';

grant select on public.brand_profiles to anon, authenticated;
