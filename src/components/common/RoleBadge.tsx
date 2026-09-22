import React from 'react';
import type { RoleKey } from '@/types';
import { ROLE_CONFIG } from '@/config/roles';

interface RoleBadgeProps {
  role: RoleKey;
  className?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = '' }) => {
  const config = ROLE_CONFIG[role];
  if (!config) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 ${className}`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: config.colorHex }}
        aria-hidden="true"
      />
      {config.label}
    </span>
  );
};
