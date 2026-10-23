import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function ProtectedRoute({ children }) {
  const { manager, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="p-8 text-center text-sm text-slate-500">Loading…</p>;
  }
  if (!manager) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
