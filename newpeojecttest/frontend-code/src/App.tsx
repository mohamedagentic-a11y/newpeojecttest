import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CataloguePage from './pages/CataloguePage';
import MyLoansPage from './pages/MyLoansPage';
import AdminBooksPage from './pages/AdminBooksPage';
import BorrowedBooksPage from './pages/BorrowedBooksPage';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

/**
 * Root route table.
 *
 * Providers (including the Router) are mounted in main.tsx, so this file only
 * declares <Routes>.
 *
 * Outlet chain:
 *   ProtectedRoute (guards and renders its <Outlet />)
 *     └─ Layout (navigation chrome and the single page <Outlet />)
 *          └─ page routes
 *
 * Layout.tsx already renders the <Outlet /> for the pages. This file therefore
 * renders no outlet of its own, so each page appears exactly once.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<CataloguePage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/my-loans" element={<MyLoansPage />} />
          <Route path="/admin/books" element={<AdminBooksPage />} />
          <Route path="/admin/borrowed" element={<BorrowedBooksPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}