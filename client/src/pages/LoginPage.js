import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import AuthCard from '../components/AuthCard';
import GoogleSignIn from '../components/GoogleSignIn';

const RESEND_COOLDOWN = 60; // seconds; matches the server

export default function LoginPage() {
  const { manager, login, verifyCode, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/shifts';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Second step: set once the password is accepted and the code is emailed.
  const [pending, setPending] = useState(null); // { pending_token, email }
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (manager) return <Navigate to={from} replace />;

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await login(email, password);
      setPending(result);
      setCode('');
      setNotice('');
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(apiError(err).message);
    }
    setSubmitting(false);
  }

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await verifyCode(pending.pending_token, code);
      navigate(from, { replace: true });
    } catch (err) {
      const { message } = apiError(err);
      const left = err.response?.data?.attempts_left;
      setError(left != null ? `${message}. ${left} attempt${left === 1 ? '' : 's'} left.` : message);
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setNotice('');
    try {
      await resendCode(pending.pending_token);
      setCode('');
      setNotice(`A new code was sent to ${pending.email}.`);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(apiError(err).message);
      const retry = err.response?.data?.retry_after;
      if (retry) setCooldown(retry);
    }
  }

  function startOver() {
    setPending(null);
    setPassword('');
    setError('');
    setNotice('');
  }

  if (pending) {
    return (
      <AuthCard
        title="Check your email"
        subtitle={`We sent a 6-digit sign-in code to ${pending.email}. It expires in 10 minutes.`}
        footer={<button type="button" onClick={startOver} className="font-medium text-accent-700 hover:underline">Use a different account</button>}
      >
        <form onSubmit={handleVerify} className="space-y-4" noValidate>
          {error && <p className="alert-error" role="alert">{error}</p>}
          {notice && <p className="text-sm text-slate-600" role="status">{notice}</p>}
          <div>
            <label htmlFor="code" className="label">Verification code</label>
            <input id="code" type="text" inputMode="numeric" autoComplete="one-time-code" autoFocus
              maxLength={6} pattern="\d{6}" required
              className="input text-center text-2xl tracking-[0.5em]"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting || code.length !== 6}>
            {submitting ? 'Verifying…' : 'Verify and sign in'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Staff sign in to log incidents and review handovers."
      footer={<>No account yet? <Link to="/register" className="font-medium text-accent-700 hover:underline">Register</Link></>}
    >
      <GoogleSignIn onSignedIn={() => navigate(from, { replace: true })} />
      <form onSubmit={handleLogin} className="mt-4 space-y-4" noValidate>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="email" required className="input"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" required className="input"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={submitting || !email || !password}>
          {submitting ? 'Sending code…' : 'Log in'}
        </button>
      </form>
    </AuthCard>
  );
}
