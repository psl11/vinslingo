-- Migración FSRS (paso 2): estado del algoritmo FSRS en user_vocabulary +
-- tabla review_log. Ver docs/fsrs-migration.md.
--
-- Cómo aplicar: pegar este fichero en el SQL Editor del dashboard de Supabase
-- y ejecutarlo. Es aditivo e idempotente: no borra ni altera datos existentes
-- (SM-2 sigue operativo hasta el paso 4 de la migración).

-- 1) Columnas de estado FSRS en user_vocabulary.
--    Los timestamps (due, last_review) son timestamptz, igual que el
--    next_review_at existente; la capa de sync convierte ms <-> ISO.
alter table public.user_vocabulary
  add column if not exists stability      double precision default 0,
  add column if not exists difficulty     double precision default 0,
  add column if not exists elapsed_days   integer default 0,
  add column if not exists scheduled_days integer default 0,
  add column if not exists learning_steps integer default 0,
  add column if not exists reps           integer default 0,
  add column if not exists lapses         integer default 0,
  add column if not exists fsrs_state     integer default 0,
  add column if not exists due            timestamptz,
  add column if not exists last_review    timestamptz;

-- 2) Log de repasos FSRS (append-only), base para optimizar parámetros a futuro.
create table if not exists public.review_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  vocabulary_id uuid not null references public.vocabulary(id) on delete cascade,
  rating smallint not null,            -- grado FSRS 1-4 (Again/Hard/Good/Easy)
  state smallint not null,             -- estado PREVIO al repaso (0-3)
  due timestamptz,                     -- due previo
  stability double precision,
  difficulty double precision,
  elapsed_days integer,
  scheduled_days integer,
  review timestamptz not null,         -- momento del repaso
  review_duration_ms integer,          -- responseTimeMs, nullable
  created_at timestamptz not null default now()
);

create index if not exists idx_review_log_user_vocab
  on public.review_log(user_id, vocabulary_id);
create index if not exists idx_review_log_review
  on public.review_log(review);

-- 3) RLS: cada usuario solo ve/escribe sus propios repasos (mismo patrón que
--    user_vocabulary, que es dato personal de progreso).
alter table public.review_log enable row level security;

create policy "Users manage own review_log" on public.review_log
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
