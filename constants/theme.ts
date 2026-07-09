// Sistema de diseño de VinsLingo — fuente única de verdad para espaciado,
// radios, colores y tipografía. Ver la memoria "feedback_ui_spacing_system".
//
// Regla: en los StyleSheet usar SIEMPRE estos tokens en lugar de números o
// hex sueltos. Cada token conserva exactamente el valor que ya se usaba, así
// migrar no cambia ni un píxel; a partir de aquí, un cambio de marca o de
// escala se hace en un único sitio.

// Escala de espaciado (base 4pt). xxs es el micro-ajuste (badges, interlínea).
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// Radios de esquina.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// Paleta semántica (los hex son los que ya existían en la app).
export const colors = {
  // Marca
  primary: '#4F46E5',
  primaryLight: '#6366F1',
  primarySurface: '#EEF2FF', // fondo índigo claro (chips/botones suaves)
  primaryDisabled: '#A5B4FC',
  accentPurple: '#6D28D9', // partículas de phrasal verbs
  accentPurpleSurface: '#F5F3FF',

  // Texto
  textPrimary: '#1F2937',
  textStrong: '#374151',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  onPrimary: '#FFFFFF',

  // Superficies y bordes
  screen: '#F9FAFB',
  card: '#FFFFFF',
  surfaceSubtle: '#F3F4F6',
  border: '#E5E7EB',
  borderStrong: '#D1D5DB',

  // Peligro / error
  danger: '#DC2626',
  dangerSurface: '#FEE2E2',
  dangerSurfaceSoft: '#FEF2F2',
  dangerBorder: '#FECACA',

  // Éxito
  success: '#16A34A',
  successSurface: '#F0FDF4',

  // Aviso / ancla de canción (ámbar)
  warning: '#F59E0B',
  warningSurface: '#FEF3C7',
  warningText: '#92400E',
  warningTextSoft: '#B45309',

  // Info (azul)
  info: '#3B82F6',
  infoSurface: '#DBEAFE',
} as const;

// Tamaños de fuente.
export const fontSize = {
  xxs: 11,
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  display: 28,
  displayLg: 32,
  hero: 56,
} as const;

// Pesos de fuente (tipados como los literales que espera React Native).
export const fontWeight = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;
