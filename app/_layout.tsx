import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getDatabase } from '../lib/database/client';
import { syncVocabularyFromSupabase, getLocalVocabularyCount } from '../lib/services/vocabularyService';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Iniciando...');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Initialize database and sync vocabulary
  useEffect(() => {
    async function initialize() {
      try {
        setInitStatus('Preparando base de datos...');
        await getDatabase();
        
        const localCount = await getLocalVocabularyCount();
        
        if (localCount === 0) {
          setInitStatus('Descargando vocabulario...');
          await syncVocabularyFromSupabase();
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error('Initialization error:', error);
        setInitStatus('Error al inicializar');
        setTimeout(() => setIsInitializing(false), 2000);
      }
    }
    
    initialize();
  }, []);

  // Handle auth navigation
  useEffect(() => {
    if (isInitializing || authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to home if authenticated but on auth screen
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isInitializing, authLoading]);

  if (isInitializing || authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.appName}>VinsLingo</Text>
        <ActivityIndicator size="large" color="#4F46E5" style={styles.spinner} />
        <Text style={styles.status}>{initStatus}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="study/[id]" 
          options={{ 
            headerShown: false,
            presentation: 'fullScreenModal',
          }} 
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  status: {
    fontSize: 14,
    color: '#6B7280',
  },
});
