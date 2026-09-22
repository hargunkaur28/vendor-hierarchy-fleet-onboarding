import type { DocumentRecord, DocType } from '@/types';
import { simulateNetwork, recordAudit } from './client';
import { AppError } from './errors';
import { authorize } from '@/lib/permissions';

export interface UploadDocumentParams {
  entityType: 'VEHICLE' | 'DRIVER';
  entityId: string;
  type: DocType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiryDate: string;
  actorId: string;
}

export interface ReviewDocumentParams {
  entityType: 'VEHICLE' | 'DRIVER';
  entityId: string;
  docId: string;
  status: 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  actorId: string;
}

export const documentsApi = {
  async uploadDocument({
    entityType,
    entityId,
    type,
    fileName,
    fileSize,
    mimeType,
    expiryDate,
    actorId,
  }: UploadDocumentParams): Promise<DocumentRecord> {
    return simulateNetwork((db) => {
      const targetVendorId =
        entityType === 'VEHICLE'
          ? db.vehicles[entityId]?.ownerVendorId
          : db.drivers[entityId]?.ownerVendorId;

      if (!targetVendorId) {
        throw new AppError(entityType === 'VEHICLE' ? 'VEHICLE_NOT_FOUND' : 'DRIVER_NOT_FOUND');
      }

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'VERIFY_DOCUMENTS',
          targetVendorId,
        },
        db.vendors,
        delegations,
      );

      // Fallback check: if can onboard vehicle/driver, can upload doc
      if (!auth.allowed) {
        const onboardAuth = authorize(
          {
            actorId,
            permission: entityType === 'VEHICLE' ? 'ONBOARD_FLEET' : 'ONBOARD_DRIVERS',
            targetVendorId,
          },
          db.vendors,
          delegations,
        );
        if (!onboardAuth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);
      }

      const entity = entityType === 'VEHICLE' ? db.vehicles[entityId] : db.drivers[entityId];
      if (!entity) {
        throw new AppError(entityType === 'VEHICLE' ? 'VEHICLE_NOT_FOUND' : 'DRIVER_NOT_FOUND');
      }

      const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();

      const newDoc: DocumentRecord = {
        id: docId,
        type,
        fileName,
        fileSize,
        mimeType,
        expiryDate,
        uploadedAt: now,
        uploadedBy: actorId,
        verification: { status: 'PENDING' },
      };

      // Replace existing doc of same type if present, or append
      const existingIdx = entity.documents.findIndex((d) => d.type === type);
      if (existingIdx >= 0) {
        entity.documents[existingIdx] = newDoc;
      } else {
        entity.documents.push(newDoc);
      }
      entity.updatedAt = now;

      recordAudit(db, {
        actorId,
        action: 'UPLOAD_DOCUMENT',
        targetType: entityType === 'VEHICLE' ? 'VEHICLE' : 'DRIVER',
        targetId: entityId,
        details: { docType: type, fileName, expiryDate },
      });

      return newDoc;
    });
  },

  async reviewDocument({
    entityType,
    entityId,
    docId,
    status,
    rejectionReason,
    actorId,
  }: ReviewDocumentParams): Promise<DocumentRecord> {
    return simulateNetwork((db) => {
      const targetVendorId =
        entityType === 'VEHICLE'
          ? db.vehicles[entityId]?.ownerVendorId
          : db.drivers[entityId]?.ownerVendorId;

      if (!targetVendorId) {
        throw new AppError(entityType === 'VEHICLE' ? 'VEHICLE_NOT_FOUND' : 'DRIVER_NOT_FOUND');
      }

      const delegations = Object.values(db.delegations);
      const auth = authorize(
        {
          actorId,
          permission: 'VERIFY_DOCUMENTS',
          targetVendorId,
        },
        db.vendors,
        delegations,
      );
      if (!auth.allowed) throw new AppError('INSUFFICIENT_PERMISSIONS', auth.message);

      const entity = entityType === 'VEHICLE' ? db.vehicles[entityId] : db.drivers[entityId];
      if (!entity) {
        throw new AppError(entityType === 'VEHICLE' ? 'VEHICLE_NOT_FOUND' : 'DRIVER_NOT_FOUND');
      }

      const doc = entity.documents.find((d) => d.id === docId);
      if (!doc) throw new AppError('DOCUMENT_NOT_FOUND');

      const now = new Date().toISOString();
      doc.verification = {
        status,
        reviewedAt: now,
        reviewedBy: actorId,
        rejectionReason: status === 'REJECTED' ? rejectionReason ?? 'Document rejected' : undefined,
      };
      entity.updatedAt = now;

      recordAudit(db, {
        actorId,
        action: 'REVIEW_DOCUMENT',
        targetType: 'DOCUMENT',
        targetId: docId,
        details: { docId, docType: doc.type, status, rejectionReason },
      });

      return doc;
    });
  },
};
