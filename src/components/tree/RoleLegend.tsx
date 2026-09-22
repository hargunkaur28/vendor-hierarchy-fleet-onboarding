import React from 'react';
import { ROLE_KEYS, ROLE_CONFIG } from '@/config/roles';

export const RoleLegend: React.FC = () => {
  return (
    <div
      className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 select-none"
      role="region"
      aria-label="Role color legend"
    >
      {ROLE_KEYS.map((roleKey) => {
        const config = ROLE_CONFIG[roleKey];
        return (
          <div key={roleKey} className="inline-flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: config.colorHex }}
              aria-hidden="true"
            />
            <span className="font-medium text-slate-700">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
};
