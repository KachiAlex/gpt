import { Search, ChevronDown, Sun, Moon, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import NotificationCenter from '../Notifications/NotificationCenter';

const roleLabels = {
  GOVERNMENT_ADMIN: 'Government Admin',
  GOVERNMENT_OFFICER: 'Government Officer',
  CONTRACTOR: 'Contractor',
  ME_OFFICER: 'M&E Officer',
};

export default function Header({ onSearch }) {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [query, setQuery] = useState('');

  const submitSearch = (e) => {
    e.preventDefault();
    const term = query.trim();
    if (term) navigate(`/projects?search=${encodeURIComponent(term)}`);
  };

  const handleSignOut = () => {
    localStorage.clear();
    signOut();
    navigate('/');
  };

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';

  return (
    <header className="flex flex-wrap items-center justify-between gap-3.5 px-6 lg:px-8 py-3.5 border-b border-border bg-surface sticky top-0 z-30">
      {/* Search */}
      <form onSubmit={submitSearch} className="flex-1 min-w-[200px] max-w-[440px] relative">
        <label htmlFor="hdr-search" className="sr-only">Search</label>
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted pointer-events-none" />
        <input
          id="hdr-search"
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); onSearch?.(e.target.value); }}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder="Search projects, contractors, reports"
          className="w-full h-[46px] border-[1.5px] border-border rounded-xl bg-bg text-ink pl-[42px] pr-3.5 text-[15px] placeholder-muted"
        />
      </form>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-11 h-11 border border-border rounded-xl bg-transparent text-ink flex items-center justify-center hover:bg-hoverbg transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" strokeWidth={1.75} /> : <Moon className="w-5 h-5" strokeWidth={1.75} />}
        </button>

        <NotificationCenter />

        {/* User menu */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-hoverbg transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-semibold overflow-hidden">
              {user?.profileImage
                ? <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                : initials}
            </span>
            <span className="hidden md:block text-left">
              <span className="block text-sm font-medium text-ink">{displayName}</span>
              <span className="block text-xs text-muted">{roleLabels[user?.role] || 'Role'}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
              <div className="absolute right-0 mt-2 w-52 bg-surface rounded-xl shadow-xl border border-border z-50 overflow-hidden">
                <div className="p-4 border-b border-border">
                  <p className="text-sm font-medium text-ink">{displayName}</p>
                  <p className="text-xs text-muted">{roleLabels[user?.role] || 'Role'}</p>
                </div>
                <div className="py-1.5">
                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center px-4 py-2.5 min-h-[44px] text-sm text-ink hover:bg-hoverbg"
                  >
                    <User className="h-4 w-4 mr-3 text-muted" />
                    Profile settings
                  </button>
                  <div className="border-t border-border my-1.5" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center px-4 py-2.5 min-h-[44px] text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <LogOut className="h-4 w-4 mr-3" />
                    Sign out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
