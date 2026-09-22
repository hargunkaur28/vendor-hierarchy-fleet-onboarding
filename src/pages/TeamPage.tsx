import React from 'react';
import { TreeToolbar } from '@/components/tree/TreeToolbar';
import { HierarchyTree } from '@/components/tree/HierarchyTree';
import type { Vendor } from '@/types';
import { toast } from 'sonner';

export const TeamPage: React.FC = () => {
  const handleMoveProfile = (vendor: Vendor) => {
    toast.info(`Move profile for "${vendor.name}" (Phase 4 Move Modal)`);
  };

  const handleEditVendor = (vendor: Vendor) => {
    toast.info(`Edit profile for "${vendor.name}"`);
  };

  return (
    <div className="w-full h-full flex flex-col">
      <TreeToolbar />
      <div className="flex-1 overflow-auto">
        <HierarchyTree
          onMoveProfile={handleMoveProfile}
          onEditVendor={handleEditVendor}
        />
      </div>
    </div>
  );
};
