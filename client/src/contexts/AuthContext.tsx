"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  auth,
  signInWithEmail,
  registerWithEmail,
  signInWithGoogle,
  signOut as firebaseSignOut,
  resetPassword,
  getUserProfile,
  onAuthChange,
  getIdToken,
  UserProfile
} from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<UserProfile | null>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInGoogle: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
  resetUserPassword: (email: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user profile from Firestore
        setProfileLoading(true);
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch (err) {
          console.error('Error fetching user profile:', err);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<UserProfile | null> => {
    try {
      setError(null);
      setProfileLoading(true);
      const userCredential = await signInWithEmail(email, password);
      // Fetch profile immediately after sign-in (don't wait for onAuthStateChanged)
      const profile = await getUserProfile(userCredential.user.uid);
      setUser(userCredential.user);
      setUserProfile(profile);
      setProfileLoading(false);
      return profile;
    } catch (err: unknown) {
      setProfileLoading(false);
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    try {
      setError(null);
      setProfileLoading(true);
      const userCredential = await registerWithEmail(email, password, displayName);
      // Fetch profile immediately after sign-up
      const profile = await getUserProfile(userCredential.user.uid);
      setUser(userCredential.user);
      setUserProfile(profile);
      setProfileLoading(false);
    } catch (err: unknown) {
      setProfileLoading(false);
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signInGoogle = useCallback(async (): Promise<UserProfile | null> => {
    try {
      setError(null);
      setProfileLoading(true);
      const userCredential = await signInWithGoogle();
      // Fetch profile immediately after Google sign-in
      const profile = await getUserProfile(userCredential.user.uid);
      setUser(userCredential.user);
      setUserProfile(profile);
      setProfileLoading(false);
      return profile;
    } catch (err: unknown) {
      setProfileLoading(false);
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setError(null);
      await firebaseSignOut();
      setUserProfile(null);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const resetUserPassword = useCallback(async (email: string) => {
    try {
      setError(null);
      await resetPassword(email);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const getToken = useCallback(async () => {
    return getIdToken();
  }, []);

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    profileLoading,
    error,
    signIn,
    signUp,
    signInGoogle,
    signOut,
    resetUserPassword,
    getToken,
    clearError
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper function to get user-friendly error messages
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    
    // Firebase auth error codes
    if (message.includes('auth/email-already-in-use')) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (message.includes('auth/invalid-email')) {
      return 'Invalid email address.';
    }
    if (message.includes('auth/operation-not-allowed')) {
      return 'This sign-in method is not enabled.';
    }
    if (message.includes('auth/weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (message.includes('auth/user-disabled')) {
      return 'This account has been disabled.';
    }
    if (message.includes('auth/user-not-found')) {
      return 'No account found with this email.';
    }
    if (message.includes('auth/wrong-password')) {
      return 'Incorrect password.';
    }
    if (message.includes('auth/invalid-credential')) {
      return 'Invalid credentials. Please check your email and password.';
    }
    if (message.includes('auth/too-many-requests')) {
      return 'Too many failed attempts. Please try again later.';
    }
    if (message.includes('auth/popup-closed-by-user')) {
      return 'Sign-in popup was closed. Please try again.';
    }
    if (message.includes('auth/popup-blocked')) {
      return 'Pop-up blocked by browser. Please allow pop-ups for this site.';
    }
    if (message.includes('auth/network-request-failed')) {
      return 'Network error. Please check your connection.';
    }
    
    return message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

export default AuthContext;
