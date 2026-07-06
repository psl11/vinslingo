import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En web es imprescindible para OAuth (Google) y para los enlaces de
    // recuperación de contraseña: el token vuelve en la URL y el cliente debe
    // leerlo al cargar. En nativo no hay URL que inspeccionar: apagado.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
