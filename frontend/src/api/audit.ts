import { apiGet } from './client';

export interface BackendAuditLog {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  result: string;
  details?: Record<string, unknown>;
}

export function listAuditLogs(): Promise<BackendAuditLog[]> {
  return apiGet<BackendAuditLog[]>('/audit');
}
