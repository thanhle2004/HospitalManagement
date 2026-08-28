import "client-only";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebasePhoneAuth(): Auth {
  if (firebaseAuth) return firebaseAuth;

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };

  if (!config.apiKey || !config.authDomain || !config.projectId || !config.appId) {
    throw new Error("Firebase Phone Authentication chưa được cấu hình");
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
  firebaseAuth = getAuth(firebaseApp);
  firebaseAuth.languageCode = "vi";
  firebaseAuth.settings.appVerificationDisabledForTesting =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_TESTING === "true";
  return firebaseAuth;
}
