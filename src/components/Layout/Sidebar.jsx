import { useState } from 'react';
import {
  LayoutDashboard,
  Folder,
  HardHat,
  ClipboardCheck,
  BarChart3,
  Map as MapIcon,
  Settings,
  Menu,
  X,
  FileText,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import clsx from 'clsx';

const roleLabels = {
  GOVERNMENT_ADMIN: 'Government Admin',
  GOVERNMENT_OFFICER: 'Government Officer',
  CONTRACTOR: 'Contractor',
  ME_OFFICER: 'Monitoring & Evaluation',
};

const navFor = (role) => {
  if (role === 'CONTRACTOR') {
    return [
      { name: 'Dashboard', href: '/contractor/dashboard', icon: LayoutDashboard },
      { name: 'Map view', href: '/map', icon: MapIcon },
      { name: 'Settings', href: '/settings', icon: Settings },
    ];
  }
  if (role === 'ME_OFFICER') {
    return [
      { name: 'Review queue', href: '/me/dashboard', icon: ClipboardCheck },
      { name: 'Projects', href: '/projects', icon: Folder },
      { name: 'Reports', href: '/reports', icon: FileText },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
      { name: 'Map view', href: '/map', icon: MapIcon },
      { name: 'Settings', href: '/settings', icon: Settings },
    ];
  }
  return [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: Folder },
    { name: 'Contractors', href: '/contractors', icon: HardHat },
    { name: 'M&E Reports', href: '/reports', icon: ClipboardCheck },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Map view', href: '/map', icon: MapIcon },
    { name: 'Progress', href: '/progress', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];
};

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const initials = `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase() || 'U';
  const displayName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User';
  const items = navFor(user?.role);
  const isActive = (href) => location.pathname === href || (href !== '/dashboard' && location.pathname.startsWith(href + '/'));

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 rounded-xl bg-surface border border-border flex items-center justify-center text-ink"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar */}
      <div className={clsx(
        'fixed inset-y-0 left-0 z-40 w-64 bg-side text-[#bae6fd] flex flex-col p-5 px-3.5 transform transition-transform duration-200 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <Link to="/" className="flex items-center px-2.5 py-1" onClick={() => setIsOpen(false)} aria-label="Government Project Tracker home">
          <span className="bg-white rounded-xl px-3 py-2 inline-flex items-center">
            <img src="/logo.png" alt="Government Project Tracker" className="h-9 w-auto" />
          </span>
        </Link>

        {/* User card */}
        {user && (
          <div className="mt-5 flex items-center gap-3 p-3 rounded-xl bg-white/[.07]">
            <span className="relative flex-none w-10 h-10 rounded-full bg-abia-500 text-abia-950 flex items-center justify-center font-bold text-sm overflow-hidden">
              {user.profileImage
                ? <img src={user.profileImage} alt="" className="w-full h-full object-cover" />
                : initials}
              <span className="absolute -right-px -bottom-px w-[11px] h-[11px] rounded-full bg-green-500 border-2 border-side" />
            </span>
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-white font-semibold text-[15px] truncate">{displayName}</span>
              <span className="text-[12.5px] text-abia-300">{roleLabels[user.role] || user.role}</span>
            </span>
          </div>
        )}

        {/* Nav */}
        <nav aria-label="Main" className="mt-5 flex flex-col gap-[3px] text-[15px] font-medium">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={clsx(
                  'min-h-[44px] flex items-center gap-3 px-3.5 rounded-[10px] transition-colors',
                  active ? 'bg-abia-600 text-white font-semibold' : 'hover:bg-white/[.08]'
                )}
              >
                <item.icon className="w-5 h-5 flex-none" strokeWidth={1.75} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5 px-2.5 text-[12.5px] text-abia-300">
          © 2026 Kreatix Technologies
        </div>
      </div>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
