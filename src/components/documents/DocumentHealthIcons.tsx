import React from 'react';
import type { DocumentRecord, DocType } from '@/types';
import { REQUIRED_VEHICLE_DOCS } from '@/config/constants';
import { getDocumentStatus } from '@/lib/compliance';

interface DocumentHealthIconsProps {
  documents: DocumentRecord[];
  requiredDocs?: DocType[];
  onUploadClick?: (type: DocType) => void;
  className?: string;
}

export const DocumentHealthIcons: React.FC<DocumentHealthIconsProps> = ({
  documents,
  requiredDocs = REQUIRED_VEHICLE_DOCS,
  onUploadClick,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {requiredDocs.map((type) => {
        const doc = documents.find((d) => d.type === type);
        const status = doc ? getDocumentStatus(doc) : 'MISSING';

        let badgeBg = 'bg-slate-100 text-slate-500 border-slate-200';
        let dotBg = 'bg-slate-400';
        let tooltipText = `${type}: Missing document`;

        if (status === 'APPROVED') {
          badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
          dotBg = 'bg-emerald-500';
          tooltipText = `${type}: Approved (Exp: ${doc?.expiryDate ? doc.expiryDate.slice(0, 10) : 'N/A'})`;
        } else if (status === 'EXPIRING_SOON') {
          badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
          dotBg = 'bg-amber-500 animate-pulse';
          tooltipText = `${type}: Expiring Soon (${doc?.expiryDate.slice(0, 10)})`;
        } else if (status === 'PENDING') {
          badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
          dotBg = 'bg-amber-400';
          tooltipText = `${type}: Pending Verification`;
        } else if (status === 'EXPIRED') {
          badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
          dotBg = 'bg-rose-500';
          tooltipText = `${type}: Expired on ${doc?.expiryDate.slice(0, 10)}`;
        } else if (status === 'REJECTED') {
          badgeBg = 'bg-rose-50 text-rose-800 border-rose-200';
          dotBg = 'bg-rose-500';
          tooltipText = `${type}: Rejected (${doc?.verification.rejectionReason || 'No reason specified'})`;
        }

        if (onUploadClick) {
          return (
            <button
              key={type}
              type="button"
              onClick={() => onUploadClick(type)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors cursor-pointer select-none ${badgeBg} hover:brightness-95`}
              title={tooltipText}
              aria-label={tooltipText}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBg}`} />
              <span>{type}</span>
            </button>
          );
        }

        return (
          <span
            key={type}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border select-none ${badgeBg}`}
            title={tooltipText}
            aria-label={tooltipText}
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotBg}`} />
            <span>{type}</span>
          </span>
        );
      })}
    </div>
  );
};
