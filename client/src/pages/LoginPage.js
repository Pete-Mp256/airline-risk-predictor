import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import AuthCard from '../components/AuthCard';

export default function LoginPage() {
  const { manager, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/shifts';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (manager) return <Navigate to={from} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiError(err).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Shift managers sign in to log incidents and review handovers."
      footer={<>No account yet? <Link to="/register" className="font-medium text-sky-700 hover:underline">Register</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthCard>
  );
}
