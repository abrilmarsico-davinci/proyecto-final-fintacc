-- Fintacc · marcas, fotos y perfil de marca
-- Orden: schema.sql, brand_profiles.sql, este archivo, puntos.sql

begin;

-- Marcas (owner_user_id: cuenta que la administra)
create table if not exists public.brands (
  id text primary key,
  name text not null,
  description text,
  logo_url text,
  website text,
  instagram text,
  owner_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.brands add column if not exists instagram text;

alter table public.brands enable row level security;
drop policy if exists "brands son publicas" on public.brands;
create policy "brands son publicas" on public.brands for select to anon, authenticated using (true);
grant select on public.brands to anon, authenticated;

alter table public.stores add column if not exists brand_id text references public.brands(id);

-- Fotos de productos y recetas
alter table public.products add column if not exists images jsonb not null default '[]';
alter table public.recipes add column if not exists image_url text;
alter table public.recipes add column if not exists images jsonb not null default '[]';

-- Edición del perfil público por la propia cuenta
drop policy if exists "brand owner can update public profile" on public.profiles;
create policy "brand owner can update public profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
grant update (brand_name, brand_description, logo_url, featured_categories, featured_products, featured_stores)
  on public.profiles to authenticated;

commit;
