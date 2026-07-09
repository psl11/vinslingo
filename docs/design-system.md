# Sistema de diseño (UI)

Fuente única de verdad para la apariencia de VinsLingo:
[`constants/theme.ts`](../constants/theme.ts). **Regla:** en cualquier
`StyleSheet` usar SIEMPRE estos tokens, nunca hex ni números sueltos. Si falta
un color, se añade al theme antes que meter un hex a mano. Así un cambio de
marca o de escala se hace en un solo sitio y es imposible colar un valor suelto
sin que se note (además el `typecheck` falla si el token no existe).

## Tokens

- **`spacing`** — escala base 4pt: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 ·
  xxl 24 · xxxl 32 · huge 40`. `xxs` es el micro-ajuste (badges, interlínea).
- **`radius`** — `sm 8 · md 12 · lg 16 · xl 20 · full 999`. Chips/botones/inputs
  usan `md` (12); tarjetas grandes `lg` (16); píldoras y círculos `full`.
- **`colors`** — paleta semántica (los hex son los históricos de la app):
  - Marca: `primary`, `primaryLight`, `primarySurface`, `primaryDisabled`,
    `accentPurple`, `accentPurpleSurface`.
  - Texto: `textPrimary`, `textStrong`, `textSecondary`, `textTertiary`,
    `onPrimary`.
  - Superficies/bordes: `screen`, `card`, `surfaceSubtle`, `border`,
    `borderStrong`.
  - Semánticos: `danger`/`dangerSurface`/`dangerSurfaceSoft`/`dangerBorder`,
    `success`/`successSurface`, `warning`/`warningSurface`/`warningText`/
    `warningTextSoft`, `info`/`infoSurface`.
- **`fontSize`** — `xxs 11 · xs 12 · sm 13 · base 14 · md 16 · lg 18 · xl 20 ·
  xxl 24 · display 28 · displayLg 32 · hero 56`.
- **`fontWeight`** — `regular 400 · medium 500 · semibold 600 · bold 700 ·
  extrabold 800` (tipados como los literales que espera React Native).

## Principios de espaciado ("que respire", estilo Duolingo)

1. **Aire arriba**: el primer elemento no se pega al borde superior (cabeceras
   con `paddingTop` ≥ `spacing.xl`).
2. **Ritmo entre grupos**: separación generosa y CONSTANTE (`xl`–`xxl`) entre
   bloques distintos (p.ej. selector → CTA → listado).
3. **Acoplamiento label→control estrecho** (`sm`–`md`): una etiqueta pega con su
   control; el grupo entero separa más del siguiente, así se leen como bloques.
4. **Simetría**: padding vertical simétrico (mismo aire arriba que abajo) en
   cabeceras, tarjetas y secciones.
5. **Tarjetas que respiran**: padding interno ≥ `lg`, separación entre tarjetas
   ≥ `md`, radios suaves, gap entre badges ≥ `sm`.

Referencia canónica de estos principios: [`app/failed-words.tsx`](../app/failed-words.tsx)
y [`components/vocabulary/VocabResultCard.tsx`](../components/vocabulary/VocabResultCard.tsx).

## Helper `webInputReset`

React Native Web pinta un recuadro azul de foco en los `<input>`. Todos los
`TextInput` deben incluirlo en su prop `style` para quitarlo (en nativo es
`null`, no aplica):

```tsx
import { webInputReset } from '../../constants/theme';
<TextInput style={[styles.input, webInputReset]} ... />
```

## Estado de la migración

Ya usan tokens: los componentes compartidos (`Card`, `Button`, `ProgressBar`),
`VocabResultCard`, y todas las pantallas principales (`index`, `learn`,
`review`, `profile`, `search`, `failed-words`, `study/[id]`). Las pantallas de
`app/(auth)/` y las tarjetas de ejercicio (`FlashCard`, `TypingCard`,
`GapFillCard`, `KeyWordTransformCard`, `WordFormationCard`) tienen ya el
`webInputReset` aplicado pero su `StyleSheet` está pendiente de migrar por
completo a tokens (mismo patrón). Quedan además unos pocos colores de la cola
larga sin token (verdes/rojos de texto sobre superficie, el emerald del
acierto): añadirlos al theme al tocarlos.
