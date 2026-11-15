-- Fintacc · esquema inicial para Supabase (PostgreSQL)
-- Ejecutar completo desde Supabase Dashboard → SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'user' check (role in ('user', 'brand', 'administrator')),
  points integer not null default 50 check (points >= 0),
  earned integer not null default 50 check (earned >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.stores (
  id text primary key,
  merchant_user_id uuid references public.profiles(id),
  name text not null,
  qr_token text not null unique,
  status text not null default 'active' check (status in ('active', 'inactive'))
);

-- Catálogos administrables por la marca. Estos campos amplían el esquema usado
-- por la app existente y mantienen las compras/QR vinculados a los locales.
alter table public.stores add column if not exists type text not null default 'Dietética';
alter table public.stores add column if not exists neighborhood text not null default '';
alter table public.stores add column if not exists address text not null default '';
alter table public.stores add column if not exists hours text not null default '';
alter table public.stores add column if not exists rating numeric(2,1) not null default 0;
alter table public.stores add column if not exists verified boolean not null default false;
alter table public.stores add column if not exists verification jsonb not null default '[]'::jsonb;
alter table public.stores add column if not exists menu jsonb not null default '[]'::jsonb;
alter table public.stores add column if not exists map_x integer not null default 50;
alter table public.stores add column if not exists map_y integer not null default 50;
alter table public.stores add column if not exists latitude numeric(9,6);
alter table public.stores add column if not exists longitude numeric(9,6);
alter table public.stores add column if not exists brand_user_id uuid references public.profiles(id) on delete set null;
alter table public.stores add column if not exists image_url text;
alter table public.stores add column if not exists public_visible boolean not null default true;
alter table public.stores add column if not exists display_order integer not null default 0;

create table if not exists public.products (
  id text primary key, name text not null, brand text not null, category text not null,
  price numeric(12,2) not null default 0 check (price >= 0), store_ids jsonb not null default '[]'::jsonb,
  active boolean not null default true, created_at timestamptz not null default now()
);
alter table public.products add column if not exists brand_user_id uuid references public.profiles(id) on delete set null;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists public_visible boolean not null default true;
alter table public.products add column if not exists display_order integer not null default 0;
alter table public.products alter column price type numeric(12,2) using price::numeric(12,2);

create table if not exists public.product_categories (
  id bigint generated always as identity primary key,
  brand_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 50),
  created_at timestamptz not null default now(),
  unique (brand_user_id, name)
);
alter table public.profiles add column if not exists brand_logo_url text;
create table if not exists public.recipes (
  id text primary key, name text not null, moment text not null,
  minutes integer not null check (minutes > 0), servings integer not null check (servings > 0),
  nutrition jsonb not null default '{}'::jsonb, ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb, active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.recipes add column if not exists product_ids jsonb not null default '[]'::jsonb;
alter table public.recipes add column if not exists store_ids jsonb not null default '[]'::jsonb;

create table if not exists public.brand_customers (
  brand_user_id uuid not null references public.profiles(id) on delete cascade,
  customer_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (brand_user_id, customer_user_id),
  check (brand_user_id <> customer_user_id)
);

create or replace function public.slugify_catalog_name(input_text text)
returns text language sql immutable strict as $$
  select trim(both '-' from regexp_replace(
    regexp_replace(translate(lower(trim(input_text)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g'))
$$;

create or replace function public.generate_catalog_id()
returns trigger language plpgsql set search_path=public as $$
declare base_slug text; candidate text; suffix integer:=2;
begin
  base_slug:=public.slugify_catalog_name(new.name);
  if base_slug='' then raise exception 'Ingresá un nombre válido para generar el identificador'; end if;
  candidate:=base_slug;
  while exists(select 1 from public.stores where id=candidate) or exists(select 1 from public.products where id=candidate) or exists(select 1 from public.recipes where id=candidate) loop
    candidate:=base_slug || '-' || suffix; suffix:=suffix+1;
  end loop;
  new.id:=candidate;
  return new;
end;
$$;
drop trigger if exists stores_generate_id on public.stores;
create trigger stores_generate_id before insert on public.stores for each row execute function public.generate_catalog_id();
drop trigger if exists products_generate_id on public.products;
create trigger products_generate_id before insert on public.products for each row execute function public.generate_catalog_id();
drop trigger if exists recipes_generate_id on public.recipes;
create trigger recipes_generate_id before insert on public.recipes for each row execute function public.generate_catalog_id();

create or replace function public.set_product_brand_name()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.brand_user_id is not null then select name into new.brand from public.profiles where id=new.brand_user_id and role='brand'; end if;
  if new.brand is null or trim(new.brand)='' then raise exception 'Seleccioná la marca propietaria del producto'; end if;
  return new;
end;
$$;
drop trigger if exists products_set_brand_name on public.products;
create trigger products_set_brand_name before insert or update of brand_user_id on public.products for each row execute function public.set_product_brand_name();

create or replace function public.validate_product_category_scope()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.brand_user_id is not null and not exists(
    select 1 from public.product_categories c where c.brand_user_id=new.brand_user_id and lower(c.name)=lower(trim(new.category))
  ) then raise exception 'Creá o elegí una categoría de esta marca'; end if;
  return new;
end;
$$;
drop trigger if exists products_category_scope on public.products;
create trigger products_category_scope before insert or update of brand_user_id,category on public.products for each row execute function public.validate_product_category_scope();

create or replace function public.generate_store_qr()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.qr_token is null or trim(new.qr_token)='' then new.qr_token:='FINTACC-STORE-' || upper(new.id); end if;
  return new;
end;
$$;
drop trigger if exists stores_generate_qr on public.stores;
create trigger stores_generate_qr before insert on public.stores for each row execute function public.generate_store_qr();

insert into public.products(id,name,brand,category,price,store_ids) values
('p1','Pan de molde sin TACC','Molino Claro','Panificados',6900,'["raiz","masamadre","centro"]'),('p2','Fideos de arroz sin TACC','Grano Fino','Almacén',3200,'["raiz","centro"]'),('p3','Cerveza sin TACC','Malta Libre','Bebidas',3600,'["raiz","verdeurquiza"]'),('p4','Premezcla para pizza sin TACC','Molino Claro','Almacén',5400,'["raiz","centro"]'),('p5','Galletitas de arroz sin TACC','Grano Fino','Snacks',1900,'["raiz","centro","verdeurquiza"]'),('p6','Tapas para empanadas sin TACC','Masa Clara','Refrigerados',4300,'["raiz"]'),('p7','Harina de almendras sin TACC','Almendra Viva','Almacén',9800,'["raiz"]'),('p8','Alfajor sin TACC','Dulce Sur','Snacks',1500,'["raiz","verdeurquiza"]'),('p9','Yogur con cereales sin TACC','Valle Blanco','Refrigerados',2100,'["raiz","verdeurquiza"]') on conflict(id) do nothing;
insert into public.recipes(id,name,moment,minutes,servings,nutrition,ingredients,steps) values
('r1','Panqueques de banana','Desayuno',15,2,'{"calories":310,"proteins":11,"carbohydrates":44,"grasas":9}','["1 banana madura","2 huevos","3 cdas de harina de arroz","1 cdita de canela"]','["Pisá la banana hasta formar un puré.","Agregá los huevos, la harina y la canela, y batí hasta integrar.","Calentá una sartén antiadherente a fuego medio.","Cociná cucharadas de la mezcla 2 minutos de cada lado."]'),
('r2','Bowl de quinoa y garbanzos','Almuerzo',25,2,'{"calories":420,"proteins":16,"carbohydrates":58,"grasas":12}','["1 taza de quinoa","1 lata de garbanzos","1 palta","Tomates cherry","Jugo de limón y aceite de oliva"]','["Lavá la quinoa y cocinala 15 minutos en el doble de agua.","Escurrí y enjuagá los garbanzos.","Cortá la palta y los tomates.","Armá el bowl y condimentá con limón, aceite y sal."]'),
('r3','Salmón con espárragos','Cena',20,2,'{"calories":380,"proteins":34,"carbohydrates":6,"grasas":24}','["2 filetes de salmón","1 atado de espárragos","Aceite de oliva","Limón, sal y pimienta"]','["Precalentá el horno a 200 °C.","Colocá el salmón y los espárragos en una placa con aceite.","Condimentá con sal, pimienta y limón.","Horneá 12 a 15 minutos."]'),
('r4','Muffins de almendra','Merienda',30,6,'{"calories":210,"proteins":7,"carbohydrates":5,"grasas":18}','["2 tazas de harina de almendras","3 huevos","3 cdas de eritritol","1 cdita de polvo de hornear","Esencia de vainilla"]','["Precalentá el horno a 180 °C.","Mezclá los ingredientes secos.","Agregá los huevos y la vainilla, y uní bien.","Distribuí en moldes y horneá 20 minutos."]'),
('r5','Curry de lentejas','Cena',35,4,'{"calories":360,"proteins":18,"carbohydrates":52,"grasas":8}','["1 taza de lentejas","1 lata de leche de coco","1 cebolla","2 cdas de curry","Arroz para acompañar"]','["Rehogá la cebolla picada con el curry.","Agregá las lentejas lavadas y 3 tazas de agua.","Cociná 20 minutos a fuego bajo.","Sumá la leche de coco y cociná 5 minutos más."]'),
('r6','Tostadas con palta y huevo','Desayuno',10,1,'{"calories":340,"proteins":14,"carbohydrates":28,"grasas":20}','["2 rebanadas de pan sin TACC","½ palta","1 huevo","Sal y semillas"]','["Tostá el pan.","Pisá la palta con sal.","Cociná el huevo a la plancha.","Armá las tostadas y sumá semillas."]'),
('r7','Zoodles al pesto','Almuerzo',15,2,'{"calories":260,"proteins":6,"carbohydrates":9,"grasas":22}','["2 zucchinis","1 taza de albahaca","3 cdas de nueces","Aceite de oliva y ajo"]','["Cortá los zucchinis en tiras finas.","Procesá la albahaca, las nueces, el ajo y el aceite.","Saltá los zoodles 2 minutos.","Mezclá con el pesto y serví."]'),
('r8','Arroz con pollo y zanahoria','Almuerzo',30,3,'{"calories":450,"proteins":30,"carbohydrates":55,"grasas":10}','["1 taza de arroz","2 pechugas de pollo","2 zanahorias","Aceite de oliva y sal"]','["Cortá el pollo en cubos y dorálo.","Agregá la zanahoria rallada.","Sumá el arroz y 2 tazas de agua.","Cociná tapado 18 minutos."]') on conflict(id) do nothing;

create table if not exists public.merchants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  type text not null,
  address text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  store_id text not null references public.stores(id),
  amount integer not null check (amount >= 1000),
  points integer not null check (points > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  receipt text,
  unique (store_id, receipt)
);

create table if not exists public.reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  target text not null,
  author text not null,
  stars integer not null check (stars between 1 and 5),
  text text not null check (char_length(text) >= 10),
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  code text not null unique,
  points integer not null,
  discount integer not null,
  status text not null default 'active' check (status in ('active', 'used', 'expired')),
  created_at timestamptz not null default now()
);

create table if not exists public.movements (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id),
  detail text not null,
  points integer not null,
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_recent_idx on public.purchases(user_id, created_at desc);
create index if not exists purchases_store_pending_idx on public.purchases(store_id, status, created_at desc);
create index if not exists reviews_target_recent_idx on public.reviews(target, created_at desc);
create index if not exists movements_user_recent_idx on public.movements(user_id, created_at desc);

-- Migra el modelo anterior de dos roles al modelo admin / brand / user.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role='brand' where role='merchant';
alter table public.profiles add constraint profiles_role_check check (role in ('user','brand','administrator'));

-- Crea automáticamente el perfil y los puntos de bienvenida al registrarse.
create or replace function public.create_fintacc_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  insert into public.profiles(id, name) values (new.id, display_name);
  insert into public.movements(user_id, detail, points) values (new.id, 'Bono de bienvenida', 50);
  return new;
end;
$$;

drop trigger if exists on_fintacc_user_created on auth.users;
create trigger on_fintacc_user_created
after insert on auth.users
for each row execute function public.create_fintacc_profile();

-- El nombre que se muestra en una reseña siempre sale del perfil autenticado.
create or replace function public.set_review_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select name into new.author from public.profiles where id = new.user_id;
  if new.author is null then raise exception 'No se encontró el perfil de la cuenta'; end if;
  return new;
end;
$$;
drop trigger if exists on_fintacc_review_created on public.reviews;
create trigger on_fintacc_review_created
before insert on public.reviews
for each row execute function public.set_review_author();

-- Locales iniciales del prototipo. Asigná un usuario merchant a Almacén Raíz
-- después de crear/aprobar la cuenta de comercio.
insert into public.stores(id, name, qr_token) values
  ('raiz', 'Almacén Raíz', 'FINTACC-STORE-RAIZ'),
  ('brote', 'Brote Cocina Verde', 'FINTACC-STORE-BROTE'),
  ('masamadre', 'Masa Libre Panadería', 'FINTACC-STORE-MASAMADRE'),
  ('lacuchara', 'La Cuchara Libre', 'FINTACC-STORE-LACUCHARA'),
  ('verdeurquiza', 'Verde Urquiza', 'FINTACC-STORE-VERDEURQUIZA'),
  ('centro', 'Mercado Libre de Gluten', 'FINTACC-STORE-CENTRO')
on conflict (id) do nothing;

-- Reaplica los metadatos iniciales luego de crear los locales (también funciona
-- al volver a ejecutar el esquema en un proyecto ya existente).
update public.stores set type='Dietética', neighborhood='Palermo', address='Gorriti 4800', hours='Lun a sáb · 9 a 20 h', rating=4.8, verified=true, verification='["Sector exclusivo sin TACC","Productos con registro ANMAT","Personal capacitado"]'::jsonb, map_x=60, map_y=30, latitude=-34.588, longitude=-58.421 where id='raiz' and neighborhood='';
update public.stores set type='Restaurante', neighborhood='Villa Crespo', address='Thames 520', hours='Mar a dom · 12 a 23 h', rating=4.6, verified=true, verification='["Cocina separada para platos sin TACC","Carta con platos sin TACC identificados","Personal capacitado"]'::jsonb, menu='[{"plato":"Bowl de quinoa y vegetales asados"},{"plato":"Ñoquis de papa sin TACC"},{"plato":"Curry de garbanzos"}]'::jsonb, map_x=34, map_y=52, latitude=-34.599, longitude=-58.436 where id='brote' and neighborhood='';
update public.stores set type='Panadería', neighborhood='Belgrano', address='Juramento 2100', hours='Lun a sáb · 8 a 20 h', rating=4.9, verified=true, verification='["Elaboración 100 % sin TACC","Horno exclusivo","Certificación vigente"]'::jsonb, menu='[{"plato":"Pan de molde de trigo sarraceno"},{"plato":"Medialunas sin TACC"},{"plato":"Budín de limón sin TACC"}]'::jsonb, map_x=50, map_y=18, latitude=-34.562, longitude=-58.456 where id='masamadre' and neighborhood='';
update public.stores set type='Restaurante', neighborhood='Recoleta', address='Av. Las Heras 2300', hours='Lun a sáb · 12 a 16 h', rating=4.4, verified=true, verification='["Carta con platos sin TACC identificados","Freidora exclusiva sin TACC","Personal capacitado"]'::jsonb, menu='[{"plato":"Salmón con espárragos"},{"plato":"Ensalada César con croutons sin TACC"}]'::jsonb, map_x=64, map_y=44, latitude=-34.587, longitude=-58.397 where id='lacuchara' and neighborhood='';
update public.stores set type='Café', neighborhood='Villa Urquiza', address='Triunvirato 4500', hours='Todos los días · 8 a 21 h', rating=4.5, verified=true, verification='["Tostadora exclusiva para pan sin TACC","Opciones sin TACC envasadas y cerradas","Carta con platos sin TACC identificados"]'::jsonb, menu='[{"plato":"Tostado en pan sin TACC"},{"plato":"Brownie sin TACC"}]'::jsonb, map_x=30, map_y=14, latitude=-34.571, longitude=-58.488 where id='verdeurquiza' and neighborhood='';
update public.stores set type='Dietética', neighborhood='Microcentro', address='Florida 650', hours='Lun a vie · 9 a 19 h', rating=4.2, verified=false, map_x=80, map_y=62, latitude=-34.6037, longitude=-58.378 where id='centro' and neighborhood='';

-- RLS: el cliente web usa únicamente la publishable key; cada rol tiene alcance
-- explícito. Administrator tiene acceso global, brand a su propia marca y user
-- solo a su perfil y datos necesarios para canjear puntos.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.merchants enable row level security;
alter table public.purchases enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.movements enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.brand_customers enable row level security;
alter table public.product_categories enable row level security;

create or replace function public.is_fintacc_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='administrator') $$;
create or replace function public.is_fintacc_brand()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='brand') $$;
revoke all on function public.is_fintacc_admin() from public;
revoke all on function public.is_fintacc_brand() from public;
grant execute on function public.is_fintacc_admin(), public.is_fintacc_brand() to authenticated;

-- Retira permisos y políticas amplias de la versión anterior antes de instalar
-- las reglas separadas por rol.
drop policy if exists "profile owner can read" on public.profiles;
drop policy if exists "active stores are public" on public.stores;
drop policy if exists "active products are public" on public.products;
drop policy if exists "active recipes are public" on public.recipes;
drop policy if exists "merchant applications can be submitted" on public.merchants;
drop policy if exists "reviews are public" on public.reviews;
drop policy if exists "users can publish own review" on public.reviews;
drop policy if exists "buyer or store merchant can read purchase" on public.purchases;
drop policy if exists "users can read own coupons" on public.coupons;
drop policy if exists "users can read own movements" on public.movements;
drop policy if exists "brand manages stores" on public.stores;
drop policy if exists "brand manages products" on public.products;
drop policy if exists "brand manages recipes" on public.recipes;
drop policy if exists "brand reads all profiles" on public.profiles;
drop policy if exists "brand updates profile roles" on public.profiles;

drop policy if exists "public reads active stores" on public.stores;
create policy "public reads active stores" on public.stores for select to anon, authenticated using (status='active' and public_visible);
drop policy if exists "public reads active products" on public.products;
create policy "public reads active products" on public.products for select to anon, authenticated using (active and public_visible);
drop policy if exists "public reads active recipes" on public.recipes;
create policy "public reads active recipes" on public.recipes for select to anon using (active);
drop policy if exists "brands read public recipes" on public.recipes;
create policy "brands read public recipes" on public.recipes for select to authenticated using (active and public.is_fintacc_brand());
drop policy if exists "public reads reviews" on public.reviews;
create policy "public reads reviews" on public.reviews for select to anon using (true);
drop policy if exists "public submits merchant applications" on public.merchants;
create policy "public submits merchant applications" on public.merchants for insert to anon with check (status='pending');

drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile" on public.profiles for select to authenticated using (id=(select auth.uid()));
drop policy if exists "administrators read all profiles" on public.profiles;
create policy "administrators read all profiles" on public.profiles for select to authenticated using (public.is_fintacc_admin());
drop policy if exists "brands read linked customers" on public.profiles;
create policy "brands read linked customers" on public.profiles for select to authenticated using (
  public.is_fintacc_brand() and exists(select 1 from public.brand_customers bc where bc.brand_user_id=auth.uid() and bc.customer_user_id=profiles.id)
);

drop policy if exists "administrators manage stores" on public.stores;
create policy "administrators manage stores" on public.stores for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "brands manage own stores" on public.stores;
create policy "brands manage own stores" on public.stores for all to authenticated using (public.is_fintacc_brand() and brand_user_id=auth.uid()) with check (public.is_fintacc_brand() and brand_user_id=auth.uid());
drop policy if exists "administrators manage products" on public.products;
create policy "administrators manage products" on public.products for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "brands manage own products" on public.products;
create policy "brands manage own products" on public.products for all to authenticated using (public.is_fintacc_brand() and brand_user_id=auth.uid()) with check (public.is_fintacc_brand() and brand_user_id=auth.uid());
drop policy if exists "brands manage own categories" on public.product_categories;
create policy "brands manage own categories" on public.product_categories for all to authenticated using (brand_user_id=auth.uid() and public.is_fintacc_brand()) with check (brand_user_id=auth.uid() and public.is_fintacc_brand());
drop policy if exists "administrators manage categories" on public.product_categories;
create policy "administrators manage categories" on public.product_categories for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "administrators manage recipes" on public.recipes;
create policy "administrators manage recipes" on public.recipes for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());

drop policy if exists "administrators manage merchants" on public.merchants;
create policy "administrators manage merchants" on public.merchants for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "administrators manage purchases" on public.purchases;
create policy "administrators manage purchases" on public.purchases for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "brands read own store purchases" on public.purchases;
create policy "brands read own store purchases" on public.purchases for select to authenticated using (
  public.is_fintacc_brand() and exists(select 1 from public.stores s where s.id=purchases.store_id and s.brand_user_id=auth.uid())
);
drop policy if exists "administrators manage reviews" on public.reviews;
create policy "administrators manage reviews" on public.reviews for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "users read own coupons" on public.coupons;
create policy "users read own coupons" on public.coupons for select to authenticated using (user_id=auth.uid());
drop policy if exists "administrators manage coupons" on public.coupons;
create policy "administrators manage coupons" on public.coupons for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "users read own movements" on public.movements;
create policy "users read own movements" on public.movements for select to authenticated using (user_id=auth.uid());
drop policy if exists "administrators manage movements" on public.movements;
create policy "administrators manage movements" on public.movements for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());
drop policy if exists "brands read own client links" on public.brand_customers;
create policy "brands read own client links" on public.brand_customers for select to authenticated using (brand_user_id=auth.uid() and public.is_fintacc_brand());
drop policy if exists "administrators manage client links" on public.brand_customers;
create policy "administrators manage client links" on public.brand_customers for all to authenticated using (public.is_fintacc_admin()) with check (public.is_fintacc_admin());

revoke insert, update, delete on public.profiles, public.stores, public.products, public.recipes, public.merchants, public.purchases, public.reviews, public.coupons, public.movements, public.brand_customers from anon, authenticated;
revoke select on public.profiles, public.purchases, public.coupons, public.movements, public.brand_customers from anon;
revoke select on public.stores, public.products, public.recipes, public.reviews from authenticated;
revoke update (role) on public.profiles from authenticated;
grant select on public.profiles, public.purchases, public.coupons, public.movements, public.brand_customers to authenticated;
grant select on public.stores, public.products, public.recipes to anon;
grant select on public.reviews to anon;
grant select, insert, update, delete on public.stores, public.products, public.recipes, public.merchants, public.purchases, public.reviews, public.coupons, public.movements, public.brand_customers, public.product_categories to authenticated;
grant select on public.stores, public.products, public.recipes to authenticated;
grant insert on public.merchants to anon;
revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.update_own_profile(p_name text)
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare changed public.profiles;
begin
  if auth.uid() is null or char_length(trim(p_name)) < 2 then raise exception 'Ingresá un nombre válido'; end if;
  update public.profiles set name=trim(p_name) where id=auth.uid() returning * into changed;
  return changed;
end;
$$;

create or replace function public.update_brand_logo(p_logo_url text)
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare changed public.profiles;
begin
  if auth.uid() is null or not public.is_fintacc_brand() then raise exception 'Solo una marca puede editar su perfil público'; end if;
  if p_logo_url is not null and p_logo_url !~ '^https://[^[:space:]]+$' then raise exception 'Imagen no válida'; end if;
  update public.profiles set brand_logo_url=p_logo_url where id=auth.uid() returning * into changed;
  return changed;
end;
$$;

create or replace function public.search_brand_customers(p_query text)
returns table(id uuid,name text,email text,points integer)
language plpgsql stable security definer set search_path=public,auth
as $$
begin
  if auth.uid() is null or not (public.is_fintacc_admin() or public.is_fintacc_brand()) then raise exception 'No tenés permiso para buscar clientes'; end if;
  if char_length(trim(coalesce(p_query,'')))<2 then return; end if;
  return query
    select p.id,p.name,u.email::text,p.points from public.profiles p join auth.users u on u.id=p.id
    where p.role='user' and (p.name ilike '%'||trim(p_query)||'%' or u.email ilike '%'||trim(p_query)||'%')
    order by p.name limit 12;
end;
$$;

create or replace function public.admin_update_profile(p_user_id uuid, p_name text, p_role text)
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare changed public.profiles;
begin
  if not public.is_fintacc_admin() then raise exception 'Solo un administrador puede editar perfiles'; end if;
  if p_role not in ('user','brand','administrator') then raise exception 'Rol inválido'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Ingresá un nombre válido'; end if;
  update public.profiles set name=trim(p_name), role=p_role where id=p_user_id returning * into changed;
  if not found then raise exception 'Perfil inexistente'; end if;
  return changed;
end;
$$;

create or replace function public.link_brand_customer(p_brand_user_id uuid, p_customer_email text)
returns public.brand_customers language plpgsql security definer set search_path=public
as $$
declare actor_id uuid:=auth.uid(); target_id uuid; target_brand uuid; linked public.brand_customers;
begin
  if actor_id is null then raise exception 'Iniciá sesión para continuar'; end if;
  if public.is_fintacc_admin() then target_brand:=p_brand_user_id;
  elsif public.is_fintacc_brand() then target_brand:=actor_id;
  else raise exception 'No tenés permiso para asociar clientes'; end if;
  if target_brand is null or not exists(select 1 from public.profiles where id=target_brand and role='brand') then raise exception 'Marca inválida'; end if;
  select id into target_id from auth.users where lower(email)=lower(trim(p_customer_email));
  if target_id is null then raise exception 'No existe una cuenta con ese email'; end if;
  if not exists(select 1 from public.profiles where id=target_id and role='user') then raise exception 'Solo se pueden asociar cuentas con rol user'; end if;
  insert into public.brand_customers(brand_user_id,customer_user_id) values(target_brand,target_id)
    on conflict(brand_user_id,customer_user_id) do update set customer_user_id=excluded.customer_user_id returning * into linked;
  return linked;
end;
$$;

create or replace function public.manage_client_points(p_user_id uuid, p_delta integer, p_detail text)
returns public.profiles language plpgsql security definer set search_path=public
as $$
declare actor_id uuid:=auth.uid(); changed public.profiles;
begin
  if actor_id is null then raise exception 'Iniciá sesión para continuar'; end if;
  if public.is_fintacc_brand() and not exists(select 1 from public.brand_customers where brand_user_id=actor_id and customer_user_id=p_user_id) then
    raise exception 'Solo podés gestionar los puntos de tus clientes asociados';
  elsif not public.is_fintacc_admin() and not public.is_fintacc_brand() then raise exception 'No tenés permiso para gestionar puntos'; end if;
  if p_delta=0 or char_length(trim(p_detail))<3 then raise exception 'Ingresá una variación y un motivo'; end if;
  update public.profiles set points=points+p_delta, earned=earned+greatest(p_delta,0)
    where id=p_user_id and points+p_delta>=0 returning * into changed;
  if not found then raise exception 'Perfil inexistente o saldo insuficiente'; end if;
  insert into public.movements(user_id,detail,points) values(p_user_id,trim(p_detail),p_delta);
  return changed;
end;
$$;

revoke all on function public.update_own_profile(text), public.update_brand_logo(text), public.search_brand_customers(text), public.admin_update_profile(uuid,text,text), public.link_brand_customer(uuid,text), public.manage_client_points(uuid,integer,text) from public;
grant execute on function public.update_own_profile(text), public.update_brand_logo(text), public.search_brand_customers(text), public.admin_update_profile(uuid,text,text), public.link_brand_customer(uuid,text), public.manage_client_points(uuid,integer,text) to authenticated;

create or replace function public.validate_product_store_scope()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if public.is_fintacc_brand() and exists (
    select 1 from jsonb_array_elements_text(coalesce(new.store_ids,'[]'::jsonb)) as sid(store_id)
    where not exists(select 1 from public.stores s where s.id=sid.store_id and s.brand_user_id=auth.uid())
  ) then raise exception 'Una marca solo puede vincular sus propios locales'; end if;
  return new;
end;
$$;
drop trigger if exists validate_product_store_scope on public.products;
create trigger validate_product_store_scope before insert or update of store_ids, brand_user_id on public.products
for each row execute function public.validate_product_store_scope();

create or replace function public.submit_purchase(p_store_id text, p_qr_token text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'El registro de compras está deshabilitado; la marca o administración gestiona los puntos';
end;
$$;

create or replace function public.redeem_coupon(p_points integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  discount_amount integer;
  coupon_code text;
begin
  if current_user_id is null then raise exception 'Iniciá sesión para continuar'; end if;
  discount_amount := case p_points when 250 then 2500 when 500 then 6000 when 1000 then 14000 else null end;
  if discount_amount is null then raise exception 'Canje no disponible'; end if;
  update public.profiles set points = points - p_points where id = current_user_id and points >= p_points;
  if not found then raise exception 'No tenés puntos suficientes'; end if;
  coupon_code := upper(substr(md5(random()::text || clock_timestamp()::text || current_user_id::text), 1, 8));
  insert into public.coupons(user_id, code, points, discount) values (current_user_id, coupon_code, p_points, discount_amount);
  insert into public.movements(user_id, detail, points) values (current_user_id, 'Canje de $' || discount_amount, -p_points);
  return jsonb_build_object('code', coupon_code, 'points', p_points, 'discount', discount_amount, 'status', 'active');
end;
$$;

create or replace function public.confirm_purchase(p_purchase_id bigint, p_receipt text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_purchase public.purchases%rowtype;
  target_store public.stores%rowtype;
begin
  if current_user_id is null then raise exception 'Iniciá sesión para continuar'; end if;
  if char_length(trim(p_receipt)) < 4 then raise exception 'Ingresá un número de ticket válido'; end if;
  select * into target_purchase from public.purchases where id = p_purchase_id and status = 'pending' and created_at > now() - interval '24 hours' for update;
  if not found then raise exception 'Compra pendiente inexistente o vencida'; end if;
  select * into target_store from public.stores where id = target_purchase.store_id;
  if public.is_fintacc_admin() then
    if target_store.brand_user_id is not null then
      insert into public.brand_customers(brand_user_id,customer_user_id) values(target_store.brand_user_id,target_purchase.user_id) on conflict do nothing;
    end if;
  elsif public.is_fintacc_brand() and target_store.brand_user_id=current_user_id then
    insert into public.brand_customers(brand_user_id,customer_user_id) values(current_user_id,target_purchase.user_id) on conflict do nothing;
  else
    raise exception 'Solo un administrador o la marca del local puede validar la compra';
  end if;
  update public.purchases set status = 'confirmed', reviewed_at = now(), receipt = trim(p_receipt) where id = p_purchase_id;
  update public.profiles set points = points + target_purchase.points, earned = earned + target_purchase.points where id = target_purchase.user_id;
  insert into public.movements(user_id, detail, points) values (target_purchase.user_id, 'Compra validada en ' || target_store.name, target_purchase.points);
  return jsonb_build_object('ok', true, 'points', target_purchase.points);
end;
$$;

revoke all on function public.submit_purchase(text, text, integer) from public;
revoke all on function public.redeem_coupon(integer) from public;
revoke all on function public.confirm_purchase(bigint, text) from public;
grant execute on function public.submit_purchase(text, text, integer) to authenticated;
grant execute on function public.redeem_coupon(integer) to authenticated;
grant execute on function public.confirm_purchase(bigint, text) to authenticated;
revoke all on function public.submit_purchase(text, text, integer) from authenticated;

-- Imágenes públicas de productos, locales y logotipos de marca.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('brand-assets','brand-assets',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists "public reads brand assets" on storage.objects;
create policy "public reads brand assets" on storage.objects for select to anon, authenticated using (bucket_id='brand-assets');
drop policy if exists "brands upload own assets" on storage.objects;
create policy "brands upload own assets" on storage.objects for insert to authenticated with check (
  bucket_id='brand-assets' and (public.is_fintacc_admin() or (public.is_fintacc_brand() and (storage.foldername(name))[1]=auth.uid()::text))
);
drop policy if exists "brands update own assets" on storage.objects;
create policy "brands update own assets" on storage.objects for update to authenticated using (
  bucket_id='brand-assets' and (public.is_fintacc_admin() or (public.is_fintacc_brand() and (storage.foldername(name))[1]=auth.uid()::text))
) with check (
  bucket_id='brand-assets' and (public.is_fintacc_admin() or (public.is_fintacc_brand() and (storage.foldername(name))[1]=auth.uid()::text))
);
drop policy if exists "brands delete own assets" on storage.objects;
create policy "brands delete own assets" on storage.objects for delete to authenticated using (
  bucket_id='brand-assets' and (public.is_fintacc_admin() or (public.is_fintacc_brand() and (storage.foldername(name))[1]=auth.uid()::text))
);

-- Roles iniciales acordados para las cuentas de este proyecto.
update public.profiles p set role='administrator' from auth.users u
where u.id=p.id and lower(u.email) in ('abril.marsico@davinci.edu.ar','candela.cusinier@davinci.edu.ar');
update public.profiles p set role='brand' from auth.users u
where u.id=p.id and lower(u.email)='abrilmarsico05@gmail.com';
update public.profiles p set role='user' from auth.users u
where u.id=p.id and lower(u.email)='cscusinier@gmail.com';

-- Refresca la caché de columnas de PostgREST tras aplicar el esquema.
notify pgrst, 'reload schema';
