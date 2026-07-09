import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors, radius, spacing, fontSize, fontWeight, webInputReset } from '../../constants/theme';

// Pantalla de destino del enlace de recuperación de contraseña. El correo de
// Supabase redirige aquí con el token en la URL; el cliente lo procesa
// (detectSessionInUrl) y crea una sesión de recuperación, con la que
// updateUser({ password }) puede fijar la contraseña nueva.
export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword, isAuthenticated } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    if (!password || password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setError('');
    setIsSaving(true);
    const { error } = await updatePassword(password);
    setIsSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  };

  // Sin sesión de recuperación no se puede cambiar la contraseña: el enlace
  // caducó, ya se usó, o se abrió en otro navegador.
  if (!isAuthenticated && !done) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>⏱️</Text>
            <Text style={styles.title}>Enlace no válido o caducado</Text>
            <Text style={styles.subtitle}>
              Abre el enlace del correo en este mismo navegador, o solicita uno nuevo.
            </Text>
          </View>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>Solicitar nuevo enlace</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.logo}>✅</Text>
            <Text style={styles.title}>Contraseña actualizada</Text>
            <Text style={styles.subtitle}>Ya puedes seguir aprendiendo.</Text>
          </View>
          <Pressable style={styles.button} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.buttonText}>Ir a la app</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>🔒</Text>
          <Text style={styles.title}>Nueva Contraseña</Text>
          <Text style={styles.subtitle}>Elige tu nueva contraseña</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nueva contraseña</Text>
            <TextInput
              style={[styles.input, webInputReset]}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Repite la contraseña</Text>
            <TextInput
              style={[styles.input, webInputReset]}
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            style={[styles.button, isSaving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Guardar contraseña</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.screen,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.huge,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  form: {
    gap: spacing.lg,
  },
  inputContainer: {
    gap: spacing.sm,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textStrong,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  errorContainer: {
    backgroundColor: colors.dangerSurface,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: fontSize.base,
    textAlign: 'center',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    backgroundColor: colors.primaryDisabled,
  },
  buttonText: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
});
