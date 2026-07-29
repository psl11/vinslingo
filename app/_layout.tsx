import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import { getDatabase } from '../lib/database/client';
import { syncVocabularyFromSupabase, getLocalVocabularyCount } from '../lib/services/vocabularyService';
import { syncMusicFromSupabase } from '../lib/services/musicService';
import { syncUserProgress } from '../lib/services/syncService';
import { getPendingSyncItems } from '../lib/database/queries';
import { AuthProvider, useAuth } from '../hooks/useAuth';
import { hasAuthenticatedBefore } from '../lib/auth/offlineSession';
import { useSyncStore } from '../stores/useSyncStore';
import { colors, spacing, fontSize, fontWeight } from '../constants/theme';
import { SyncStatusBanner } from '../components/ui/SyncStatusBanner';

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
  const isOnline = useSyncStore((s) => s.isOnline);
  const appState = useRef(AppState.currentState);

  // ¿Este dispositivo estuvo autenticado alguna vez? Ver lib/auth/offlineSession.ts.
  // null = todavía no lo sabemos; hasta saberlo no se puede decidir el guard.
  const [authedBefore, setAuthedBefore] = useState<boolean | null>(null);
  useEffect(() => {
    hasAuthenticatedBefore().then(setAuthedBefore).catch(() => setAuthedBefore(false));
  }, []);

  // Registrar el service worker (solo web y en producción): cachea la shell para
  // que la app instalada abra y funcione sin conexión. En dev no, para no servir
  // bundles cacheados obsoletos.
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      !__DEV__ &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration failed:', err);
      });
    }
  }, []);

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
          // Primera descarga: sin datos locales no hay app, hay que esperar.
          // force: sin marca de sync todavía, hay que bajar sí o sí.
          setInitStatus('Descargando vocabulario...');
          await syncVocabularyFromSupabase({ force: true });
          await syncMusicFromSupabase({ force: true });
        } else if (isConnected) {
          // Ya hay datos locales: arrancar al instante y sincronizar en
          // segundo plano. El sync está gateado (máx. 1/día salvo que una
          // migración lo fuerce), así que en la mayoría de arranques no hace
          // ni fetch de red ni reescritura local.
          (async () => {
            try {
              await syncVocabularyFromSupabase();
              await syncMusicFromSupabase();
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

  // En web (PWA), reflejar los cambios de conexión en vivo (eventos online/offline
  // del navegador) para que el banner de "sin conexión" sea inmediato. En nativo,
  // el estado se refresca al arrancar y al volver a primer plano (arriba).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const update = () => setOnlineStatus(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [setOnlineStatus]);

  // MODO OFFLINE: no hay sesión, pero este dispositivo SÍ estuvo autenticado.
  // Sin esto la app era inservible en un avión: al caducar el token, supabase-js
  // intenta refrescarlo, falla sin red y BORRA la sesión del disco, así que el
  // guard mandaba al login — donde tampoco se puede hacer nada sin red.
  // Todos los datos de estudio son locales (SQLite), así que se deja entrar.
  //
  // Deliberadamente NO se condiciona a `!isOnline`: con el wifi de un avión (o un
  // portal cautivo) `navigator.onLine` es true aunque no haya internet de verdad,
  // y ese es justo el caso que queremos cubrir. La marca solo se borra al cerrar
  // sesión explícitamente, así que un usuario nuevo nunca entra por aquí.
  const offlineAccess = !isAuthenticated && authedBefore === true;

  // Sin red no tiene sentido mandar a nadie al login: no se puede iniciar sesión.
  const cannotSignIn = offlineAccess && !isOnline;

  // Handle auth navigation
  useEffect(() => {
    if (isInitializing || authLoading || authedBefore === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    // El enlace de recuperación crea una sesión al aterrizar: sin esta
    // excepción, el guard expulsaría al usuario a home antes de que pueda
    // escribir la contraseña nueva.
    const onResetPassword = (segments as string[])[1] === 'reset-password';

    if (!isAuthenticated && !offlineAccess && !inAuthGroup) {
      // Redirect to sign-in if not authenticated
      router.replace('/(auth)/sign-in');
    } else if ((isAuthenticated || cannotSignIn) && inAuthGroup && !onResetPassword) {
      // Redirect to home if authenticated but on auth screen.
      // Con `cannotSignIn` en vez de `offlineAccess`: si la sesión caducó pero SÍ
      // hay red, se le deja llegar al login desde el banner para reconectar.
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, offlineAccess, cannotSignIn, segments, isInitializing, authLoading, authedBefore]);

  if (isInitializing || authLoading || authedBefore === null) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.logo}>📚</Text>
        <Text style={styles.appName}>VinsLingo</Text>
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
        <Text style={styles.status}>{initStatus}</Text>
      </View>
    );
  }

  return (
    <View style={styles.appRoot}>
      <StatusBar style="dark" />
      <SyncStatusBanner sessionExpired={offlineAccess} />
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
        <Stack.Screen
          name="failed-words"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="saved-words"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="music"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="study/drill"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
          }}
        />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  appRoot: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.screen,
  },
  logo: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  appName: {
    fontSize: fontSize.display,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xxl,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  status: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
  },
});
