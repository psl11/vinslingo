import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import * as Network from 'expo-network';
import { getDatabase } from '../lib/database/client';
import { syncVocabularyFromSupabase, getLocalVocabularyCount } from '../lib/services/vocabularyService';
import { syncUserProgress } from '../lib/services/syncService';
import { getPendingSyncItems } from '../lib/database/queries';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { useSyncStore } from '../stores/useSyncStore';

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Iniciando...');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const { setOnlineStatus } = useSyncStore();
  const appState = useRef(AppState.currentState);

  // Initialize database and sync vocabulary
  useEffect(() => {
    async function initialize() {
      try {
        setInitStatus('Preparando base de datos...');
        await getDatabase();
        
        const localCount = await getLocalVocabularyCount();
        
        // Verificar conexión a internet
        const networkState = await Network.getNetworkStateAsync();
        const isConnected = !!(networkState.isConnected && networkState.isInternetReachable);
        setOnlineStatus(isConnected);
        
        if (isConnected && localCount === 0) {
          // Primera descarga: sin datos locales no hay app, hay que esperar
          setInitStatus('Descargando vocabulario...');
          await syncVocabularyFromSupabase();
        } else if (isConnected) {
          // Ya hay datos locales: arrancar al instante y sincronizar en
          // segundo plano (antes se bloqueaba la UI en cada arranque en
          // frío re-descargando todo el vocabulario).
          (async () => {
            try {
              await syncVocabularyFromSupabase();
              const pendingItems = await getPendingSyncItems();
              if (pendingItems.length > 0) {
                await syncUserProgress();
                console.log(`📤 Synced ${pendingItems.length} pending offline changes`);
              }
            } catch (err) {
              console.error('Background sync error:', err);
            }
          })();
        } else if (localCount === 0) {
          // Sin conexión y sin datos locales
          setInitStatus('Sin conexión. Necesitas internet para la primera descarga.');
          await new Promise(resolve => setTimeout(resolve, 2000));
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

  // Sync pending changes when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground — check network and sync pending
        try {
          const networkState = await Network.getNetworkStateAsync();
          const isConnected = !!(networkState.isConnected && networkState.isInternetReachable);
          setOnlineStatus(isConnected);
          
          if (isConnected) {
            const pendingItems = await getPendingSyncItems();
            if (pendingItems.length > 0) {
              console.log(`📤 App foregrounded with ${pendingItems.length} pending changes, syncing...`);
              await syncUserProgress();
            }
          }
        } catch (error) {
          console.error('Foreground sync error:', error);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  // Handle auth navigation
  useEffect(() => {
    if (isInitializing || authLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    // El enlace de recuperación crea una sesión al aterrizar: sin esta
    // excepción, el guard expulsaría al usuario a home antes de que pueda
    // escribir la contraseña nueva.
    const onResetPassword = (segments as string[])[1] === 'reset-password';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup && !onResetPassword) {
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
        <Stack.Screen 
          name="search" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
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
