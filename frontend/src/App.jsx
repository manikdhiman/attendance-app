import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import EmployeeDashboard from './pages/EmployeeDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Rules from './pages/Rules';
import { useAuth } from './context/AuthContext';

function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-gray-900">
      <Navbar />
      <main className="py-6">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/rules" element={<Rules />} />

          {/* Root dynamic dashboard based on RBAC role */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                {user?.role === 'ADMIN' ? <AdminDashboard /> : <EmployeeDashboard />}
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;