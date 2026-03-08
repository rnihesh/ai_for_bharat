/**
 * AWS Cognito Authentication Client
 * Handles user auth via amazon-cognito-identity-js
 */

import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserSession,
  CognitoUserAttribute,
  ISignUpResult,
} from "amazon-cognito-identity-js";
import { config } from "./config";

// Cognito User Pool configuration
const poolData = {
  UserPoolId: config.cognito.userPoolId,
  ClientId: config.cognito.clientId,
};

let userPool: CognitoUserPool | null = null;

function getUserPool(): CognitoUserPool {
  if (!userPool) {
    userPool = new CognitoUserPool(poolData);
  }
  return userPool;
}

// User type compatible with app shape for minimal downstream changes
export interface CognitoAppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// User profile type aligned with backend
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: "USER" | "MUNICIPALITY_USER" | "PLATFORM_MAINTAINER" | "admin" | null;
  municipalityId?: string;
  createdAt: Date;
  lastLogin: Date;
}

// API base URL for profile operations
const API_BASE = config.api.baseUrl;

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ user: CognitoAppUser; session: CognitoUserSession }> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: getUserPool(),
    });

    const authDetails = new AuthenticationDetails({
      Username: email,
      Password: password,
    });

    cognitoUser.authenticateUser(authDetails, {
      onSuccess: async (session) => {
        const user = sessionToAppUser(session, email);
        resolve({ user, session });
      },
      onFailure: (err) => {
        reject(err);
      },
    });
  });
}

/**
 * Register with email and password
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: CognitoAppUser; signUpResult: ISignUpResult }> {
  return new Promise((resolve, reject) => {
    const attributeList: CognitoUserAttribute[] = [
      new CognitoUserAttribute({ Name: "email", Value: email }),
    ];

    if (displayName) {
      attributeList.push(
        new CognitoUserAttribute({ Name: "name", Value: displayName })
      );
    }

    getUserPool().signUp(email, password, attributeList, [], (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      if (!result) {
        reject(new Error("Registration failed"));
        return;
      }

      const user: CognitoAppUser = {
        uid: result.userSub,
        email,
        displayName: displayName || null,
        photoURL: null,
      };

      resolve({ user, signUpResult: result });
    });
  });
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  const cognitoUser = getUserPool().getCurrentUser();
  if (cognitoUser) {
    cognitoUser.signOut();
  }
}

/**
 * Send password reset email via Cognito
 */
export async function resetPassword(email: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cognitoUser = new CognitoUser({
      Username: email,
      Pool: getUserPool(),
    });

    cognitoUser.forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(err),
    });
  });
}

/**
 * Get user profile from backend API
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const token = await getIdToken();
    if (!token) return null;

    const response = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data?.data || null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
}

/**
 * Subscribe to auth state changes
 * Cognito doesn't have real-time listeners like other auth providers
 * We check session validity on init and provide the callback
 */
export function onAuthChange(
  callback: (user: CognitoAppUser | null) => void
): () => void {
  let cancelled = false;

  const checkSession = () => {
    const cognitoUser = getUserPool().getCurrentUser();

    if (!cognitoUser) {
      if (!cancelled) callback(null);
      return;
    }

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (cancelled) return;

        if (err || !session || !session.isValid()) {
          callback(null);
          return;
        }

        const user = sessionToAppUser(session);
        callback(user);
      }
    );
  };

  // Check immediately
  checkSession();

  // Return unsubscribe function
  return () => {
    cancelled = true;
  };
}

/**
 * Get current user from session
 */
export function getCurrentUser(): CognitoAppUser | null {
  const cognitoUser = getUserPool().getCurrentUser();
  if (!cognitoUser) return null;

  let appUser: CognitoAppUser | null = null;

  cognitoUser.getSession(
    (err: Error | null, session: CognitoUserSession | null) => {
      if (!err && session && session.isValid()) {
        appUser = sessionToAppUser(session);
      }
    }
  );

  return appUser;
}

/**
 * Get current access token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const cognitoUser = getUserPool().getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session || !session.isValid()) {
          resolve(null);
          return;
        }
        resolve(session.getIdToken().getJwtToken());
      }
    );
  });
}

/**
 * Refresh the current session
 */
export async function refreshSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const cognitoUser = getUserPool().getCurrentUser();

    if (!cognitoUser) {
      resolve(null);
      return;
    }

    cognitoUser.getSession(
      (err: Error | null, session: CognitoUserSession | null) => {
        if (err || !session) {
          resolve(null);
          return;
        }

        const refreshToken = session.getRefreshToken();
        cognitoUser.refreshSession(refreshToken, (refErr, newSession) => {
          if (refErr) {
            resolve(null);
            return;
          }
          resolve(newSession);
        });
      }
    );
  });
}

// Helper: Extract user info from Cognito session
function sessionToAppUser(
  session: CognitoUserSession,
  emailOverride?: string
): CognitoAppUser {
  const idToken = session.getIdToken();
  const payload = idToken.decodePayload();

  return {
    uid: payload.sub || "",
    email: emailOverride || payload.email || null,
    displayName: payload.name || payload["cognito:username"] || null,
    photoURL: payload.picture || null,
  };
}
