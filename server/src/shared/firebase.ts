// Firebase Admin SDK Configuration
import { initializeApp, getApps, cert, App, applicationDefault } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

function initializeAdminApp(): App {
  if (getApps().length === 0) {
    let credential;
    
    // Try to load service account from file path first
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      try {
        const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
        if (fs.existsSync(serviceAccountPath)) {
          const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
          credential = cert(serviceAccount);
          console.log('✅ Firebase initialized with service account file');
        } else {
          console.warn('⚠️ Service account file not found at:', serviceAccountPath);
        }
      } catch (error) {
        console.error('Error loading service account from file:', error);
      }
    }
    
    // Try to load from JSON string in environment variable
    if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = cert(serviceAccount);
        console.log('✅ Firebase initialized with service account JSON');
      } catch (error) {
        console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_KEY:', error);
      }
    }
    
    // Try individual credentials
    if (!credential && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      credential = cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
      console.log('✅ Firebase initialized with individual credentials');
    }

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'civiclemma.firebasestorage.app';

    if (credential) {
      adminApp = initializeApp({
        credential,
        projectId,
        storageBucket,
      });
    } else if (projectId) {
      // Initialize without credentials - will use Application Default Credentials
      // This works in Google Cloud environments or with gcloud auth application-default login
      console.warn('⚠️ No Firebase credentials found. Attempting to use Application Default Credentials...');
      console.warn('⚠️ To fix this, either:');
      console.warn('   1. Download serviceAccountKey.json from Firebase Console and set FIREBASE_SERVICE_ACCOUNT_PATH');
      console.warn('   2. Set FIREBASE_SERVICE_ACCOUNT_KEY with the JSON content');
      console.warn('   3. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY');
      console.warn('   4. Run: gcloud auth application-default login');
      
      try {
        adminApp = initializeApp({
          credential: applicationDefault(),
          projectId,
          storageBucket,
        });
        console.log('✅ Firebase initialized with Application Default Credentials');
      } catch (error) {
        console.error('❌ Failed to initialize Firebase with Application Default Credentials');
        // Create a minimal app that will fail on actual operations
        adminApp = initializeApp({
          projectId,
          storageBucket,
        });
      }
    } else {
      throw new Error('Firebase configuration missing. Set FIREBASE_PROJECT_ID at minimum.');
    }
  } else {
    adminApp = getApps()[0];
  }
  return adminApp;
}

export function getAdminApp(): App {
  if (!adminApp) {
    adminApp = initializeAdminApp();
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) {
    adminStorage = getStorage(getAdminApp());
  }
  return adminStorage;
}

// Collection names
export const COLLECTIONS = {
  ISSUES: 'issues',
  MUNICIPALITIES: 'municipalities',
  USERS: 'users',
  SCORE_HISTORY: 'score_history',
  VERIFICATIONS: 'verifications'
} as const;

// Firestore helper types
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

export function timestampToDate(timestamp: FirestoreTimestamp): Date {
  return new Date(timestamp.seconds * 1000 + timestamp.nanoseconds / 1000000);
}

export function dateToTimestamp(date: Date): FirestoreTimestamp {
  return {
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1000000
  };
}

// Firebase regions
export const FIREBASE_REGIONS = {
  ASIA_SOUTH1: 'asia-south1',  // Mumbai
  ASIA_EAST1: 'asia-east1',    // Taiwan
  US_CENTRAL1: 'us-central1'   // Iowa
} as const;

export const DEFAULT_REGION = FIREBASE_REGIONS.ASIA_SOUTH1;
