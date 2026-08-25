import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shadow-md">
      <div className="flex items-center space-x-6">
        <span className="text-xl font-bold text-indigo-400">WorkTrack</span>
        {user && (
          <>
            <Link to="/" className="hover:text-indigo-300">Dashboard</Link>
            <Link to="/rules" className="hover:text-indigo-300">Rules & Policies</Link>
          </>
        )}
      </div>
      <div className="flex items-center space-x-4">
        {user ? (
          <>
            <span className="text-sm bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              {user.name} ({user.role})
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-1 text-sm rounded cursor-pointer"
            >
              Logout
            </button>
          </>
        ) : (
          <Link to="/login" className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded text-sm font-medium">
            Login
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;