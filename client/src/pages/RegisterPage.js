import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import AuthCard from '../components/AuthCard';
import GoogleSignIn from '../components/GoogleSignIn';
import PasswordInput from 'components/ui/password-input';

const EMPTY = { first_name: '', last_name: '', email: '', phone: '', department_id: '', password: '', confirm: '' };

export default function RegisterPage() {
  const { manager, register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/departments').then((res) => setDepartments(res.data.departments)).catch(() => {});
  }, []);

  if (manager) return <Navigate to="/shifts" replace />;

  const setValue = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));
  const set = (field) => (e) => setValue(field)(e.target.value);

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    if (form.password !== form.confirm) {
      setErrors({ confirm: 'Passwords do not match' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { confirm, ...body } = form;
      await register({
        ...body,
        phone: body.phone || null,
        department_id: body.department_id ? Number(body.department_id) : null,
      });
      navigate('/shifts', { replace: true });
    } catch (err) {
      const { message: msg, details } = apiError(err);
      setMessage(msg);
      setErrors(details);
      setSubmitting(false);
    }
  }

  const field = (name, label, props = {}) => (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} className="input input-soft" value={form[name]} onChange={set(name)}
        aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>
  );

  return (
    <AuthCard
      title="Create an account"
      subtitle="Create a staff account."
      footer={<>Already registered? <Link to="/login" className="link">Log in</Link></>}
    >
      <GoogleSignIn text="signup_with" onSignedIn={() => navigate('/shifts', { replace: true })} />
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
        {message && <p className="alert-error" role="alert">{message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('first_name', 'First name', { autoComplete: 'given-name' })}
          {field('last_name', 'Last name', { autoComplete: 'family-name' })}
        </div>
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel' })}
        <div>
          <label htmlFor="department_id" className="label">Department</label>
          <select id="department_id" className="input input-soft" value={form.department_id} onChange={set('department_id')}>
            <option value="">Select a department</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>{d.name}</option>
            ))}
          </select>
          {errors.department_id && <p className="field-error">{errors.department_id}</p>}
        </div>
        {/* The strength meter sits below the field, so leave room for it once typing starts. */}
        <div className={form.password ? 'pb-12' : undefined}>
          <label htmlFor="password" className="label">Password (at least 8 characters)</label>
          <PasswordInput id="password" autoComplete="new-password" className="max-w-none"
            aria-invalid={Boolean(errors.password)} value={form.password} onChange={setValue('password')} />
          {errors.password && <p className="field-error">{errors.password}</p>}
        </div>
        <div>
          <label htmlFor="confirm" className="label">Confirm password</label>
          <PasswordInput id="confirm" autoComplete="new-password" strength={false} className="max-w-none"
            aria-invalid={Boolean(errors.confirm)} value={form.confirm} onChange={setValue('confirm')} />
          {errors.confirm && <p className="field-error">{errors.confirm}</p>}
        </div>
        <button type="submit" className="btn-primary h-12 w-full text-base" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
