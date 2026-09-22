import React from 'react';
import {
  LayoutDashboard,
  Car,
  UserCheck,
  FileCheck,
  ShieldCheck,
  History,
} from 'lucide-react';

interface PlaceholderProps {
  title: string;
  description: string;
  icon: React.ElementType;
}

const PagePlaceholder: React.FC<PlaceholderProps> = ({ title, description, icon: Icon }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-3">
      <Icon className="w-7 h-7" />
    </div>
    <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
    <p className="text-sm text-slate-500 max-w-md mt-1 mb-4">{description}</p>
    <span className="px-3 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full">
      Module scheduled for subsequent phase
    </span>
  </div>
);

export const DashboardPage: React.FC = () => (
  <PagePlaceholder
    title="Super Vendor Dashboard (F8)"
    description="Fleet overview, pending verifications, driver availability, and risk metrics."
    icon={LayoutDashboard}
  />
);

export const VehiclesPage: React.FC = () => (
  <PagePlaceholder
    title="Fleet & Vehicles (F6)"
    description="Manage cab fleet onboarding, compliance verification, and driver assignment."
    icon={Car}
  />
);

export const DriversPage: React.FC = () => (
  <PagePlaceholder
    title="Driver Management (F6)"
    description="Driver roster, license verification, compliance status, and vehicle pairing."
    icon={UserCheck}
  />
);

export const DocumentsPage: React.FC = () => (
  <PagePlaceholder
    title="Document Verification Queue (F7)"
    description="Review pending compliance documents: DL, RC, Permit, PUC, and Insurance."
    icon={FileCheck}
  />
);

export const DelegationPage: React.FC = () => (
  <PagePlaceholder
    title="Delegation & Permissions (F4, F5)"
    description="Grant and restrict administrative permissions across your vendor subtree."
    icon={ShieldCheck}
  />
);

export const AuditPage: React.FC = () => (
  <PagePlaceholder
    title="Audit Log (F10)"
    description="Chronological record of moves, role changes, and compliance updates."
    icon={History}
  />
);
