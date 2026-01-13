# PRD: VocabMaster - App de Aprendizaje de Inglés

## Product Requirements Document
**Versión**: 1.0  
**Fecha**: Enero 2026  
**Autor**: Vinsanity  
**Estado**: Draft  

---

## 1. Resumen Ejecutivo

### 1.1 Visión del Producto
VocabMaster es una aplicación móvil personal para aprender vocabulario inglés y phrasal verbs mediante ejercicios tipo flashcard con repetición espaciada (SRS). La app está diseñada con arquitectura **offline-first**, permitiendo uso sin conexión y sincronización automática con Supabase cuando hay conectividad.

### 1.2 Problema a Resolver
- Los hispanohablantes necesitan dominar ~2800 palabras (NGSL) para entender el 92% del inglés general
- Los phrasal verbs son particularmente difíciles (150 phrasal verbs = 51% de uso real)
- Las apps existentes son genéricas y no permiten estudio enfocado y offline

### 1.3 Propuesta de Valor
- **Contenido curado**: 1000 palabras NGSL + 150 phrasal verbs PHaVE basados en corpus lingüístico
- **Offline-first**: Funciona sin internet, sincroniza cuando hay conexión
- **SRS científico**: Algoritmo SM-2/FSRS para optimizar memorización
- **Ejercicios variados**: Traducción, cloze, multiple choice, audio

---

## 2. Objetivos y Métricas

### 2.1 Objetivos del Producto
| Objetivo | Métrica de Éxito |
|----------|------------------|
| Aprender vocabulario efectivamente | 80% retención a 30 días |
| Uso diario consistente | Sesión promedio 10-15 min |
| Experiencia offline fluida | <100ms tiempo respuesta local |
| Progreso medible | Palabras dominadas/día trackeable |

### 2.2 KPIs Principales
- **Palabras aprendidas**: Contador de vocabulario dominado
- **Racha (streak)**: Días consecutivos de práctica
- **Precisión**: % respuestas correctas por sesión
- **Tiempo de estudio**: Minutos totales acumulados

---

## 3. Requisitos Funcionales

### 3.1 Core Features (MVP)

#### 3.1.1 Sistema de Flashcards
```
COMO usuario
QUIERO ver tarjetas de vocabulario con distintos ejercicios
PARA aprender palabras y phrasal verbs de forma interactiva
```

**Tipos de ejercicio:**

| Tipo | Descripción | Implementación |
|------|-------------|----------------|
| **Traducción EN→ES** | Ver palabra inglesa, elegir traducción | 4 opciones multiple choice |
| **Traducción ES→EN** | Ver palabra española, elegir en inglés | 4 opciones multiple choice |
| **Cloze (fill-in-blank)** | Completar palabra faltante en oración | Input de texto o word bank |
| **Audio Recognition** | Escuchar pronunciación, identificar palabra | 4 opciones tras escuchar |

**Flujo de ejercicio:**
```
1. Mostrar pregunta/estímulo
2. Usuario responde (tap/input)
3. Feedback inmediato (✓ verde / ✗ rojo + respuesta correcta)
4. Actualizar SRS según resultado
5. Siguiente tarjeta
```

#### 3.1.2 Sistema de Repetición Espaciada (SRS)

**Algoritmo SM-2 (implementación inicial):**
```javascript
// Parámetros por tarjeta
{
  ease_factor: 2.5,      // Factor de facilidad (min 1.3)
  repetitions: 0,        // Número de repeticiones exitosas
  interval: 1,           // Días hasta próxima revisión
  due_date: Date,        // Fecha de revisión
  state: 'new'|'learning'|'review'
}

// Cálculo tras respuesta (quality: 0-5)
if (quality >= 3) {
  if (repetitions === 0) interval = 1;
  else if (repetitions === 1) interval = 6;
  else interval = Math.round(interval * ease_factor);
  
  repetitions++;
  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease_factor < 1.3) ease_factor = 1.3;
} else {
  repetitions = 0;
  interval = 1;
}
```

**Botones de respuesta:**
| Botón | Quality | Descripción |
|-------|---------|-------------|
| Again | 0 | No lo sabía |
| Hard | 3 | Difícil pero lo recordé |
| Good | 4 | Lo recordé correctamente |
| Easy | 5 | Muy fácil |

#### 3.1.3 Gestión de Contenido

**Decks predefinidos:**
- 📚 **1000 Palabras NGSL** (dividido en niveles de 100)
- 🔗 **150 Phrasal Verbs** (PHaVE List)
- 🎯 **Mis palabras difíciles** (auto-generado)

**Estructura de datos por tarjeta:**
```typescript
interface Card {
  id: string;
  deck_id: string;
  word_en: string;
  word_es: string;
  pronunciation_ipa?: string;
  audio_url?: string;
  example_sentence?: string;
  example_translation?: string;
  part_of_speech: 'noun' | 'verb' | 'adj' | 'adv' | 'prep' | 'conj' | 'pron';
  frequency_rank?: number;
  // Para phrasal verbs
  meanings?: { definition: string; example: string; }[];
}
```

#### 3.1.4 Sesión de Estudio

**Estructura de sesión:**
```
Sesión = Nuevas (N) + Revisiones (R)
- Nuevas por sesión: 10 (configurable 5-20)
- Revisiones: todas las tarjetas con due_date <= hoy
- Orden: Revisiones primero, luego nuevas
- Duración estimada: 10-15 minutos
```

**Pantalla de sesión:**
```
┌─────────────────────────────┐
│  Progreso: 12/25  ████░░░  │
├─────────────────────────────┤
│                             │
│       [Contenido de         │
│        la tarjeta]          │
│                             │
├─────────────────────────────┤
│  [Again] [Hard] [Good] [Easy]│
└─────────────────────────────┘
```

#### 3.1.5 Sincronización Offline-First

**Comportamiento:**
```
1. Al iniciar app:
   - Cargar datos locales inmediatamente
   - Si hay conexión: sync en background
   
2. Durante uso:
   - Todas las operaciones en DB local
   - Queue de cambios pendientes de sync
   
3. Al detectar conexión:
   - Push cambios locales → Supabase
   - Pull cambios remotos → Local
   - Resolver conflictos (last-write-wins)
```

### 3.2 Features Secundarias (Post-MVP)

#### 3.2.1 Gamificación
- **Streaks**: Contador de días consecutivos
- **XP**: Puntos por tarjetas completadas
- **Niveles**: Desbloqueo progresivo de contenido
- **Logros**: Badges por hitos (100 palabras, 7 días streak, etc.)

#### 3.2.2 Estadísticas
- Palabras aprendidas total
- Precisión por deck/tipo de ejercicio
- Gráfico de actividad (heatmap estilo GitHub)
- Tiempo total de estudio

#### 3.2.3 Configuración
- Nuevas tarjetas por sesión (5-20)
- Notificaciones de recordatorio
- Tema claro/oscuro
- Tamaño de fuente

#### 3.2.4 Audio
- Pronunciación con text-to-speech
- Velocidad ajustable (0.75x, 1x)

---

## 4. Requisitos No Funcionales

### 4.1 Rendimiento
| Métrica | Objetivo |
|---------|----------|
| Tiempo de inicio | < 2 segundos |
| Respuesta a tap | < 100ms |
| Animación de flip | 60 FPS |
| Tamaño del bundle | < 50MB |

### 4.2 Offline
- App 100% funcional sin conexión
- Sync automático al recuperar conexión
- Indicador visual de estado de sync
- No pérdida de datos en caso de crash

### 4.3 Compatibilidad
- iOS 14+
- Android 10+
- Tablets (responsive layout)

---

## 5. Arquitectura Técnica

### 5.1 Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Framework** | React Native + Expo | Cross-platform, ecosistema maduro |
| **Routing** | Expo Router | File-based routing, deep linking |
| **Estado Global** | Zustand | Ligero, simple, TypeScript |
| **DB Local** | expo-sqlite + Drizzle ORM | Nativo, performante, type-safe |
| **Backend** | Supabase | PostgreSQL, Auth, Realtime, Storage |
| **Sync** | PowerSync | Sync bidireccional Supabase ↔ SQLite |
| **UI** | NativeWind (Tailwind) | Consistencia, utilidad-first |
| **Animaciones** | react-native-reanimated | 60 FPS, gestos nativos |
| **Audio** | expo-av | Reproducción de pronunciación |
| **Storage KV** | react-native-mmkv | Settings, 30x más rápido que AsyncStorage |
| **Haptics** | expo-haptics | Feedback táctil en respuestas |

### 5.2 Estructura del Proyecto

```
vocabmaster/
├── app/                      # Expo Router (file-based routing)
│   ├── (tabs)/              # Tab navigator
│   │   ├── index.tsx        # Home/Dashboard
│   │   ├── study.tsx        # Sesión de estudio
│   │   ├── decks.tsx        # Lista de decks
│   │   └── stats.tsx        # Estadísticas
│   ├── deck/[id].tsx        # Detalle de deck
│   ├── settings.tsx         # Configuración
│   └── _layout.tsx          # Root layout
├── components/
│   ├── cards/
│   │   ├── FlashCard.tsx    # Componente de tarjeta
│   │   ├── TranslationCard.tsx
│   │   ├── ClozeCard.tsx
│   │   └── MultipleChoiceCard.tsx
│   ├── ui/                  # Componentes genéricos
│   └── progress/            # Barras, indicadores
├── lib/
│   ├── db/
│   │   ├── schema.ts        # Drizzle schema
│   │   ├── client.ts        # SQLite client
│   │   └── sync.ts          # PowerSync setup
│   ├── srs/
│   │   └── sm2.ts           # Algoritmo SM-2
│   └── utils/
├── stores/
│   ├── useStudyStore.ts     # Estado de sesión
│   ├── useSettingsStore.ts  # Configuración
│   └── useSyncStore.ts      # Estado de sync
├── data/
│   ├── phrasal-verbs.json   # 150 phrasal verbs
│   └── ngsl-words.json      # 1000 palabras
└── assets/
    └── audio/               # Pronunciaciones (opcional)
```

### 5.3 Schema de Base de Datos

```sql
-- Drizzle Schema (schema.ts)

-- Decks de vocabulario
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  total_cards INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME  -- Soft delete para sync
);

-- Tarjetas de vocabulario
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES decks(id),
  word_en TEXT NOT NULL,
  word_es TEXT NOT NULL,
  pronunciation_ipa TEXT,
  audio_url TEXT,
  example_sentence TEXT,
  example_translation TEXT,
  part_of_speech TEXT,
  frequency_rank INTEGER,
  meanings TEXT,  -- JSON para phrasal verbs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- Progreso SRS por tarjeta
CREATE TABLE card_progress (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  user_id TEXT,  -- Para futuro multi-usuario
  ease_factor REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  interval INTEGER DEFAULT 0,
  due_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  state TEXT DEFAULT 'new',  -- 'new', 'learning', 'review'
  last_review DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Historial de reviews (para analytics)
CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id),
  quality INTEGER NOT NULL,  -- 0-5
  time_taken_ms INTEGER,
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Estadísticas diarias
CREATE TABLE daily_stats (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,  -- 'YYYY-MM-DD'
  cards_studied INTEGER DEFAULT 0,
  cards_correct INTEGER DEFAULT 0,
  time_spent_ms INTEGER DEFAULT 0,
  streak_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Configuración de usuario
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  new_cards_per_day INTEGER DEFAULT 10,
  review_limit INTEGER DEFAULT 100,
  notification_enabled INTEGER DEFAULT 1,
  notification_time TEXT DEFAULT '09:00',
  theme TEXT DEFAULT 'system',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_card_progress_due ON card_progress(due_date);
CREATE INDEX idx_card_progress_state ON card_progress(state);
CREATE INDEX idx_reviews_card ON reviews(card_id);
CREATE INDEX idx_daily_stats_date ON daily_stats(date);
```

### 5.4 Arquitectura de Sync (PowerSync)

```typescript
// lib/db/sync.ts
import { PowerSyncDatabase } from '@powersync/react-native';
import { wrapPowerSyncWithDrizzle } from 'drizzle-orm/powersync';

// Configuración PowerSync
const powerSync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'vocabmaster.db'
  }
});

// Conectar con Supabase
await powerSync.connect(new SupabaseConnector());

// Wrapper con Drizzle para type-safety
export const db = wrapPowerSyncWithDrizzle(powerSync, { schema });

// Sync status
export const useSyncStatus = () => {
  const status = usePowerSyncStatus();
  return {
    isConnected: status.connected,
    lastSyncedAt: status.lastSyncedAt,
    uploading: status.uploading,
    downloading: status.downloading,
  };
};
```

### 5.5 Flujo de Datos

```
┌─────────────────────────────────────────────────────────┐
│                    React Native App                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌─────────┐    ┌─────────────────────┐ │
│  │ Zustand │←──→│ Queries │←──→│ Drizzle + SQLite    │ │
│  │ Stores  │    │         │    │ (PowerSync local DB)│ │
│  └─────────┘    └─────────┘    └──────────┬──────────┘ │
└─────────────────────────────────────────────┼───────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │    PowerSync        │
                                    │    Sync Service     │
                                    └──────────┬──────────┘
                                               │
                                    ┌──────────▼──────────┐
                                    │     Supabase        │
                                    │    PostgreSQL       │
                                    └─────────────────────┘
```

---

## 6. Diseño UI/UX

### 6.1 Principios de Diseño

1. **Simplicidad**: Interfaz limpia, sin distracciones
2. **Feedback inmediato**: Animaciones y haptics en cada interacción
3. **Accesibilidad**: Texto grande, contraste alto, VoiceOver ready
4. **Consistencia**: Patrones repetidos, aprendizaje rápido

### 6.2 Pantallas Principales

#### Home (Dashboard)
```
┌─────────────────────────────────┐
│  VocabMaster            ⚙️     │
├─────────────────────────────────┤
│  ┌───────────────────────────┐ │
│  │  🔥 Racha: 7 días         │ │
│  │  📚 Palabras: 234/1150    │ │
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

#### Feedback de Respuesta
```
┌─────────────────────────────────┐
│                                 │
│         ┌─────────────┐         │
│         │    ✓        │  Verde  │
│         │  PICK UP    │  + shake│
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

### 6.3 Sistema de Colores

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

### 6.4 Tipografía

```css
/* Font Family: System default (SF Pro / Roboto) */
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 24px;
--font-size-2xl: 32px;  /* Palabras en tarjetas */
--font-size-3xl: 40px;

/* Accesibilidad: Mínimo 16px para body text */
```

### 6.5 Animaciones

| Elemento | Animación | Duración |
|----------|-----------|----------|
| Flip de tarjeta | rotateY 180° | 300ms |
| Respuesta correcta | scale + green pulse | 400ms |
| Respuesta incorrecta | shake horizontal | 300ms |
| Transición entre tarjetas | slide left | 250ms |
| Progress bar | width transition | 200ms |

---

## 7. Plan de Desarrollo

### 7.1 Fases del Proyecto

#### Fase 1: Setup y Core (Semana 1-2)
- [ ] Configurar proyecto Expo con TypeScript
- [ ] Implementar navegación con Expo Router
- [ ] Setup SQLite + Drizzle ORM
- [ ] Crear schema de base de datos
- [ ] Importar datos (1000 palabras + 150 phrasal verbs)
- [ ] UI básica de tarjetas (sin animaciones)

#### Fase 2: SRS y Estudio (Semana 3-4)
- [ ] Implementar algoritmo SM-2
- [ ] Lógica de sesión de estudio
- [ ] Sistema de selección de respuestas
- [ ] Tracking de progreso
- [ ] Animaciones de tarjetas (flip, feedback)

#### Fase 3: Sync y Persistencia (Semana 5)
- [ ] Configurar Supabase (schema, RLS)
- [ ] Integrar PowerSync
- [ ] Manejo de estado online/offline
- [ ] Indicadores de sync en UI

#### Fase 4: Polish (Semana 6)
- [ ] Dark mode
- [ ] Haptics y audio
- [ ] Settings screen
- [ ] Estadísticas básicas
- [ ] Testing y bug fixes

### 7.2 Dependencias Principales

```json
{
  "dependencies": {
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-sqlite": "~15.0.0",
    "expo-av": "~15.0.0",
    "expo-haptics": "~13.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-gesture-handler": "~2.20.0",
    "@powersync/react-native": "^1.0.0",
    "@supabase/supabase-js": "^2.0.0",
    "drizzle-orm": "^0.30.0",
    "zustand": "^5.0.0",
    "nativewind": "^4.0.0",
    "react-native-mmkv": "^3.0.0"
  }
}
```

---

## 8. Preparación para Monetización (Futuro)

### 8.1 Modelo Freemium (Potencial)

| Feature | Free | Premium |
|---------|------|---------|
| Palabras NGSL (1000) | ✓ | ✓ |
| Phrasal Verbs (150) | ✓ | ✓ |
| SRS básico | ✓ | ✓ |
| Sync entre dispositivos | ✓ | ✓ |
| Estadísticas avanzadas | - | ✓ |
| Decks personalizados | - | ✓ |
| Audio nativo | - | ✓ |
| Sin anuncios | - | ✓ |

### 8.2 Puntos de Extensión
- Sistema de decks preparado para añadir más contenido
- Schema de usuario listo para multi-cuenta
- Analytics hooks para métricas de engagement

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| PowerSync complejidad | Media | Alto | Documentación extensa, fallback a sync manual |
| Performance con 1000+ cards | Baja | Medio | Virtualización (FlashList), lazy loading |
| Conflictos de sync | Media | Medio | Last-write-wins, timestamps, soft deletes |
| Audio TTS calidad | Media | Bajo | Opcional en MVP, audio pregrabado futuro |

---

## 10. Recursos y Referencias

### 10.1 Listas de Vocabulario
- **NGSL**: https://www.newgeneralservicelist.com/
- **PHaVE List**: Garnier & Schmitt (2015) - Language Learning journal

### 10.2 Documentación Técnica
- Expo: https://docs.expo.dev
- PowerSync: https://docs.powersync.com
- Supabase: https://supabase.com/docs
- Drizzle ORM: https://orm.drizzle.team
- SM-2 Algorithm: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2

### 10.3 Diseño y UX
- Duolingo Case Study: https://usabilitygeek.com/ux-case-study-duolingo/
- SRS Best Practices: Kornell (2009) - Memory & Cognition

---

## Apéndice A: Datos de Contenido

### Archivos incluidos:
1. `150_phrasal_verbs.md` - Lista PHaVE completa con traducciones y ejemplos
2. `1000_common_words.md` - NGSL primeras 1000 palabras con traducciones

### Formato JSON para importación:
```json
// phrasal-verbs.json
[
  {
    "id": "pv_001",
    "word_en": "go on",
    "word_es": "continuar; suceder",
    "meanings": [
      { "definition": "Continue", "example": "Please go on with your story." },
      { "definition": "Happen", "example": "What's going on?" }
    ],
    "frequency_rank": 1
  }
]

// ngsl-words.json
[
  {
    "id": "ngsl_001",
    "word_en": "the",
    "word_es": "el, la, los, las",
    "part_of_speech": "article",
    "frequency_rank": 1,
    "forms": []
  }
]
```

---

*Documento generado para desarrollo de app personal de aprendizaje de inglés*
*Basado en investigación de corpus lingüístico, análisis competitivo y mejores prácticas de SRS*
