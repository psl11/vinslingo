# VinsLingo - Plan del Proyecto

App de aprendizaje de inglés con React Native + Expo, Supabase como backend.

---

## 1. Visión General

**Objetivo:** Aplicación móvil para aprender inglés desde español, usando vocabulario basado en corpus (NGSL + PHaVE) y repetición espaciada (SRS).

**Características principales:**
- Interfaz en español, contenido para aprender inglés
- Sistema SRS con algoritmo SM-2
- Ejercicios variados: traducción, cloze, multiple choice, audio
- Base de datos local con sincronización a remoto cuando hay conexión
- Onboarding: primera lección antes de signup

---

## 2. Stack Técnico

| Componente | Tecnología |
|------------|------------|
| **Framework** | React Native + Expo SDK |
| **Lenguaje** | TypeScript |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) |
| **Estado local** | React Context + AsyncStorage |
| **Base de datos local** | SQLite (expo-sqlite) |
| **Sincronización** | Custom sync logic (local-first) |
| **Navegación** | Expo Router |
| **UI** | React Native + NativeWind (TailwindCSS) |
| **Audio** | expo-av |
| **Notificaciones** | expo-notifications |
| **Haptics** | expo-haptics |

---

## 3. Arquitectura de la Aplicación

```
vinslingo/
├── app/                    # Expo Router (pantallas)
│   ├── (auth)/            # Pantallas de autenticación
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/            # Navegación principal
│   │   ├── home.tsx       # Dashboard
│   │   ├── learn.tsx      # Sesión de aprendizaje
│   │   ├── review.tsx     # Repaso SRS
│   │   └── profile.tsx    # Perfil usuario
│   ├── lesson/[id].tsx    # Lección individual
│   └── _layout.tsx
├── components/            # Componentes reutilizables
│   ├── ui/               # Componentes UI base
│   ├── cards/            # Tarjetas de ejercicio
│   └── exercises/        # Tipos de ejercicios
├── lib/                   # Lógica de negocio
│   ├── supabase.ts       # Cliente Supabase
│   ├── database/         # SQLite local
│   │   ├── schema.ts
│   │   ├── sync.ts       # Lógica de sincronización
│   │   └── queries.ts
│   ├── srs/              # Algoritmo SM-2
│   │   └── sm2.ts
│   └── utils/
├── hooks/                 # Custom hooks
├── contexts/              # React Context providers
├── constants/             # Constantes y config
├── assets/               # Imágenes, fuentes, audio
├── docs/                 # Documentación
└── types/                # TypeScript types
```

---

## 4. Modelo de Datos

### 4.1 Tablas en Supabase (PostgreSQL)

#### `users` (extensión de auth.users)
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  native_language TEXT DEFAULT 'es',
  target_language TEXT DEFAULT 'en',
  daily_goal_minutes INTEGER DEFAULT 10,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_xp INTEGER DEFAULT 0,
  cefr_level TEXT DEFAULT 'A1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `vocabulary` (palabras y phrasal verbs)
```sql
CREATE TABLE public.vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  pronunciation TEXT,
  audio_url TEXT,
  part_of_speech TEXT, -- n, v, adj, adv, etc.
  cefr_level TEXT NOT NULL, -- A1, A2, B1, B2, C1, C2
  category TEXT, -- ngsl, phave
  frequency_rank INTEGER,
  example_sentence TEXT,
  example_translation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vocabulary_cefr ON public.vocabulary(cefr_level);
CREATE INDEX idx_vocabulary_category ON public.vocabulary(category);
```

#### `user_vocabulary` (progreso del usuario por palabra)
```sql
CREATE TABLE public.user_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  
  -- SM-2 SRS fields
  ease_factor REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_at TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  
  -- Stats
  times_correct INTEGER DEFAULT 0,
  times_incorrect INTEGER DEFAULT 0,
  mastery_level INTEGER DEFAULT 0, -- 0=new, 1=learning, 2=reviewing, 3=mastered
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, vocabulary_id)
);

CREATE INDEX idx_user_vocab_review ON public.user_vocabulary(user_id, next_review_at);
CREATE INDEX idx_user_vocab_mastery ON public.user_vocabulary(user_id, mastery_level);
```

#### `lessons` (lecciones estructuradas)
```sql
CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cefr_level TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  category TEXT, -- vocabulary, phrasal_verbs, grammar
  estimated_minutes INTEGER DEFAULT 10,
  xp_reward INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lessons_level ON public.lessons(cefr_level, order_index);
```

#### `lesson_vocabulary` (vocabulario por lección)
```sql
CREATE TABLE public.lesson_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  
  UNIQUE(lesson_id, vocabulary_id)
);
```

#### `user_lessons` (progreso del usuario por lección)
```sql
CREATE TABLE public.user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  
  status TEXT DEFAULT 'locked', -- locked, available, in_progress, completed
  progress_percent INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  best_score INTEGER,
  attempts INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, lesson_id)
);
```

#### `study_sessions` (sesiones de estudio)
```sql
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  session_type TEXT NOT NULL, -- lesson, review, practice
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  
  cards_studied INTEGER DEFAULT 0,
  cards_correct INTEGER DEFAULT 0,
  xp_earned INTEGER DEFAULT 0,
  
  lesson_id UUID REFERENCES public.lessons(id),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON public.study_sessions(user_id, started_at DESC);
```

#### `exercise_attempts` (intentos de ejercicios)
```sql
CREATE TABLE public.exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  vocabulary_id UUID REFERENCES public.vocabulary(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.study_sessions(id) ON DELETE CASCADE,
  
  exercise_type TEXT NOT NULL, -- translation, cloze, multiple_choice, audio
  direction TEXT NOT NULL, -- en_to_es, es_to_en
  is_correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  user_answer TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attempts_user ON public.exercise_attempts(user_id, created_at DESC);
```

### 4.2 Schema SQLite Local (Offline)

Mismas tablas replicadas localmente para funcionamiento offline:

```typescript
// lib/database/schema.ts
export const LOCAL_SCHEMA = `
  -- Vocabulario (cache de servidor)
  CREATE TABLE IF NOT EXISTS vocabulary (
    id TEXT PRIMARY KEY,
    word TEXT NOT NULL,
    translation TEXT NOT NULL,
    pronunciation TEXT,
    part_of_speech TEXT,
    cefr_level TEXT NOT NULL,
    category TEXT,
    frequency_rank INTEGER,
    example_sentence TEXT,
    example_translation TEXT,
    synced_at INTEGER
  );

  -- Progreso del usuario (sync bidireccional)
  CREATE TABLE IF NOT EXISTS user_vocabulary (
    id TEXT PRIMARY KEY,
    vocabulary_id TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review_at INTEGER,
    last_reviewed_at INTEGER,
    times_correct INTEGER DEFAULT 0,
    times_incorrect INTEGER DEFAULT 0,
    mastery_level INTEGER DEFAULT 0,
    updated_at INTEGER,
    needs_sync INTEGER DEFAULT 0,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabulary(id)
  );

  -- Cola de sincronización
  CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL,
    payload TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    synced_at INTEGER
  );
`;
```

---

## 5. Algoritmo SRS (SM-2)

```typescript
// lib/srs/sm2.ts
export interface SM2Card {
  easeFactor: number;      // 1.3 - 2.5+
  interval: number;        // días hasta próxima revisión
  repetitions: number;     // veces respondida correctamente en fila
  nextReviewAt: Date;
}

export type Quality = 0 | 1 | 2 | 3 | 4 | 5;
// 0 = blackout, 1 = incorrect, 2 = incorrect but remembered
// 3 = correct with difficulty, 4 = correct, 5 = perfect

export function calculateSM2(card: SM2Card, quality: Quality): SM2Card {
  let { easeFactor, interval, repetitions } = card;

  if (quality < 3) {
    // Reset on failure
    repetitions = 0;
    interval = 1;
  } else {
    // Success
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  // Update ease factor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easeFactor = Math.max(1.3, easeFactor);

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + interval);

  return {
    easeFactor,
    interval,
    repetitions,
    nextReviewAt,
  };
}
```

---

## 6. Flujo de Sincronización

```
┌─────────────────────────────────────────────────────────────┐
│                    ESTRATEGIA LOCAL-FIRST                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Usuario realiza acción → Guarda en SQLite local         │
│                                                             │
│  2. Marca registro como "needs_sync = 1"                    │
│                                                             │
│  3. Si hay conexión:                                        │
│     a. Envía cambios locales a Supabase                     │
│     b. Recibe cambios del servidor                          │
│     c. Resuelve conflictos (último timestamp gana)          │
│     d. Marca "needs_sync = 0"                               │
│                                                             │
│  4. Si no hay conexión:                                     │
│     a. Continúa usando datos locales                        │
│     b. Acumula cambios en sync_queue                        │
│     c. Sincroniza cuando recupere conexión                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Tipos de Ejercicios

### 7.1 Traducción (Translation)
- EN → ES: "What does 'hello' mean?"
- ES → EN: "¿Cómo se dice 'hola' en inglés?"

### 7.2 Cloze (Fill-in-the-blank)
- "I need to ___ up early tomorrow" (wake)
- Contexto con la palabra oculta

### 7.3 Multiple Choice
- 4 opciones, 1 correcta
- Distractores basados en similitud semántica

### 7.4 Audio (futuro)
- Escuchar y escribir
- Escuchar y seleccionar significado

---

## 8. Roadmap de Desarrollo

### Fase 1: MVP (2-3 semanas)
- [ ] Setup proyecto Expo + TypeScript
- [ ] Configurar Supabase (auth, database)
- [ ] Implementar SQLite local
- [ ] Crear tablas en Supabase
- [ ] Importar vocabulario NGSL + PHaVE
- [ ] UI básica: Home, Learn, Profile
- [ ] Ejercicios: traducción simple
- [ ] Algoritmo SM-2 funcional
- [ ] Autenticación básica

### Fase 2: Core Features (2-3 semanas)
- [ ] Sincronización local-remoto
- [ ] Sistema de lecciones estructuradas
- [ ] Ejercicios: cloze, multiple choice
- [ ] Progreso visual por lección
- [ ] Onboarding flow
- [ ] Manejo offline completo

### Fase 3: Polish (1-2 semanas)
- [ ] UI/UX refinado
- [ ] Animaciones y transiciones
- [ ] Haptics feedback
- [ ] Dark mode
- [ ] Estadísticas detalladas
- [ ] Notificaciones de repaso

### Fase 4: Extras (futuro)
- [ ] Audio pronunciación
- [ ] Ejercicios de audio
- [ ] Gamificación (streaks, XP, levels)
- [ ] Logros y badges
- [ ] Social features

---

## 9. Configuración Inicial Necesaria

### 9.1 Variables de Entorno
```env
EXPO_PUBLIC_SUPABASE_URL=https://qsdzoelgqyymtwublxoq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

### 9.2 Dependencias Principales
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "expo-sqlite": "~14.x",
    "expo-router": "~4.x",
    "expo-secure-store": "~14.x",
    "nativewind": "^4.x",
    "react-native-reanimated": "~3.x",
    "expo-av": "~14.x",
    "expo-haptics": "~14.x",
    "expo-notifications": "~0.x"
  }
}
```

---

## 10. Supabase Project Info

| Campo | Valor |
|-------|-------|
| **Project ID** | `qsdzoelgqyymtwublxoq` |
| **Region** | `eu-north-1` |
| **URL** | `https://qsdzoelgqyymtwublxoq.supabase.co` |

---

## 11. GitHub Repository

- **Account:** psl11
- **Repo:** vinslingo (a crear)

---

## Referencias

- [NGSL - New General Service List](http://www.newgeneralservicelist.org)
- [PHaVE List](https://www.edu.uwo.ca/PHaVE)
- [SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
