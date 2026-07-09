import { Alert, Platform } from 'react-native';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

// Confirmación cross-platform. OJO: Alert de react-native NO existe en web
// (react-native-web no lo implementa), así que en la PWA cualquier Alert.alert
// era un no-op silencioso (p.ej. la X de la sesión no cerraba). En web usamos
// window.confirm; en nativo, Alert.alert.
export function confirmAction({
  title,
  message,
  confirmText,
  cancelText = 'Cancelar',
  destructive,
  onConfirm,
}: ConfirmOptions): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}
