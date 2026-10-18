import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirebase } from '../firebase.ts';
import { friendlyAuthError } from './authErrors.ts';
import type { AuthBackend } from './types.ts';

async function wrap<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (e) {
    throw friendlyAuthError(e);
  }
}

export function createFirebaseAuth(): AuthBackend {
  const { auth } = getFirebase();
  return {
    subscribe(cb) {
      return onAuthStateChanged(auth, (u) =>
        cb(u && { uid: u.uid, email: u.email, displayName: u.displayName }),
      );
    },
    // Popup only: redirect flows break on iOS Safari with third-party storage partitioning.
    async signInWithGoogle() {
      await wrap(signInWithPopup(auth, new GoogleAuthProvider()));
    },
    async signInWithEmail(email, pw) {
      await wrap(signInWithEmailAndPassword(auth, email, pw));
    },
    async signUpWithEmail(email, pw) {
      await wrap(createUserWithEmailAndPassword(auth, email, pw));
    },
    resetPassword: (email) => wrap(sendPasswordResetEmail(auth, email)),
    signOut: () => wrap(signOut(auth)),
  };
}
