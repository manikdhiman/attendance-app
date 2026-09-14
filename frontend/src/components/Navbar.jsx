import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link 
            to="/" 
            className="text-xl font-black tracking-tight text-white flex items-center gap-2"
          >
            <span className="text-indigo-400">CS</span>sphere
          </Link>

          {/* Desktop Navigation */}
          {user && (
            <div className="hidden md:flex items-center space-x-6">
              <Link 
                to="/" 
                className="text-sm font-medium text-slate-300 hover:text-white transition"
              >
                Dashboard
              </Link>
              <Link 
                to="/policies" 
                className="text-sm font-medium text-slate-300 hover:text-white transition"
              >
                Rules & Policies
              </Link>
              <span className="bg-slate-800 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-full border border-slate-700">
                {user.name} ({user.role})
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          {user && (
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white focus:outline-none"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {user && mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-t border-slate-800 px-4 py-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <p className="text-xs text-slate-400">Signed in as</p>
              <p className="text-sm font-bold text-slate-100">{user.name}</p>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-indigo-900 text-indigo-200 border border-indigo-700">
              {user.role}
            </span>
          </div>

          <div className="flex flex-col space-y-2 pt-1">
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              📊 Dashboard
            </Link>
            <Link
              to="/policies"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition"
            >
              📋 Rules & Policies
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left px-3 py-2 rounded-md text-sm font-semibold text-red-400 hover:bg-red-500/10 transition"
            >
              🚪 Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;