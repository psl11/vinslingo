-- Letras completas, privadas.
--
-- Guarda la letra entera de cada canción para poder leerla en la app (también en
-- el móvil), pero SIN publicarla: la tabla vive solo en Supabase, con Row Level
-- Security, y solo la puede leer una cuenta concreta. No entra en el repo, no
-- entra en el bundle, y no está en CONTENT_TABLES del script de backup.
--
-- Ejecutar una vez desde el editor SQL de Supabase:
--   Dashboard → SQL Editor → New query → pegar esto → Run
--
-- Después, poblarla desde local con:
--   node scripts/upload-lyrics.mjs            (prueba en seco)
--   node scripts/upload-lyrics.mjs --apply
--
-- Ver docs/song-lyrics-privadas.md.

create table if not exists public.song_lyrics (
  song_id    uuid primary key references public.songs(id) on delete cascade,
  lyrics     text not null,
  updated_at timestamptz not null default now()
);

alter table public.song_lyrics enable row level security;

-- Sin políticas de INSERT/UPDATE/DELETE a propósito: nadie escribe desde la app.
-- El script de carga usa la service role key, que se salta la RLS por diseño.
drop policy if exists "song_lyrics: solo el dueño lee" on public.song_lyrics;
create policy "song_lyrics: solo el dueño lee"
  on public.song_lyrics
  for select
  to authenticated
  using ( (auth.jwt() ->> 'email') = 'pasaloray@gmail.com' );

-- Cinturón y tirantes: que el rol anónimo no tenga ni permiso de tabla.
-- Con RLS activada ya no vería nada, pero así tampoco puede ni intentarlo.
revoke all on public.song_lyrics from anon;
grant select on public.song_lyrics to authenticated;

comment on table public.song_lyrics is
  'Letras completas con copyright. Privada: RLS restringe SELECT a una sola cuenta. NO incluir en backups versionados.';
