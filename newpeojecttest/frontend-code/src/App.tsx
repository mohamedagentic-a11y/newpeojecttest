import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { Catalogue } from './pages/Catalogue';
import { MyLoans } from './pages/MyLoans';
import { AdminDashboard } from './pages/AdminDashboard';
import { useAuthStore, User } from './store/useAuthStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: User['role'][];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const user = useAuthStore((state: any) => state.user as User | null);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/catalogue" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/catalogue" 
            element={
              <ProtectedRoute>
                <Catalogue />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/my-loans" 
            element={
              <ProtectedRoute allowedRoles={['member']}>
                <MyLoans />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['librarian']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          <Route path="/" element={<Navigate to="/catalogue" replace />} />
          <Route path="*" element={<Navigate to="/catalogue" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}