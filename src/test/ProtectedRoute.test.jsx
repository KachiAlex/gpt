import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProtectedRoute from '../components/Auth/ProtectedRoute';

// Mock the auth context — the component only needs these three
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../contexts/AuthContext';

const renderAt = (authValue, roles, initialPath = '/protected') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route path={initialPath} element={
          <ProtectedRoute roles={roles}><div>protected content</div></ProtectedRoute>
        } />
      </Routes>
    </MemoryRouter>
  );

describe('ProtectedRoute', () => {
  it('redirects unauthenticated users to /login', () => {
    useAuth.mockReturnValue({ isAuthenticated: () => false, hasRole: () => false, loading: false });
    renderAt(null, ['GOVERNMENT_ADMIN']);
    expect(screen.getByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('denies authenticated users without the required role', () => {
    useAuth.mockReturnValue({ isAuthenticated: () => true, hasRole: () => false, loading: false });
    renderAt(null, ['GOVERNMENT_ADMIN']);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });

  it('renders children when the role matches', () => {
    useAuth.mockReturnValue({ isAuthenticated: () => true, hasRole: () => true, loading: false });
    renderAt(null, ['GOVERNMENT_ADMIN']);
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });

  it('renders children when no roles are required', () => {
    useAuth.mockReturnValue({ isAuthenticated: () => true, hasRole: () => false, loading: false });
    renderAt(null, []);
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
