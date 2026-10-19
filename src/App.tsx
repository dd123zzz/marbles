import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx';
import RequireAuth from './auth/RequireAuth.tsx';
import SignInView from './auth/SignInView.tsx';
import Layout from './components/Layout.tsx';
import { RepoProvider } from './data/RepoProvider.tsx';
import DayView from './views/DayView.tsx';
import ExportView from './views/ExportView.tsx';
import MonthView from './views/MonthView.tsx';
import SettingsView from './views/SettingsView.tsx';
import StatsView from './views/StatsView.tsx';
import WeekView from './views/WeekView.tsx';

function SignInRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="loading">Loading…</p>;
  return user ? <Navigate to="/" replace /> : <SignInView />;
}

export default function App() {
  return (
    <AuthProvider>
      <RepoProvider>
        <Routes>
          <Route path="/signin" element={<SignInRoute />} />
          <Route
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DayView />} />
            <Route path="/day/:date" element={<DayView />} />
            <Route path="/week/:date" element={<WeekView />} />
            <Route path="/month/:ym" element={<MonthView />} />
            <Route path="/stats/:period/:date" element={<StatsView />} />
            <Route path="/export" element={<ExportView />} />
            <Route path="/settings" element={<SettingsView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </RepoProvider>
    </AuthProvider>
  );
}
