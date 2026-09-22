import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Car,
  UserCheck,
  FileCheck,
  ShieldCheck,
  History,
  LogOut,
  CarTaxiFront,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { selectCurrentUser } from '@/store/selectors';
import { ROLE_CONFIG } from '@/config/roles';
import { Avatar } from '@/components/common/Avatar';

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const currentUser = selectCurrentUser(useAppStore.getState());
  const currentRole = currentUser?.role ?? 'ADMIN';
  const roleConfig = ROLE_CONFIG[currentRole];
  const switchUser = useAppStore((s) => s.switchUser);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/team', label: 'My Team', icon: Users },
    { to: '/vehicles', label: 'Vehicles', icon: Car },
    { to: '/drivers', label: 'Drivers', icon: UserCheck },
    { to: '/documents', label: 'Documents', icon: FileCheck },
    { to: '/delegation', label: 'Delegation', icon: ShieldCheck },
    { to: '/audit', label: 'Audit Log', icon: History },
  ];

  const handleSignOut = () => {
    // Reset to default admin perspective
    switchUser('admin');
  };

  return (
    <aside className="w-[260px] h-screen bg-white border-r border-slate-200 flex flex-col shrink-0 select-none">
      {/* Top Branding */}
      <div className="h-14 px-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
          <CarTaxiFront className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-tight">
            FleetLink
          </h2>
          <p className="text-[10px] text-slate-400 font-medium">Vendor Hierarchy</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Block: Static Current User Identity Display (Per Section 4A.5) */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {currentUser && (
              <Avatar name={currentUser.name} role={currentUser.role} size="sm" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate leading-tight">
                {currentUser?.name ?? 'Admin'}
              </p>
              <p className="text-[10px] font-medium text-slate-500 truncate leading-tight">
                {roleConfig?.label ?? currentRole}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            title="Reset perspective to Root Admin"
            aria-label="Sign out / reset user perspective"
            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
