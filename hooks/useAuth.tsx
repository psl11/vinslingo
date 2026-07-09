import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../stores/useUserStore';
import { Session, User } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

type AuthContextValue = AuthState & AuthActions;

const AuthContext = createContext<AuthContextValue | null>(null);

// Un único proveedor de auth para toda la app: monta UNA sola suscripción a
// onAuthStateChange y comparte el estado. Antes cada llamada a useAuth() (6 en
// la app) creaba su propia suscripción y su propio estado, que podían quedar
// desincronizados y multiplicaban los eventos de auth.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Perfil ya cargado para este userId: evita refetches redundantes (Supabase v2
  // dispara SIGNED_IN en refresh de token / foco de pestaña, no solo al loguear).
  const loadedProfileUserIdRef = useRef<string | null>(null);

  const { setProfile, clearProfile } = useUserStore();

  // Mantiene la referencia de `user` estable si el id no cambia → no re-renderiza
  // a los consumidores de useAuth en cada evento de auth con el mismo usuario.
  const applyUser = useCallback((next: User | null) => {
    setUser((prev) => (prev?.id === (next?.id ?? null) ? prev : next));
  }, []);

  const loadUserProfile = useCallback(async (userId: string) => {
    // Ya cargado (o cargándose) para este usuario: no repetir la llamada de red.
    if (loadedProfileUserIdRef.current === userId) {
      setIsLoading(false);
      return;
    }
    loadedProfileUserIdRef.current = userId;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error loading profile:', error);
      }

      if (data) {
        setProfile({
          id: data.id,
          username: data.username,
          displayName: data.display_name,
          nativeLanguage: data.native_language || 'es',
          targetLanguage: data.target_language || 'en',
          dailyGoalMinutes: data.daily_goal_minutes || 10,
          currentStreak: data.current_streak || 0,
          longestStreak: data.longest_streak || 0,
          totalXp: data.total_xp || 0,
          cefrLevel: data.cefr_level || 'A1',
          createdAt: data.created_at,
        });
      } else {
        // Create default profile for new user
        const newProfile = {
          id: userId,
          nativeLanguage: 'es',
          targetLanguage: 'en',
          dailyGoalMinutes: 10,
          currentStreak: 0,
          longestStreak: 0,
          totalXp: 0,
          cefrLevel: 'A1',
          createdAt: new Date().toISOString(),
        };
        setProfile(newProfile);
      }
    } catch (error) {
      console.error('Error in loadUserProfile:', error);
      // Permitir reintento en el próximo evento si falló.
      loadedProfileUserIdRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [setProfile]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      applyUser(session?.user ?? null);

      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes.
    // OJO: no hacer llamadas a supabase con await directamente dentro del
    // callback — el cliente mantiene un lock interno mientras se ejecuta y
    // puede provocar deadlock (limitación documentada de supabase-js v2).
    // Por eso el trabajo async se difiere con setTimeout(0).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        applyUser(session?.user ?? null);

        if (event === 'SIGNED_IN' && session?.user) {
          const userId = session.user.id;
          setTimeout(() => {
            loadUserProfile(userId);
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          loadedProfileUserIdRef.current = null;
          clearProfile();
          setIsLoading(false);
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUserProfile, clearProfile, applyUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });

      if (!error && data.user) {
        // Create profile in profiles table. Si esto falla (p.ej. RLS con
        // confirmación de email pendiente), el usuario queda sin fila en
        // profiles y las actualizaciones de XP/racha fallarían en silencio.
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          display_name: displayName,
          native_language: 'es',
          target_language: 'en',
          daily_goal_minutes: 10,
          current_streak: 0,
          longest_streak: 0,
          total_xp: 0,
          cefr_level: 'A1',
        });
        if (profileError) {
          console.error('❌ Error creating profile on sign-up:', profileError);
        }
      }

      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    clearProfile();
    setIsLoading(false);
  }, [clearProfile]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      // En web, el enlace del correo debe volver a NUESTRA pantalla de
      // restablecer contraseña (con el token en la URL, que el cliente lee
      // gracias a detectSessionInUrl). Sin redirectTo, Supabase manda al
      // Site URL genérico y el flujo muere ahí.
      const options =
        Platform.OS === 'web'
          ? { redirectTo: `${window.location.origin}/reset-password` }
          : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, options);
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    // Solo web por ahora: en nativo requiere deep-linking (expo-auth-session),
    // que no montamos mientras la app se use como PWA.
    if (Platform.OS !== 'web') {
      return { error: new Error('Google login solo está disponible en la versión web por ahora') };
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      // Si no hay error, el navegador redirige a Google; no hay más que hacer.
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isLoading,
      isAuthenticated: !!session,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [user, session, isLoading, signIn, signInWithGoogle, signUp, signOut, resetPassword, updatePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return ctx;
}
