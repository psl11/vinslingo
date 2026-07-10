import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

// Respeta la preferencia de "reducir movimiento" del sistema (WCAG 2.3.3, Apple
// HIG) en NATIVO (iOS/Android), donde la señal es fiable.
//
// En web (react-native-web) se ignora a propósito: RNW reporta esta preferencia
// de forma poco fiable (a veces devuelve true aunque el usuario no la tenga
// activada), lo que desactivaría las animaciones incorrectamente. En web, pues,
// siempre devuelve false (animaciones normales).
export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let mounted = true;
    // El handler ignora su argumento y RE-CONSULTA la fuente de verdad
    // (isReduceMotionEnabled siempre devuelve booleano).
    const refresh = () => {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) setReduceMotion(!!enabled);
        })
        .catch(() => {});
    };

    refresh();
    let sub: { remove: () => void } | undefined;
    try {
      sub = AccessibilityInfo.addEventListener('reduceMotionChanged', refresh);
    } catch {
      // Plataforma/versión sin soporte: se queda en false.
    }

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return reduceMotion;
}
