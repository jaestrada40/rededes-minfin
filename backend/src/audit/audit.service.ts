import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  userEmail: string;
  userRole: string;
  action: string;
  module: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  result: 'Exitoso' | 'Advertencia' | 'Fallido';
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId: entry.userId,
        userEmail: entry.userEmail,
        userRole: entry.userRole,
        action: entry.action,
        module: entry.module,
        entity: entry.entity,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress,
        result: entry.result,
        details: entry.details as any,
      },
    });
  }

  findAll() {
    return this.prisma.auditLog.findMany({ orderBy: { timestamp: 'desc' } });
  }
}
