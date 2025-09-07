import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ error: any }>;
  downloadUserData: () => Promise<void>;
  interactionCount: number;
  incrementInteraction: () => void;
  showAuthModal: boolean;
  setShowAuthModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [interactionCount, setInteractionCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Close auth modal when user successfully signs in
        if (event === 'SIGNED_IN') {
          setShowAuthModal(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setInteractionCount(0); // Reset interaction count on logout
  };

  const changePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { error };
  };

  const downloadUserData = async () => {
    if (!user) return;
    
    try {
      // Fetch all user data
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      const { data: medicineScans } = await supabase
        .from('medicine_scans')
        .select('*')
        .eq('user_id', user.id);

      const { data: symptomAnalyses } = await supabase
        .from('symptom_analyses')
        .select('*')
        .eq('user_id', user.id);

      const { data: ambulanceBookings } = await supabase
        .from('ambulance_bookings')
        .select('*')
        .eq('user_id', user.id);

      const userData = {
        profile,
        medicineScans,
        symptomAnalyses,
        ambulanceBookings,
        exportDate: new Date().toISOString()
      };

      // Create and download JSON file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading user data:', error);
    }
  };

  const incrementInteraction = () => {
    if (!user) {
      const newCount = interactionCount + 1;
      setInteractionCount(newCount);
      
      // Show auth modal after 2 interactions
      if (newCount >= 2) {
        setShowAuthModal(true);
      }
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    changePassword,
    downloadUserData,
    interactionCount,
    incrementInteraction,
    showAuthModal,
    setShowAuthModal
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};