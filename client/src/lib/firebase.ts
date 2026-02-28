// Firebase Client Configuration for Web App
import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  UserCredential,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer,
} from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { config } from "./config";

// Firebase configuration
const firebaseConfig = config.firebase;

// Initialize Firebase (singleton pattern)
function getFirebaseApp(): FirebaseApp {
  if (getApps().length === 0) {
    return initializeApp(firebaseConfig);
  }
  return getApp();
}

// Get Firebase services
export const app = getFirebaseApp();
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Auth providers
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

// User profile type - matching backend USER_ROLES: ["USER", "MUNICIPALITY_USER", "PLATFORM_MAINTAINER", "admin"]
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

// Collection names
export const COLLECTIONS = {
  ISSUES: "issues",
  MUNICIPALITIES: "municipalities",
  USERS: "users",
  SCORE_HISTORY: "score_history",
  VERIFICATIONS: "verifications",
} as const;

// ========== Auth Functions ==========

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const userCredential = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );
  // Update last login
  await updateUserLastLogin(userCredential.user.uid);
  return userCredential;
}

/**
 * Register with email and password
 */
export async function registerWithEmail(
  email: string,
  password: string,
  displayName?: string
): Promise<UserCredential> {
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  // Update display name if provided
  if (displayName) {
    await updateProfile(userCredential.user, { displayName });
  }

  // Send email verification
  await sendEmailVerification(userCredential.user);

  // Create user profile in Firestore
  await createUserProfile(userCredential.user, "USER");

  return userCredential;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  const userCredential = await signInWithPopup(auth, googleProvider);

  // Check if user profile exists, if not create one
  const userDoc = await getDoc(
    doc(db, COLLECTIONS.USERS, userCredential.user.uid)
  );

  if (!userDoc.exists()) {
    await createUserProfile(userCredential.user, "USER");
  } else {
    await updateUserLastLogin(userCredential.user.uid);
  }

  return userCredential;
}

/**
 * Sign out
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Create user profile in Firestore
 */
async function createUserProfile(
  user: User,
  role: "USER" | "MUNICIPALITY_USER" | "PLATFORM_MAINTAINER"
): Promise<void> {
  const userProfile: Omit<UserProfile, "createdAt" | "lastLogin"> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastLogin: ReturnType<typeof serverTimestamp>;
  } = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
  };

  await setDoc(doc(db, COLLECTIONS.USERS, user.uid), userProfile);
}

/**
 * Update user's last login timestamp
 */
async function updateUserLastLogin(uid: string): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.USERS, uid),
    {
      lastLogin: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Get user profile from Firestore (always fetch fresh from server)
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    // Try to get fresh data from server first
    const userDoc = await getDocFromServer(doc(db, COLLECTIONS.USERS, uid));

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as UserProfile;
  } catch {
    // Fall back to cache if offline
    const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));

    if (!userDoc.exists()) {
      return null;
    }

    return userDoc.data() as UserProfile;
  }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Get ID token for API calls
 */
export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}
