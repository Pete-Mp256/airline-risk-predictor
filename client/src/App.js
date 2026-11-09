import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { GoogleProvider } from './components/GoogleSignIn';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import HandoverDetailPage from './pages/HandoverDetailPage';
import HandoversPage from './pages/HandoversPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ShiftDetailPage from './pages/ShiftDetailPage';
import ShiftsPage from './pages/ShiftsPage';
import { Toaster } from 'components/ui/sonner';
import { TooltipProvider } from 'components/ui/tooltip';

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
      <GoogleProvider>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <Toaster />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route path="/shifts" element={<ShiftsPage />} />
                <Route path="/shifts/:id" element={<ShiftDetailPage />} />
                <Route path="/incidents/:id" element={<IncidentDetailPage />} />
                <Route path="/handovers" element={<HandoversPage />} />
                <Route path="/handovers/:id" element={<HandoverDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </TooltipProvider>
        </AuthProvider>
      </GoogleProvider>
    </BrowserRouter>
  );
}
