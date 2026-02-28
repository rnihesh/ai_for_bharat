/**
 * Application Configuration
 * Centralized environment variables with type safety and validation
 */

export const config = {
  // API Configuration
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
    mlUrl: process.env.NEXT_PUBLIC_ML_API_URL || "http://localhost:8000",
    agentUrl: process.env.NEXT_PUBLIC_AGENT_API_URL || "http://localhost:8001",
  },

  // Map Configuration
  map: {
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    defaultCenter: {
      lat: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_MAP_LAT || "12.9716"),
      lng: parseFloat(process.env.NEXT_PUBLIC_DEFAULT_MAP_LNG || "77.5946"),
    },
  },

  // Firebase Configuration
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  },

  // App Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || "CivicLemma",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  },
} as const;

// Type-safe config access
export type Config = typeof config;

// Validation helper - checks if required env vars are present
export function validateConfig() {
  const errors: string[] = [];

  if (!config.map.googleMapsApiKey) {
    errors.push("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required");
  }

  if (!config.firebase.apiKey) {
    errors.push("NEXT_PUBLIC_FIREBASE_API_KEY is required");
  }

  if (!config.firebase.projectId) {
    errors.push("NEXT_PUBLIC_FIREBASE_PROJECT_ID is required");
  }

  if (errors.length > 0) {
    console.warn("⚠️  Missing environment variables:");
    errors.forEach((error) => console.warn(`  - ${error}`));
  }

  return errors.length === 0;
}
