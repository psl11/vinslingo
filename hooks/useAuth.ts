import { useEffect, useState, useCallback } from 'react';
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
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const { setProfile, clearProfile } = useUserStore();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth event:', event);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          clearProfile();
        }
        
        setIsLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
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
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
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
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (!error && data.user) {
        // Create profile in profiles table
        await supabase.from('profiles').insert({
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
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  return {
    user,
    session,
    isLoading,
    isAuthenticated: !!session,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };
}
