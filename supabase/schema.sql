-- Fintacc · esquema inicial para Supabase (PostgreSQL)
-- Ejecutar completo desde Supabase Dashboard → SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null default 'user' check (role in ('user', 'merchant')),
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
  ('verdeurquiza', 'Verde Urquiza', 'FINTACC-STORE-VERDEURQUIZA')
on conflict (id) do nothing;

-- RLS: el cliente web usa únicamente la publishable key; las políticas
-- limitan cada operación al usuario autenticado.
alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.merchants enable row level security;
alter table public.purchases enable row level security;
alter table public.reviews enable row level security;
alter table public.coupons enable row level security;
alter table public.movements enable row level security;

drop policy if exists "profile owner can read" on public.profiles;
create policy "profile owner can read" on public.profiles for select to authenticated using (id = (select auth.uid()));

drop policy if exists "active stores are public" on public.stores;
create policy "active stores are public" on public.stores for select to anon, authenticated using (status = 'active');

drop policy if exists "merchant applications can be submitted" on public.merchants;
create policy "merchant applications can be submitted" on public.merchants for insert to anon, authenticated with check (status = 'pending');

drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews for select to anon, authenticated using (true);
drop policy if exists "users can publish own review" on public.reviews;
create policy "users can publish own review" on public.reviews for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "buyer or store merchant can read purchase" on public.purchases;
create policy "buyer or store merchant can read purchase" on public.purchases for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.stores s where s.id = purchases.store_id and s.merchant_user_id = (select auth.uid())
));

drop policy if exists "users can read own coupons" on public.coupons;
create policy "users can read own coupons" on public.coupons for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "users can read own movements" on public.movements;
create policy "users can read own movements" on public.movements for select to authenticated using (user_id = (select auth.uid()));

grant select on public.stores, public.reviews to anon, authenticated;
grant insert on public.merchants to anon, authenticated;
grant select on public.profiles, public.purchases, public.coupons, public.movements to authenticated;
grant insert on public.reviews to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.submit_purchase(p_store_id text, p_qr_token text, p_amount integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_store public.stores%rowtype;
  points_to_award integer;
  purchases_today integer;
  new_id bigint;
begin
  if current_user_id is null then raise exception 'Iniciá sesión para continuar'; end if;
  if p_amount < 1000 then raise exception 'La compra debe ser de al menos $1.000'; end if;
  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text, 0));
  select * into target_store from public.stores where id = p_store_id and qr_token = p_qr_token and status = 'active';
  if not found then raise exception 'QR de comercio inválido'; end if;
  select count(*) into purchases_today from public.purchases where user_id = current_user_id and created_at > now() - interval '24 hours';
  if purchases_today >= 5 then raise exception 'Alcanzaste el máximo de 5 compras en 24 horas'; end if;
  points_to_award := floor(p_amount / 1000.0)::integer;
  insert into public.purchases(user_id, store_id, amount, points) values (current_user_id, p_store_id, p_amount, points_to_award) returning id into new_id;
  return jsonb_build_object('id', new_id, 'status', 'pending', 'points_pending', points_to_award, 'expires_in_hours', 24);
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
  if target_store.merchant_user_id is null or target_store.merchant_user_id <> current_user_id then raise exception 'La compra corresponde a otro comercio'; end if;
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
