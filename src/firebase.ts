import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

// Only ever loaded via dynamic import() when VITE_DEMO !== 'true'.

declare global {
  interface Window {
    // Read by the App Check SDK; lets local dev use a token registered in the Firebase console.
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | undefined;

// Optional: skipped when VITE_APPCHECK_SITE_KEY is unset. Runs once, when the app is first created.
function initAppCheck(app: FirebaseApp): void {
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
  if (!siteKey) return;
  const debugToken = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
  if (import.meta.env.DEV && debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

function createApp(): FirebaseApp {
  if (getApps().length > 0) return getApp();
  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  initAppCheck(app);
  return app;
}

export function getFirebase(): FirebaseServices {
  if (services) return services;
  const app = createApp();
  const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';

  let auth: Auth;
  let db: Firestore;
  let fresh = true;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // already initialized (e.g. dev hot reload)
    auth = getAuth(app);
    fresh = false;
  }
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
    fresh = false;
  }

  if (useEmulator && fresh) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }

  services = { app, auth, db };
  return services;
}
