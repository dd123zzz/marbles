const MESSAGES: Record<string, string> = {
  'auth/popup-closed-by-user': 'The sign-in window was closed before finishing. Please try again.',
  'auth/cancelled-popup-request':
    'The sign-in window was closed before finishing. Please try again.',
  'auth/popup-blocked':
    'Your browser blocked the sign-in popup. Allow popups for this site and try again.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found for that email.',
  'auth/email-already-in-use': 'An account with that email already exists. Try signing in instead.',
  'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
  'auth/invalid-email': 'That email address does not look right.',
  'auth/missing-password': 'Please enter your password.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/unauthorized-domain': 'This domain is not authorized for sign-in.',
};

export function friendlyAuthError(e: unknown): Error {
  const code = typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
  return new Error(MESSAGES[code] ?? 'Something went wrong. Please try again.', { cause: e });
}
