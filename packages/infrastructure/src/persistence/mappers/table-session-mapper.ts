import {
  TableSession,
  TableSessionStatus,
  type WaiterAssignment,
  type TableAssignment,
} from '@restaurant-os/domain';
import type { TableSession as PrismaTableSession } from '@restaurant-os/database';

export class TableSessionMapper {
  static toDomain(prismaSession: PrismaTableSession): TableSession | null {
    const waiterAssignments: WaiterAssignment[] = [];
    if (prismaSession.waiterAssignments) {
      try {
        const parsed = JSON.parse(prismaSession.waiterAssignments);
        if (Array.isArray(parsed)) {
          waiterAssignments.push(...parsed.map((a: any) => ({
            ...a,
            assignedAt: new Date(a.assignedAt),
            replacedAt: a.replacedAt ? new Date(a.replacedAt) : undefined,
          })));
        }
      } catch {
        // ignore parse errors
      }
    }

    const tableAssignments: TableAssignment[] = [];
    if (prismaSession.tableHistory) {
      try {
        const parsed = JSON.parse(prismaSession.tableHistory);
        if (Array.isArray(parsed)) {
          tableAssignments.push(...parsed.map((a: any) => ({
            ...a,
            assignedAt: new Date(a.assignedAt),
            releasedAt: a.releasedAt ? new Date(a.releasedAt) : undefined,
          })));
        }
      } catch {
        // ignore parse errors
      }
    }

    const customerIds: string[] = [];
    if (prismaSession.customerIds) {
      try {
        const parsed = JSON.parse(prismaSession.customerIds);
        if (Array.isArray(parsed)) {
          customerIds.push(...parsed);
        }
      } catch {
        // ignore parse errors
      }
    }

    const result = TableSession.create({
      id: prismaSession.id,
      restaurantId: prismaSession.restaurantId,
      tableId: prismaSession.tableId,
      initialWaiterId: waiterAssignments[0]?.waiterId ?? '',
      customerIds,
      tableAssignments: tableAssignments.length > 0 ? tableAssignments : undefined,
      waiterAssignments: waiterAssignments.length > 0 ? waiterAssignments : undefined,
      status: prismaSession.status as TableSessionStatus,
      openedAt: prismaSession.openedAt,
      closedAt: prismaSession.closedAt,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(session: TableSession): Omit<PrismaTableSession, 'table' | 'restaurant' | 'orders' | 'accounts'> {
    return {
      id: session.id,
      restaurantId: session.restaurantId,
      tableId: session.tableId,
      status: session.status,
      customerIds: JSON.stringify(session.customerIds),
      tableHistory: JSON.stringify(session.tableHistory),
      waiterAssignments: JSON.stringify(session.waiterAssignments),
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
