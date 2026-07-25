import React, { useRef, useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { PressableScale } from './PressableScale';
import { colors } from '../../constants/theme';

interface ActionButtonProps {
  /** Puede ser síncrono o devolver una promesa: mientras dure, el botón muestra spinner. */
  onPress: () => void | Promise<void>;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** El contenido va envuelto en un View (para poder ocultarlo al mostrar el
   *  spinner). Si el botón maquetaba sus hijos en fila, pásale aquí ese layout
   *  (flexDirection, gap…) para que no se rompa. */
  contentStyle?: StyleProp<ViewStyle>;
  /** Color del spinner: usa el del texto del botón (onPrimary en los rellenos). */
  spinnerColor?: string;
  disabled?: boolean;
  /** Para acciones que NAVEGAN: el spinner se queda puesto hasta que la pantalla
   *  cambia (si se quitara al instante, el botón parecería no haber hecho nada
   *  durante el tiempo que tarda en montarse la pantalla destino). */
  keepPendingUntilUnmount?: boolean;
}

/**
 * Botón que da feedback de "estoy trabajando": al pulsarlo muestra un spinner en
 * lugar de su contenido y se bloquea hasta terminar. Evita la sensación de que la
 * app se ha colgado en las transiciones que tardan (guardar en red, cargar la
 * siguiente pantalla, montar una sesión de estudio).
 *
 * Mantiene el alto del botón estable: el spinner se renderiza sobre el contenido,
 * que se vuelve invisible pero sigue ocupando su sitio (nada "salta").
 */
export function ActionButton({
  onPress,
  children,
  style,
  contentStyle,
  spinnerColor = colors.onPrimary,
  disabled,
  keepPendingUntilUnmount,
}: ActionButtonProps) {
  const [pending, setPending] = useState(false);
  // Evita el warning de setState sobre un componente ya desmontado (habitual
  // justo aquí: la acción navega y desmonta la pantalla).
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const handlePress = async () => {
    if (pending || disabled) return;
    setPending(true);
    try {
      await onPress();
    } finally {
      if (mounted.current && !keepPendingUntilUnmount) setPending(false);
    }
  };

  return (
    <PressableScale style={style} onPress={handlePress} disabled={disabled || pending}>
      <View style={[contentStyle, pending && styles.hidden]}>{children}</View>
      {pending && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.center}>
            <ActivityIndicator color={spinnerColor} />
          </View>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hidden: { opacity: 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
