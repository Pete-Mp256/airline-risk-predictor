import { useState } from 'react';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';

export const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Wraps the app so the Google button can load; a no-op when no client ID is configured.
export function GoogleProvider({ children }) {
  if (!GOOGLE_CLIENT_ID) return children;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}

// "Sign in with Google" button plus an "or" divider above the email form.
// Google sign-ins skip the email code, so onSignedIn runs once the session has started.
export default function GoogleSignIn({ text = 'signin_with', onSignedIn }) {
  const { googleSignIn } = useAuth();
  const [error, setError] = useState('');

  if (!GOOGLE_CLIENT_ID) return null;

  async function handleSuccess({ credential }) {
    setError('');
    try {
      await googleSignIn(credential);
      onSignedIn();
    } catch (err) {
      setError(apiError(err).message);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="alert-error" role="alert">{error}</p>}
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Google sign-in was cancelled or failed. Try again.')}
          text={text}
          shape="pill"
          theme="outline"
          width="320"
        />
      </div>
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or with email
        <span className="h-px flex-1 bg-slate-200" />
      </div>
    </div>
  );
}
