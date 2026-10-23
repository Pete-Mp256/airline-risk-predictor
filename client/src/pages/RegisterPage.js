import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import api, { apiError } from '../api';
import { useAuth } from '../auth/AuthContext';
import AuthCard from '../components/AuthCard';

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

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

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
      <input id={name} className="input" value={form[name]} onChange={set(name)}
        aria-invalid={Boolean(errors[name])} {...props} />
      {errors[name] && <p className="field-error">{errors[name]}</p>}
    </div>
  );

  return (
    <AuthCard
      title="Create an account"
      subtitle="Register as a shift manager."
      footer={<>Already registered? <Link to="/login" className="font-medium text-sky-700 hover:underline">Log in</Link></>}
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {message && <p className="alert-error" role="alert">{message}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          {field('first_name', 'First name', { autoComplete: 'given-name' })}
          {field('last_name', 'Last name', { autoComplete: 'family-name' })}
        </div>
        {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
        {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel' })}
        <div>
          <label htmlFor="department_id" className="label">Department</label>
          <select id="department_id" className="input" value={form.department_id} onChange={set('department_id')}>
            <option value="">Select a department</option>
            {departments.map((d) => (
              <option key={d.department_id} value={d.department_id}>{d.name}</option>
            ))}
          </select>
          {errors.department_id && <p className="field-error">{errors.department_id}</p>}
        </div>
        {field('password', 'Password (at least 8 characters)', { type: 'password', autoComplete: 'new-password' })}
        {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
