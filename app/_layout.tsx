import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { getDatabase } from '../lib/database/client';

export default function RootLayout() {
  useEffect(() => {
    getDatabase().catch(console.error);
  }, []);

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
