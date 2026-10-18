export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface AuthActions {
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
}

/** Implemented by the Firebase and demo backends. Action failures reject with a friendly Error message. */
export interface AuthBackend extends AuthActions {
  /** Fires once with the initial state, then on every change. */
  subscribe(cb: (user: AuthUser | null) => void): () => void;
}

export interface AuthContextValue extends AuthActions {
  user: AuthUser | null;
  loading: boolean;
}
