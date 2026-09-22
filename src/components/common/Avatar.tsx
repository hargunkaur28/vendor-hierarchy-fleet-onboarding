import React from 'react';
import type { RoleKey } from '@/types';
import { ROLE_CONFIG } from '@/config/roles';

interface AvatarProps {
  name: string;
  role: RoleKey;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  role,
  size = 'md',
  className = '',
}) => {
  const roleConfig = ROLE_CONFIG[role];
  const roleColor = roleConfig?.colorHex ?? '#4f46e5';

  // Get initials (up to 2 letters)
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || name.slice(0, 2).toUpperCase();

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-xs font-semibold',
    lg: 'w-11 h-11 text-sm font-bold',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full text-white select-none shrink-0 ${sizeClasses} ${className}`}
      style={{ backgroundColor: roleColor }}
      aria-label={`${name} (${roleConfig?.label ?? role})`}
    >
      {initials}
    </div>
  );
};
