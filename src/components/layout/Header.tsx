import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTrashCount } from '../../hooks/useTrashCount';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const { trashCount } = useTrashCount();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-24">
          <div className="flex items-center">
            <img 
              src="/img/Iblegal_atti.png?v=2" 
              alt="IBLegal Atti" 
              className="h-32"
            />
          </div>
          
          <nav className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </Link>
            
            <Link
              to="/legend"
              className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Legenda
            </Link>
            
            {(user?.role === 'admin' || user?.email === 'daniele.miconi@iblegal.it') && (
              <>
                <Link
                  to="/admin"
                  className="text-gray-700 hover:text-green-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Admin
                </Link>
                
                <Link
                  to="/trash"
                  className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium relative"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Cestino
                    {trashCount > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
                        {trashCount}
                      </span>
                    )}
                  </div>
                </Link>
              </>
            )}
            
            <div className="flex items-center space-x-2 ml-4 pl-4 border-l border-gray-200">
              <span className="text-sm text-gray-600">
                {user?.name} ({user?.initials})
              </span>
              <button
                onClick={handleLogout}
                className="text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Esci
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};