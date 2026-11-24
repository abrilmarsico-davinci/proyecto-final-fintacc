-- Fintacc · contenido y backoffice
-- Productos, recetas, categorías, datos de los locales y del perfil de marca,
-- permisos de edición y bucket de imágenes.
-- Orden: schema.sql, contenido.sql, brand_profiles.sql, marcas-y-contenido.sql, puntos.sql

begin;

-- Roles de la plataforma
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'brand', 'administrator'));

-- Perfil público de las cuentas de marca
alter table public.profiles add column if not exists brand_name text;
alter table public.profiles add column if not exists brand_description text;
alter table public.profiles add column if not exists logo_url text;
alter table public.profiles add column if not exists featured_categories jsonb not null default '[]';
alter table public.profiles add column if not exists featured_products jsonb not null default '[]';
alter table public.profiles add column if not exists featured_stores jsonb not null default '[]';

-- Ficha de cada local
alter table public.stores add column if not exists type text;
alter table public.stores add column if not exists address text;
alter table public.stores add column if not exists neighborhood text;
alter table public.stores add column if not exists hours text;
alter table public.stores add column if not exists rating numeric(2, 1) not null default 0;
alter table public.stores add column if not exists verified boolean not null default false;
alter table public.stores add column if not exists verification jsonb not null default '[]';
alter table public.stores add column if not exists menu jsonb not null default '[]';
alter table public.stores add column if not exists menu_url text;
alter table public.stores add column if not exists latitude double precision;
alter table public.stores add column if not exists longitude double precision;
alter table public.stores add column if not exists image_url text;
alter table public.stores add column if not exists images jsonb not null default '[]';

create table if not exists public.categories (
  id bigint generated always as identity primary key,
  name text not null,
  merchant_user_id uuid references public.profiles(id) on delete set null
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  brand text,
  category text,
  price numeric(12, 2) not null default 0 check (price >= 0),
  store_ids jsonb not null default '[]',
  active boolean not null default true,
  image_url text,
  images jsonb not null default '[]',
  merchant_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.recipes (
  id text primary key,
  name text not null,
  moment text,
  minutes integer check (minutes > 0),
  servings integer check (servings > 0),
  nutrition jsonb,
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  product_ids jsonb not null default '[]',
  store_ids jsonb not null default '[]',
  active boolean not null default true,
  image_url text,
  images jsonb not null default '[]',
  merchant_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Las cuentas de administración pueden editar todo el contenido
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'administrator')
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;

-- Lectura pública del catálogo
drop policy if exists "categories are public" on public.categories;
create policy "categories are public" on public.categories for select to anon, authenticated using (true);
drop policy if exists "products are public" on public.products;
create policy "products are public" on public.products for select to anon, authenticated using (true);
drop policy if exists "recipes are public" on public.recipes;
create policy "recipes are public" on public.recipes for select to anon, authenticated using (true);

-- Cada marca edita lo que cargó; la administración edita todo
drop policy if exists "owner or admin manage categories" on public.categories;
create policy "owner or admin manage categories" on public.categories for all to authenticated
  using (merchant_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (merchant_user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "owner or admin manage products" on public.products;
create policy "owner or admin manage products" on public.products for all to authenticated
  using (merchant_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (merchant_user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "owner or admin manage recipes" on public.recipes;
create policy "owner or admin manage recipes" on public.recipes for all to authenticated
  using (merchant_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (merchant_user_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "owner or admin manage stores" on public.stores;
create policy "owner or admin manage stores" on public.stores for all to authenticated
  using (merchant_user_id = (select auth.uid()) or (select public.is_admin()))
  with check (merchant_user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.categories, public.products, public.recipes to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.recipes, public.stores to authenticated;

-- Imágenes de logos, productos, locales y recetas
insert into storage.buckets (id, name, public)
values ('brand_assets', 'brand_assets', true)
on conflict (id) do nothing;

drop policy if exists "brand assets are public" on storage.objects;
create policy "brand assets are public" on storage.objects for select to anon, authenticated
  using (bucket_id = 'brand_assets');
drop policy if exists "accounts can upload brand assets" on storage.objects;
create policy "accounts can upload brand assets" on storage.objects for insert to authenticated
  with check (bucket_id = 'brand_assets');

commit;
