import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileQuestion,
  ShieldAlert,
} from 'lucide-react';
import type { DocumentStatus } from '@/types';

interface DocumentStatusChipProps {
  status: DocumentStatus | 'OPERATIONAL' | 'COMPLIANT' | 'NON_COMPLIANT' | 'BLOCKED' | 'ACTIVE' | 'INACTIVE';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const DocumentStatusChip: React.FC<DocumentStatusChipProps> = ({
  status,
  size = 'md',
  className = '',
}) => {
  const getMeta = () => {
    switch (status) {
      case 'APPROVED':
      case 'COMPLIANT':
      case 'OPERATIONAL':
      case 'ACTIVE':
        return {
          label: status === 'APPROVED' ? 'Approved' : status === 'OPERATIONAL' ? 'Operational' : status === 'COMPLIANT' ? 'Compliant' : 'Active',
          icon: CheckCircle2,
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          iconColor: 'text-emerald-600',
        };

      case 'PENDING':
        return {
          label: 'Pending Review',
          icon: Clock,
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
          iconColor: 'text-amber-600',
        };

      case 'EXPIRING_SOON':
        return {
          label: 'Expiring Soon',
          icon: AlertTriangle,
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
          iconColor: 'text-amber-600',
        };

      case 'EXPIRED':
        return {
          label: 'Expired',
          icon: XCircle,
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
          iconColor: 'text-rose-600',
        };

      case 'REJECTED':
        return {
          label: 'Rejected',
          icon: XCircle,
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
          iconColor: 'text-rose-600',
        };

      case 'NON_COMPLIANT':
        return {
          label: 'Non-Compliant',
          icon: AlertCircleIcon,
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
          iconColor: 'text-rose-600',
        };

      case 'BLOCKED':
        return {
          label: 'Blocked',
          icon: ShieldAlert,
          classes: 'bg-red-50 text-red-800 border-red-200',
          iconColor: 'text-red-700',
        };

      case 'INACTIVE':
        return {
          label: 'Inactive',
          icon: Clock,
          classes: 'bg-slate-100 text-slate-600 border-slate-200',
          iconColor: 'text-slate-500',
        };

      case 'MISSING':
      default:
        return {
          label: 'Missing',
          icon: FileQuestion,
          classes: 'bg-slate-100 text-slate-500 border-slate-200',
          iconColor: 'text-slate-400',
        };
    }
  };

  const { label, icon: Icon, classes, iconColor } = getMeta();
  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-0.5 text-[9px]'
      : size === 'sm'
        ? 'px-2 py-0.5 text-[10px]'
        : 'px-2.5 py-1 text-xs';
  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <span
      className={`inline-flex items-center gap-1 font-semibold rounded-md border select-none ${classes} ${sizeClasses} ${className}`}
    >
      <Icon className={`${iconSize} shrink-0 ${iconColor}`} />
      <span>{label}</span>
    </span>
  );
};

const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);
