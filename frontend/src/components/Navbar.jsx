import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-slate-900 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <div className="flex items-center gap-2">
            <Link to="/" className="text-xl font-bold tracking-tight text-indigo-400 hover:text-indigo-300 transition">
              CSsphere
            </Link>
          </div>

          {/* Desktop Nav Items */}
          {user && (
            <div className="hidden md:flex items-center space-x-4">
              <Link to="/" className="text-sm hover:text-indigo-300 transition">
                Dashboard
              </Link>
              <Link to="/policies" className="text-sm hover:text-indigo-300 transition">
                Rules & Policies
              </Link>
              
              <span className="bg-slate-800 text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-200">
                {user.name} ({user.role})
              </span>

              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                Logout
              </button>
            </div>
          )}

          {/* Mobile Hamburger Button */}
          {user && (
            <div className="flex md:hidden">
              <button
                onClick={() => setIsOpen(!isOpen)}
                type="button"
                className="text-slate-300 hover:text-white p-2 rounded-md focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Collapsed Menu */}
      {user && isOpen && (
        <div className="md:hidden px-4 pt-2 pb-4 space-y-3 bg-slate-950 border-t border-slate-800">
          <div className="text-xs text-slate-400 pb-1 border-b border-slate-800">
            Signed in as <span className="font-semibold text-slate-200">{user.name} ({user.role})</span>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              to="/"
              onClick={() => setIsOpen(false)}
              className="text-sm py-1.5 text-slate-200 hover:text-indigo-400"
            >
              Dashboard
            </Link>
            <Link
              to="/policies"
              onClick={() => setIsOpen(false)}
              className="text-sm py-1.5 text-slate-200 hover:text-indigo-400"
            >
              Rules & Policies
            </Link>
            <button
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="w-full text-left text-sm py-2 text-red-400 font-semibold hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;