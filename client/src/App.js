import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import IncidentDetailPage from './pages/IncidentDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ShiftDetailPage from './pages/ShiftDetailPage';
import ShiftsPage from './pages/ShiftsPage';

function NotFound() {
  return (
    <div className="card">
      <h1 className="section-title">Page not found</h1>
      <Link to="/shifts" className="mt-2 inline-block text-sm text-accent-700 hover:underline">Go to shifts</Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/shifts" replace />} />
            <Route path="/shifts" element={<ShiftsPage />} />
            <Route path="/shifts/:id" element={<ShiftDetailPage />} />
            <Route path="/incidents/:id" element={<IncidentDetailPage />} />
            <Route path="/dashboard" element={<PlaceholderPage title="Dashboard" issue={24} />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
