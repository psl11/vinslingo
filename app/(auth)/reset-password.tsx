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
              style={styles.input}
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
              style={styles.input}
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
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1F2937',
  },
  errorContainer: {
    backgroundColor: '#FEE2E2',
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#A5B4FC',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
