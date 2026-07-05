-- Esquema para citas célebres (autores clásicos/históricos, dominio público)
-- que ilustren idioms, phrasal verbs y expresiones — mismo patrón que
-- artists/songs/song_vocabulary para las canciones.
--
-- Cómo aplicar: pegar este fichero en el SQL Editor del dashboard de
-- Supabase y ejecutarlo.

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  birth_year integer,
  death_year integer,
  created_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.authors(id) on delete cascade,
  quote_text text not null,
  source text, -- obra/discurso de origen, si se conoce (opcional)
  created_at timestamptz not null default now()
);

create table if not exists public.quote_vocabulary (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  highlighted_word text not null,
  created_at timestamptz not null default now()
);

-- Columnas denormalizadas en vocabulary, igual que song_lyric/song_lyric_translation
alter table public.vocabulary
  add column if not exists quote_text text,
  add column if not exists quote_translation text,
  add column if not exists quote_author text;

-- RLS: mismo patrón que las tablas de contenido existentes (lectura pública,
-- escritura solo con service_role).
alter table public.authors enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_vocabulary enable row level security;

create policy "Public read access" on public.authors for select using (true);
create policy "Public read access" on public.quotes for select using (true);
create policy "Public read access" on public.quote_vocabulary for select using (true);
