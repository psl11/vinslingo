# VinsLingo - Informe de Primera Conversación

**Fecha:** 13 de enero de 2026  
**Objetivo:** Configurar el proyecto VinsLingo desde cero

---

## 1. Resumen Ejecutivo

En esta conversación se completó la configuración inicial completa del proyecto **VinsLingo**, una aplicación móvil para aprender inglés desde español. Se estableció toda la infraestructura necesaria incluyendo el proyecto Expo, la base de datos Supabase, la documentación del vocabulario y el repositorio en GitHub.

---

## 2. Requisitos Iniciales del Usuario

El usuario solicitó crear una app de aprendizaje de inglés con las siguientes características:

- **Framework:** React Native + Expo (compilable para iOS y Android)
- **Backend:** Supabase remoto conectado vía MCP
- **Interfaz:** En español, para aprender inglés
- **Ejercicios:** Traducción bidireccional (español ↔ inglés)
- **Sincronización:** Manual con base remota, base local por defecto
- **Sin implementar por ahora:** PowerSync, Zustand/MMKV, gamificación, sesiones

---

## 3. Tareas Completadas

### 3.1 Configuración de Cuentas

#### Supabase (Nueva cuenta)
- Token MCP configurado: `sbp_598f5f90055e010edcad85706fdcf399136be4b9`
- Proyecto creado: `vinslingo`
- URL: `https://qsdzoelgqyymtwublxoq.supabase.co`
- Región: `eu-north-1`

#### GitHub (Nueva cuenta)
- Usuario: `psl11`
- Protocolo: HTTPS
- Autenticación vía GitHub CLI (`gh`)

---

### 3.2 Proyecto Expo React Native

Se creó un proyecto Expo con la plantilla `blank-typescript`:

```
vinslingo/
├── app/
├── assets/
├── components/
├── constants/
├── hooks/
├── lib/
│   └── supabase.ts
├── docs/
│   ├── phave-phrasal-verbs.md
│   ├── ngsl-2800-words.md
│   ├── project-plan.md
│   └── primera_conversacion.md
├── .env
├── .env.example
├── .gitignore
├── app.json
├── package.json
└── tsconfig.json
```

---

### 3.3 Documentación Creada

#### `docs/phave-phrasal-verbs.md`
- **Contenido:** 150 phrasal verbs de la PHaVE List
- **Formato:** Tabla con columnas: #, Phrasal Verb, Significado (español), Nivel CEFR
- **Ejemplo:** "break down" → "averiarse, descomponer" → B1

#### `docs/ngsl-2800-words.md`
- **Contenido:** 2800 palabras de la New General Service List (NGSL)
- **Formato:** Tabla con columnas: #, Word, Español, CEFR, POS (part of speech)
- **Dividido en secciones:** 1-700, 701-1400, 1401-2100, 2101-2800
- **Referencias:** Browne, C., Culligan, B., & Phillips, J. (2013)

#### `docs/project-plan.md`
- **Contenido completo del plan:**
  - Visión general y características
  - Stack técnico (React Native, Expo, Supabase, SQLite, etc.)
  - Arquitectura de la aplicación
  - Modelo de datos completo (tablas SQL)
  - Algoritmo SRS (SM-2)
  - Flujo de sincronización local-first
  - Tipos de ejercicios
  - Roadmap de desarrollo (4 fases)
  - Configuración inicial necesaria

---

### 3.4 Base de Datos Supabase

Se crearon **8 tablas** con Row Level Security (RLS) habilitado:

| Tabla | Descripción | RLS |
|-------|-------------|-----|
| `profiles` | Perfiles de usuario (extensión de auth.users) | ✅ |
| `vocabulary` | Palabras y phrasal verbs del vocabulario | ✅ |
| `user_vocabulary` | Progreso del usuario por palabra (datos SRS) | ✅ |
| `lessons` | Lecciones estructuradas | ✅ |
| `lesson_vocabulary` | Relación entre lecciones y vocabulario | ✅ |
| `user_lessons` | Progreso del usuario por lección | ✅ |
| `study_sessions` | Sesiones de estudio | ✅ |
| `exercise_attempts` | Intentos de ejercicios individuales | ✅ |

#### Características de seguridad implementadas:
- Políticas RLS para que cada usuario solo acceda a sus propios datos
- Trigger automático para crear perfil al registrarse
- Índices optimizados para consultas frecuentes

---

### 3.5 Configuración del Proyecto

#### Archivos de configuración creados:

**`.env`** (no subido a Git):
```
EXPO_PUBLIC_SUPABASE_URL=https://qsdzoelgqyymtwublxoq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

**`.env.example`** (plantilla para otros desarrolladores):
```
EXPO_PUBLIC_SUPABASE_URL=https://qsdzoelgqyymtwublxoq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

**`lib/supabase.ts`**:
```typescript
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

#### Dependencias instaladas:
- `@supabase/supabase-js` - Cliente de Supabase
- `@react-native-async-storage/async-storage` - Almacenamiento persistente

---

### 3.6 Repositorio GitHub

- **URL:** https://github.com/psl11/vinslingo
- **Visibilidad:** Público
- **Branch principal:** master
- **Commit inicial:** "Initial commit: VinsLingo English learning app setup"
- **Archivos excluidos:** `.env`, `node_modules/`, `.expo/`, etc.

---

## 4. Decisiones Técnicas Tomadas

### 4.1 Arquitectura Local-First
Se optó por una estrategia de sincronización manual donde:
1. Los datos se guardan primero en SQLite local
2. Se sincronizan con Supabase cuando hay conexión
3. Conflictos se resuelven por timestamp (último gana)

### 4.2 Algoritmo SRS
Se documentó el algoritmo SM-2 para repetición espaciada:
- `easeFactor`: Factor de facilidad (1.3 - 2.5+)
- `interval`: Días hasta próxima revisión
- `repetitions`: Veces respondida correctamente en fila
- Calidad de respuesta: 0-5 (0=blackout, 5=perfecto)

### 4.3 Seguridad
- RLS habilitado en todas las tablas
- Credenciales en variables de entorno
- `.env` excluido de Git

---

## 5. Próximos Pasos Sugeridos

### Fase 1 - MVP (pendiente):
- [ ] Importar vocabulario NGSL/PHaVE a la tabla `vocabulary`
- [ ] Implementar SQLite local con expo-sqlite
- [ ] Crear UI básica: Home, Learn, Profile
- [ ] Ejercicios de traducción simple
- [ ] Autenticación básica con Supabase Auth

### Fase 2 - Core Features:
- [ ] Sincronización local-remoto
- [ ] Sistema de lecciones estructuradas
- [ ] Ejercicios: cloze, multiple choice
- [ ] Onboarding flow

### Fase 3 - Polish:
- [ ] UI/UX refinado con NativeWind
- [ ] Animaciones y haptics
- [ ] Dark mode
- [ ] Estadísticas

---

## 6. Información de Referencia

### Supabase
| Campo | Valor |
|-------|-------|
| Project ID | `qsdzoelgqyymtwublxoq` |
| URL | `https://qsdzoelgqyymtwublxoq.supabase.co` |
| Región | `eu-north-1` |
| Estado | ACTIVE_HEALTHY |

### GitHub
| Campo | Valor |
|-------|-------|
| Usuario | `psl11` |
| Repositorio | `vinslingo` |
| URL | https://github.com/psl11/vinslingo |

### Vocabulario
| Recurso | Cantidad |
|---------|----------|
| NGSL Words | 2800 palabras |
| PHaVE Phrasal Verbs | 150 phrasal verbs |

---

## 7. Comandos Útiles

```bash
# Iniciar proyecto Expo
npx expo start

# Ver estado de Git
git status

# Subir cambios a GitHub
git add . && git commit -m "mensaje" && git push

# Ver proyectos Supabase (vía MCP)
# Usar herramienta mcp1_list_projects
```

---

*Documento generado automáticamente como registro de la primera sesión de desarrollo de VinsLingo.*
