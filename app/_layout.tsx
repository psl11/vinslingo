import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getDatabase } from '../lib/database/client';
import { syncVocabularyFromSupabase, getLocalVocabularyCount } from '../lib/services/vocabularyService';

export default function RootLayout() {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Iniciando...');

  useEffect(() => {
    async function initialize() {
      try {
        // Inicializar base de datos
        setInitStatus('Preparando base de datos...');
        await getDatabase();
        
        // Verificar si hay vocabulario local
        const localCount = await getLocalVocabularyCount();
        
        if (localCount === 0) {
          // Primera vez: sincronizar vocabulario
          setInitStatus('Descargando vocabulario...');
          await syncVocabularyFromSupabase();
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error('Initialization error:', error);
        setInitStatus('Error al inicializar');
        // Continuar de todos modos después de un delay
        setTimeout(() => setIsInitializing(false), 2000);
      }
    }
    
    initialize();
  }, []);

  if (isInitializing) {
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
