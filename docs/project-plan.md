# VinsLingo - Plan del Proyecto

**Versión**: 2.0  
**Fecha**: Enero 2026  
**Estado**: En desarrollo

App de aprendizaje de inglés con React Native + Expo, Supabase como backend, arquitectura offline-first.

---

## 1. Visión General

### 1.1 Objetivo
Aplicación móvil para aprender inglés desde español, usando vocabulario basado en corpus (NGSL + PHaVE) y repetición espaciada (SRS).

### 1.2 Problema a Resolver
- Los hispanohablantes necesitan dominar ~2800 palabras (NGSL) para entender el 92% del inglés general
- Los phrasal verbs son particularmente difíciles (150 phrasal verbs = 51% de uso real)
- Las apps existentes son genéricas y no permiten estudio enfocado y offline

### 1.3 Propuesta de Valor
- **Contenido curado**: 2800 palabras NGSL + 150 phrasal verbs PHaVE basados en corpus lingüístico
- **Offline-first**: Funciona sin internet, sincroniza cuando hay conexión
- **SRS científico**: Algoritmo SM-2 para optimizar memorización
- **Ejercicios variados**: Traducción, cloze, multiple choice, audio

### 1.4 Características Principales
- Interfaz en español, contenido para aprender inglés
- Sistema SRS con algoritmo SM-2
- Ejercicios variados: traducción, cloze, multiple choice, audio
- Base de datos local con sincronización a remoto cuando hay conexión
- Onboarding: primera lección antes de signup
- Gamificación: streaks, XP, niveles, logros

---

## 2. Stack Técnico

| Componente | Tecnología | Justificación |
|------------|------------|---------------|
| **Framework** | React Native + Expo SDK | Cross-platform, ecosistema maduro |
| **Lenguaje** | TypeScript | Type-safety, mejor DX |
| **Backend** | Supabase (PostgreSQL + Auth + Storage) | BaaS completo, RLS, realtime |
| **Estado Global** | Zustand | Selectores, persistencia, sin re-renders innecesarios |
| **Estado Persistente** | AsyncStorage | Simple, sin native modules extra |
| **Base de datos local** | SQLite (expo-sqlite) | Nativo, performante, offline |
| **Sincronización** | Custom sync logic (local-first) | Control total, gratis, patrón simple |
| **Navegación** | Expo Router | File-based routing, deep linking |
| **UI** | NativeWind (TailwindCSS) | Utilidad-first, consistencia |
| **Animaciones** | react-native-reanimated | 60 FPS, gestos nativos |
| **Audio** | expo-av | Pronunciación TTS |
| **Notificaciones** | expo-notifications | Recordatorios de repaso |
| **Haptics** | expo-haptics | Feedback táctil |

### 2.1 Justificación de Decisiones

#### ¿Por qué Zustand en vez de React Context?
- **Selectores**: Solo re-renderiza componentes que usan el slice de estado que cambió
- **Persistencia**: Middleware `persist` guarda estado automáticamente en AsyncStorage
- **Sin Provider**: No necesita wrappear la app
- **DevTools**: Debugging más fácil

#### ¿Por qué Custom Sync en vez de PowerSync?
- **Costo**: PowerSync cobra por volumen ($20+/mes), custom es gratis
- **Simplicidad**: Solo sincronizamos progreso del usuario (patrón simple)
- **Control**: Debugging más fácil, sin caja negra
- **Sin vendor lock-in**: No dependemos de terceros

---

## 3. Arquitectura de la Aplicación

```
vinslingo/
├── app/                      # Expo Router (file-based routing)
│   ├── (auth)/              # Pantallas de autenticación
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── onboarding.tsx
│   ├── (tabs)/              # Tab navigator principal
│   │   ├── index.tsx        # Home/Dashboard
│   │   ├── learn.tsx        # Sesión de aprendizaje
│   │   ├── review.tsx       # Repaso SRS
│   │   └── profile.tsx      # Perfil usuario
│   ├── lesson/[id].tsx      # Lección individual
│   ├── settings.tsx         # Configuración
│   └── _layout.tsx          # Root layout
├── components/
│   ├── cards/               # Componentes de tarjetas
│   │   ├── FlashCard.tsx
│   │   ├── TranslationCard.tsx
│   │   ├── ClozeCard.tsx
│   │   └── MultipleChoiceCard.tsx
│   ├── ui/                  # Componentes genéricos
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── ProgressBar.tsx
│   └── progress/            # Indicadores de progreso
├── stores/                  # Zustand stores
│   ├── useStudyStore.ts     # Estado de sesión de estudio
│   ├── useUserStore.ts      # Datos del usuario
│   ├── useSettingsStore.ts  # Configuración
│   └── useSyncStore.ts      # Estado de sincronización
├── lib/
│   ├── supabase.ts          # Cliente Supabase
│   ├── database/
│   │   ├── schema.ts        # Schema SQLite
│   │   ├── client.ts        # Cliente SQLite
│   │   ├── sync.ts          # Lógica de sincronización
│   │   └── queries.ts       # Queries comunes
│   ├── srs/
│   │   └── sm2.ts           # Algoritmo SM-2
│   └── utils/
├── hooks/                   # Custom hooks
├── constants/               # Constantes y config
├── assets/                  # Imágenes, fuentes, audio
├── docs/                    # Documentación
└── types/                   # TypeScript types
```

### 3.1 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native App                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌───────────┐    ┌───────────────────┐ │
│  │   Zustand   │←──→│  Queries  │←──→│   expo-sqlite     │ │
│  │   Stores    │    │           │    │   (Local DB)      │ │
│  └─────────────┘    └───────────┘    └─────────┬─────────┘ │
└───────────────────────────────────────────────────┼─────────┘
                                                    │
                                         ┌──────────▼──────────┐
                                         │    Custom Sync      │
                                         │    (sync.ts)        │
                                         └──────────┬──────────┘
                                                    │
                                         ┌──────────▼──────────┐
                                         │     Supabase        │
                                         │    PostgreSQL       │
                                         └─────────────────────┘
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

## 8. Diseño UI/UX

### 8.1 Principios de Diseño

1. **Simplicidad**: Interfaz limpia, sin distracciones
2. **Feedback inmediato**: Animaciones y haptics en cada interacción
3. **Accesibilidad**: Texto grande, contraste alto
4. **Consistencia**: Patrones repetidos, aprendizaje rápido

### 8.2 Mockups de Pantallas

#### Home (Dashboard)
```
┌─────────────────────────────────┐
│  VinsLingo              ⚙️     │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │  🔥 Racha: 7 días         │ │
│  │  📚 Palabras: 234/2950    │ │
│  │  ⭐ XP Total: 1,250       │ │
│  └───────────────────────────┘ │
│                                 │
│  ┌───────────────────────────┐ │
│  │  📖 Por revisar hoy: 15   │ │
│  │  ⭐ Nuevas disponibles: 10│ │
│  │                           │ │
│  │    [  COMENZAR SESIÓN  ]  │ │
│  └───────────────────────────┘ │
│                                 │
│  Actividad reciente             │
│  ░░░░███░░███████░░░░░░░░      │
│  L  M  X  J  V  S  D           │
└─────────────────────────────────┘
│  🏠    📚    🔄    👤          │
└─────────────────────────────────┘
```

#### Sesión de Estudio
```
┌─────────────────────────────────┐
│  ←  Sesión        12/25  ━━━━░░│
├─────────────────────────────────┤
│                                 │
│         ┌─────────────┐         │
│         │             │         │
│         │    PICK     │         │
│         │     UP      │         │
│         │             │         │
│         │   [🔊]      │         │
│         └─────────────┘         │
│                                 │
│  ¿Cuál es la traducción?        │
│                                 │
│  ┌─────────┐  ┌─────────┐      │
│  │ Recoger │  │ Levantar│      │
│  └─────────┘  └─────────┘      │
│  ┌─────────┐  ┌─────────┐      │
│  │ Dejar   │  │ Tirar   │      │
│  └─────────┘  └─────────┘      │
│                                 │
└─────────────────────────────────┘
```

#### Feedback de Respuesta Correcta
```
┌─────────────────────────────────┐
│  ←  Sesión        12/25  ━━━━░░│
├─────────────────────────────────┤
│                                 │
│         ┌─────────────┐         │
│         │    ✓        │  Verde  │
│         │  PICK UP    │ + pulse │
│         │             │         │
│         │  Recoger    │         │
│         └─────────────┘         │
│                                 │
│  "I'll pick you up at 7."      │
│  "Te recogeré a las 7."        │
│                                 │
│  ┌──────┐┌──────┐┌──────┐┌────┐│
│  │Again ││ Hard ││ Good ││Easy││
│  │  1d  ││  3d  ││  7d  ││14d ││
│  └──────┘└──────┘└──────┘└────┘│
└─────────────────────────────────┘
```

#### Perfil y Estadísticas
```
┌─────────────────────────────────┐
│  👤 Mi Perfil                   │
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐   │
│  │  Nivel: Intermedio (B1) │   │
│  │  ████████████░░░░ 67%   │   │
│  └─────────────────────────┘   │
│                                 │
│  📊 Estadísticas                │
│  ├─ Palabras dominadas: 234    │
│  ├─ Phrasal verbs: 45          │
│  ├─ Precisión: 87%             │
│  └─ Tiempo total: 12h 30m      │
│                                 │
│  🏆 Logros (5/20)               │
│  [🔥7] [📚100] [⭐500] ...     │
│                                 │
└─────────────────────────────────┘
```

### 8.3 Sistema de Colores

```css
/* Light Theme */
--background: #FFFFFF;
--surface: #F5F5F5;
--text-primary: #1A1A1A;
--text-secondary: #666666;
--accent: #4F46E5;     /* Indigo 600 */
--success: #22C55E;    /* Green 500 */
--error: #EF4444;      /* Red 500 */
--warning: #F59E0B;    /* Amber 500 */

/* Dark Theme */
--background: #121212;
--surface: #1E1E1E;
--text-primary: #FFFFFF;
--text-secondary: #A3A3A3;
--accent: #818CF8;     /* Indigo 400 */
```

### 8.4 Animaciones

| Elemento | Animación | Duración |
|----------|-----------|----------|
| Flip de tarjeta | rotateY 180° | 300ms |
| Respuesta correcta | scale + green pulse | 400ms |
| Respuesta incorrecta | shake horizontal | 300ms |
| Transición tarjetas | slide left | 250ms |
| Progress bar | width transition | 200ms |

---

## 9. Sistema de Gamificación

### 9.1 Mecánicas Core

#### Streaks (Rachas)
- **Definición**: Días consecutivos con al menos 1 sesión completada
- **Recompensa**: XP bonus por mantener racha (+10% por cada 7 días)
- **Protección**: 1 "freeze" gratuito por semana

#### XP (Puntos de Experiencia)
| Acción | XP Base |
|--------|---------|
| Tarjeta correcta (nueva) | 10 XP |
| Tarjeta correcta (repaso) | 5 XP |
| Lección completada | 50 XP |
| Racha de 7 días | 100 XP bonus |
| Palabra dominada | 25 XP |

#### Niveles de Usuario
| Nivel | XP Requerido | Título |
|-------|--------------|--------|
| 1 | 0 | Principiante |
| 2 | 500 | Aprendiz |
| 3 | 1,500 | Estudiante |
| 4 | 3,500 | Intermedio |
| 5 | 7,000 | Avanzado |
| 6 | 12,000 | Experto |
| 7 | 20,000 | Maestro |

### 9.2 Logros (Achievements)

| Logro | Condición | XP Bonus |
|-------|-----------|----------|
| 🔥 Primera Llama | 1 día de racha | 10 |
| 🔥 Semana en Fuego | 7 días de racha | 100 |
| 🔥 Mes Imparable | 30 días de racha | 500 |
| 📚 Primeros Pasos | 10 palabras aprendidas | 25 |
| 📚 Vocabulario Sólido | 100 palabras | 100 |
| 📚 Diccionario Andante | 500 palabras | 500 |
| 🎯 Precisión Perfecta | 100% en una sesión | 50 |
| ⏱️ Maratonista | 1 hora en un día | 100 |
| 🔗 Phrasal Master | 50 phrasal verbs | 200 |

### 9.3 Decks y Progresión

```
📚 NGSL Nivel A1 (Palabras 1-500)
├── Lección 1: Palabras 1-25 ✅
├── Lección 2: Palabras 26-50 ✅
├── Lección 3: Palabras 51-75 🔓
├── Lección 4: Palabras 76-100 🔒
└── ...

🔗 Phrasal Verbs
├── Básicos (1-50) 🔓
├── Intermedios (51-100) 🔒
└── Avanzados (101-150) 🔒
```

---

## 10. Plan de Monetización (Futuro)

### 10.1 Modelo Freemium

| Feature | Free | Premium |
|---------|------|---------|
| NGSL 2800 palabras | ✓ | ✓ |
| Phrasal Verbs 150 | ✓ | ✓ |
| SRS básico | ✓ | ✓ |
| Sync entre dispositivos | ✓ | ✓ |
| Límite tarjetas/día | 50 | ∞ |
| Estadísticas avanzadas | - | ✓ |
| Audio pronunciación | - | ✓ |
| Sin anuncios | - | ✓ |
| Decks personalizados | - | ✓ |

### 10.2 Pricing (Referencia)
- **Mensual**: $4.99/mes
- **Anual**: $29.99/año (50% descuento)
- **Lifetime**: $79.99 (una vez)

---

## 11. Roadmap de Desarrollo

### Fase 1: Setup y Core (Semana 1-2)
- [x] Configurar proyecto Expo con TypeScript
- [x] Setup Supabase (proyecto, auth, database)
- [x] Crear tablas en Supabase
- [x] Documentación vocabulario (NGSL + PHaVE)
- [ ] Implementar SQLite local
- [ ] Importar vocabulario a Supabase
- [ ] Cliente Supabase en app
- [ ] UI básica de tarjetas

### Fase 2: SRS y Estudio (Semana 3-4)
- [ ] Implementar algoritmo SM-2
- [ ] Zustand stores (study, user, settings)
- [ ] Lógica de sesión de estudio
- [ ] Sistema de selección de respuestas
- [ ] Tracking de progreso
- [ ] Animaciones (flip, feedback)
- [ ] Haptics

### Fase 3: Sync y Persistencia (Semana 5)
- [ ] Lógica de sincronización custom
- [ ] Manejo estado online/offline
- [ ] Indicadores de sync en UI
- [ ] Queue de cambios pendientes
- [ ] Resolución de conflictos

### Fase 4: Gamificación (Semana 6)
- [ ] Sistema de XP
- [ ] Streaks y rachas
- [ ] Logros/achievements
- [ ] Niveles de usuario
- [ ] UI de progreso y stats

### Fase 5: Polish (Semana 7)
- [ ] Dark mode
- [ ] Settings completos
- [ ] Notificaciones
- [ ] Onboarding flow
- [ ] Testing y bug fixes
- [ ] Preparar para producción

## 12. Configuración Inicial Necesaria

### 12.1 Variables de Entorno
```env
EXPO_PUBLIC_SUPABASE_URL=https://qsdzoelgqyymtwublxoq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
```

### 12.2 Dependencias Principales
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
