"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { 
  CognitoAppUser,
  signInWithEmail,
  registerWithEmail,
  signOut as cognitoSignOut,
  resetPassword,
  getUserProfile,
  onAuthChange,
  getIdToken,
  UserProfile
} from '@/lib/cognito';

interface AuthContextType {
  user: CognitoAppUser | null;
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
  const [user, setUser] = useState<CognitoAppUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check auth state on mount
  useEffect(() => {
    const unsubscribe = onAuthChange(async (cognitoUser) => {
      setUser(cognitoUser);
      
      if (cognitoUser) {
        setProfileLoading(true);
        try {
          const profile = await getUserProfile(cognitoUser.uid);
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
      const { user: cognitoUser } = await signInWithEmail(email, password);
      const profile = await getUserProfile(cognitoUser.uid);
      setUser(cognitoUser);
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
      const { user: cognitoUser } = await registerWithEmail(email, password, displayName);
      setUser(cognitoUser);

      // Auto sign-in after registration if user is confirmed
      try {
        const { user: signedInUser } = await signInWithEmail(email, password);
        const profile = await getUserProfile(signedInUser.uid);
        setUser(signedInUser);
        setUserProfile(profile);
      } catch {
        // User may need to confirm email first
        console.log('User may need email confirmation before sign-in');
      }

      setProfileLoading(false);
    } catch (err: unknown) {
      setProfileLoading(false);
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signInGoogle = useCallback(async (): Promise<UserProfile | null> => {
    // Cognito Hosted UI OAuth flow
    // For Google sign-in, redirect to Cognito Hosted UI
    try {
      setError(null);
      const { cognito } = await import('@/lib/config').then(m => m.config);
      const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
      const hostedUiUrl = `https://${cognito.domain}.auth.${cognito.region}.amazoncognito.com/oauth2/authorize?client_id=${cognito.clientId}&response_type=code&scope=openid+email+profile&redirect_uri=${redirectUri}&identity_provider=Google`;
      window.location.href = hostedUiUrl;
      return null;
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      setError(message);
      throw new Error(message);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      setError(null);
      await cognitoSignOut();
      setUser(null);
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

// Helper function to get user-friendly error messages from Cognito errors
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    const name = (error as { code?: string }).code || error.name || '';
    
    // Cognito error codes
    if (name === 'UsernameExistsException' || message.includes('already exists')) {
      return 'This email is already registered. Please sign in instead.';
    }
    if (name === 'InvalidParameterException' || message.includes('Invalid email')) {
      return 'Invalid email address.';
    }
    if (name === 'InvalidPasswordException' || message.includes('password')) {
      return 'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, number, and symbol.';
    }
    if (name === 'UserNotConfirmedException') {
      return 'Please verify your email before signing in.';
    }
    if (name === 'UserNotFoundException' || message.includes('User does not exist')) {
      return 'No account found with this email.';
    }
    if (name === 'NotAuthorizedException' || message.includes('Incorrect username or password')) {
      return 'Invalid credentials. Please check your email and password.';
    }
    if (name === 'TooManyRequestsException' || message.includes('too many')) {
      return 'Too many failed attempts. Please try again later.';
    }
    if (name === 'LimitExceededException') {
      return 'Attempt limit exceeded. Please try again later.';
    }
    if (name === 'CodeMismatchException') {
      return 'Invalid verification code.';
    }
    if (name === 'ExpiredCodeException') {
      return 'Verification code has expired. Please request a new one.';
    }
    if (message.includes('Network') || message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }
    
    return message;
  }
  
  return 'An unexpected error occurred. Please try again.';
}

export default AuthContext;
