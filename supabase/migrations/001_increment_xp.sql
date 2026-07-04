-- Incremento atómico de XP para evitar la condición de carrera del patrón
-- leer-luego-escribir en profiles.total_xp (dos sesiones simultáneas podían
-- pisarse y perder XP).
--
-- Cómo aplicar: pegar este fichero en el SQL Editor del dashboard de Supabase
-- y ejecutarlo. El código de la app (addUserXp) intenta usar este RPC y, si no
-- existe todavía, cae al método antiguo — así que se puede aplicar cuando sea.

create or replace function public.increment_xp(amount integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set total_xp = coalesce(total_xp, 0) + amount,
      updated_at = now()
  where id = auth.uid();
$$;

-- Solo usuarios autenticados pueden sumarse XP (a sí mismos, via auth.uid()).
revoke all on function public.increment_xp(integer) from public;
grant execute on function public.increment_xp(integer) to authenticated;
