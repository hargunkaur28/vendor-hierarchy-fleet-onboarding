import type { AuditEntry } from '@/types';
import { simulateNetwork } from './client';

export interface ListAuditLogsParams {
  limit?: number;
  cursor?: string;
  entityId?: string;
  action?: string;
}

export interface PaginatedAuditLogs {
  items: AuditEntry[];
  nextCursor?: string;
  hasMore: boolean;
}

export const auditApi = {
  async listAuditLogs({
    limit = 50,
    cursor,
    entityId,
    action,
  }: ListAuditLogsParams = {}): Promise<PaginatedAuditLogs> {
    return simulateNetwork((db) => {
      let logs = [...db.auditLogs];

      if (entityId) {
        logs = logs.filter((log) => log.targetId === entityId);
      }
      if (action) {
        logs = logs.filter((log) => log.action === action);
      }

      let startIndex = 0;
      if (cursor) {
        const found = logs.findIndex((log) => log.id === cursor);
        if (found >= 0) {
          startIndex = found + 1;
        }
      }

      const items = logs.slice(startIndex, startIndex + limit);
      const nextIndex = startIndex + limit;
      const hasMore = nextIndex < logs.length;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      return {
        items,
        nextCursor,
        hasMore,
      };
    });
  },
};
