import React, { useState, useEffect } from 'react';
import { TreeToolbar } from '@/components/tree/TreeToolbar';
import { HierarchyTree } from '@/components/tree/HierarchyTree';
import { MoveProfileModal } from '@/components/tree/MoveProfileModal';
import type { Vendor } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { ROLE_CONFIG } from '@/config/roles';
import { toast } from 'sonner';

export const TeamPage: React.FC = () => {
  const [movingVendor, setMovingVendor] = useState<Vendor | null>(null);
  const [pulsingVendorId, setPulsingVendorId] = useState<string | null>(null);
  const selectedVendorId = useAppStore((s) => s.selectedVendorId);
  const vendorsById = useAppStore((s) => s.vendorsById);

  const handleMoveProfile = (vendor: Vendor) => {
    setMovingVendor(vendor);
  };

  const handleMoveSuccess = (vendorId: string) => {
    setPulsingVendorId(vendorId);
    setTimeout(() => {
      setPulsingVendorId(null);
    }, 2000);
  };

  // Global m / M shortcut listener on TeamPage
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl?.tagName === 'INPUT' ||
        activeEl?.tagName === 'TEXTAREA' ||
        activeEl?.closest('[role="dialog"]')
      ) {
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        if (selectedVendorId && vendorsById[selectedVendorId]) {
          const vendor = vendorsById[selectedVendorId];
          const roleConfig = ROLE_CONFIG[vendor.role];
          if (roleConfig?.movable) {
            e.preventDefault();
            setMovingVendor(vendor);
          } else {
            toast.info(`${vendor.name} (${roleConfig?.label ?? vendor.role}) cannot be moved.`);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedVendorId, vendorsById]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <TreeToolbar />
      <div className="flex-1 min-h-0 overflow-hidden">
        <HierarchyTree
          onMoveProfile={handleMoveProfile}
          pulsingVendorId={pulsingVendorId}
        />
      </div>

      <MoveProfileModal
        vendor={movingVendor}
        isOpen={movingVendor !== null}
        onClose={() => setMovingVendor(null)}
        onMoveSuccess={handleMoveSuccess}
      />
    </div>
  );
};
