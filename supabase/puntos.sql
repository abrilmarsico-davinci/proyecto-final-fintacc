-- Fintacc · puntos
-- La marca carga las compras de sus clientes y valida los cupones canjeados.

begin;

alter table public.coupons add column if not exists used_by uuid references public.profiles(id);
alter table public.coupons add column if not exists used_at timestamptz;

-- Código del cliente: primeros 8 caracteres del id
create or replace function public.codigo_cliente(p_id uuid)
returns text language sql immutable as $$
  select upper(left(replace(p_id::text, '-', ''), 8))
$$;

-- Carga de una compra (marca dueña del local o administrador)
create or replace function public.award_points(p_customer text, p_store_id text, p_amount integer, p_receipt text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_store public.stores%rowtype;
  v_customer uuid;
  v_name text;
  v_points integer;
  v_matches integer;
  v_receipt text := nullif(trim(coalesce(p_receipt, '')), '');
begin
  if v_uid is null then raise exception 'Iniciá sesión para continuar'; end if;
  select role into v_role from public.profiles where id = v_uid;

  select * into v_store from public.stores where id = p_store_id;
  if not found then raise exception 'El local no existe'; end if;
  if not (v_role = 'administrator' or (v_role = 'brand' and v_store.merchant_user_id = v_uid)) then
    raise exception 'Solo la marca dueña del local puede cargar puntos';
  end if;

  if p_amount is null or p_amount < 1000 then raise exception 'La compra debe ser de al menos $1.000'; end if;
  if p_amount > 1000000 then raise exception 'El monto máximo por compra es $1.000.000'; end if;

  if position('@' in coalesce(p_customer, '')) > 0 then
    select u.id into v_customer from auth.users u where lower(u.email) = lower(trim(p_customer));
  else
    select count(*) into v_matches from public.profiles where public.codigo_cliente(id) = upper(trim(p_customer));
    if v_matches > 1 then raise exception 'El código coincide con más de una cuenta; usá el email del cliente'; end if;
    select id into v_customer from public.profiles where public.codigo_cliente(id) = upper(trim(p_customer));
  end if;
  if v_customer is null then raise exception 'No encontramos un cliente con ese código o email'; end if;
  if v_customer = v_uid then raise exception 'No podés cargarte puntos a vos mismo'; end if;

  select name into v_name from public.profiles where id = v_customer;
  v_points := floor(p_amount / 1000.0)::integer;

  insert into public.purchases (user_id, store_id, amount, points, status, reviewed_at, receipt)
  values (v_customer, p_store_id, p_amount, v_points, 'confirmed', now(), v_receipt);

  update public.profiles set points = points + v_points, earned = earned + v_points where id = v_customer;
  insert into public.movements (user_id, detail, points) values (v_customer, 'Compra en ' || v_store.name, v_points);

  return jsonb_build_object('cliente', v_name, 'puntos', v_points, 'local', v_store.name);
exception
  when unique_violation then raise exception 'Ese número de ticket ya se cargó en este local';
end;
$$;

-- Validación de un cupón
create or replace function public.use_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_coupon public.coupons%rowtype;
  v_name text;
begin
  if v_uid is null then raise exception 'Iniciá sesión para continuar'; end if;
  select role into v_role from public.profiles where id = v_uid;
  if v_role not in ('brand', 'administrator') then raise exception 'Solo una marca puede validar cupones'; end if;

  update public.coupons
  set status = 'used', used_by = v_uid, used_at = now()
  where code = upper(trim(p_code)) and status = 'active'
  returning * into v_coupon;
  if not found then raise exception 'El cupón no existe o ya fue utilizado'; end if;
  if v_coupon.user_id = v_uid then raise exception 'No podés validar tu propio cupón'; end if;

  select name into v_name from public.profiles where id = v_coupon.user_id;
  return jsonb_build_object('cliente', v_name, 'codigo', v_coupon.code, 'descuento', v_coupon.discount, 'puntos', v_coupon.points);
end;
$$;

-- Compras cargadas y cupones validados por la marca
create or replace function public.brand_activity()
returns table (tipo text, fecha timestamptz, cliente text, detalle text, puntos integer, monto integer)
language sql
stable
security definer
set search_path = public
as $$
  with yo as (select id, role from public.profiles where id = auth.uid())
  select 'compra', p.reviewed_at, pr.name, s.name || coalesce(' · ticket ' || p.receipt, ''), p.points, p.amount
  from public.purchases p
  join public.stores s on s.id = p.store_id
  join public.profiles pr on pr.id = p.user_id
  cross join yo
  where p.status = 'confirmed' and (s.merchant_user_id = yo.id or yo.role = 'administrator')
  union all
  select 'canje', c.used_at, pr.name, 'Cupón ' || c.code, -c.points, c.discount
  from public.coupons c
  join public.profiles pr on pr.id = c.user_id
  cross join yo
  where c.status = 'used' and (c.used_by = yo.id or yo.role = 'administrator')
  order by 2 desc nulls last
  limit 100
$$;

revoke all on function public.award_points(text, text, integer, text) from public;
revoke all on function public.use_coupon(text) from public;
revoke all on function public.brand_activity() from public;
grant execute on function public.award_points(text, text, integer, text) to authenticated;
grant execute on function public.use_coupon(text) to authenticated;
grant execute on function public.brand_activity() to authenticated;

commit;
