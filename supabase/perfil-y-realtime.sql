-- Fintacc · edición del perfil personal y reviews en tiempo real
-- Ejecutar después de puntos.sql. Se puede volver a correr sin romper datos existentes.

begin;

-- Cada cuenta puede cambiar su propio nombre. La política de update por dueño
-- ya existe en marcas-y-contenido.sql; acá solo se habilita la columna.
grant update (name) on public.profiles to authenticated;

-- Reviews en tiempo real: las inserciones se publican por Supabase Realtime.
-- La lectura sigue protegida por la política "reviews are public" (RLS).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'reviews'
  ) then
    alter publication supabase_realtime add table public.reviews;
  end if;
end;
$$;

commit;
