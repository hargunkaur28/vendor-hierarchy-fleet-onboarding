import React, { useState } from 'react';
import { TreeToolbar } from '@/components/tree/TreeToolbar';
import { HierarchyTree } from '@/components/tree/HierarchyTree';
import { MoveProfileModal } from '@/components/tree/MoveProfileModal';
import type { Vendor } from '@/types';
import { toast } from 'sonner';

export const TeamPage: React.FC = () => {
  const [movingVendor, setMovingVendor] = useState<Vendor | null>(null);
  const [pulsingVendorId, setPulsingVendorId] = useState<string | null>(null);

  const handleMoveProfile = (vendor: Vendor) => {
    setMovingVendor(vendor);
  };

  const handleEditVendor = (vendor: Vendor) => {
    toast.info(`Edit profile for "${vendor.name}"`);
  };

  const handleMoveSuccess = (vendorId: string) => {
    setPulsingVendorId(vendorId);
    setTimeout(() => {
      setPulsingVendorId(null);
    }, 2000);
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <TreeToolbar />
      <div className="flex-1 min-h-0 overflow-hidden">
        <HierarchyTree
          onMoveProfile={handleMoveProfile}
          onEditVendor={handleEditVendor}
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
