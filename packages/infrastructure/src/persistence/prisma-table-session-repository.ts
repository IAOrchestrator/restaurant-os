import { TableSession, type TableSessionId } from '@restaurant-os/domain';
import type { TableSessionRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { TableSessionMapper } from './mappers/table-session-mapper';

export class PrismaTableSessionRepository implements TableSessionRepository {
  async findById(id: TableSessionId): Promise<TableSession | null> {
    const prismaSession = await prisma.tableSession.findUnique({
      where: { id },
    });
    if (!prismaSession) return null;
    return TableSessionMapper.toDomain(prismaSession);
  }

  async findActiveByTableId(tableId: string): Promise<TableSession | null> {
    const prismaSession = await prisma.tableSession.findFirst({
      where: {
        tableId,
        status: { not: 'CLOSED' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!prismaSession) return null;
    return TableSessionMapper.toDomain(prismaSession);
  }

  async findByRestaurantId(restaurantId: string): Promise<TableSession[]> {
    const prismaSessions = await prisma.tableSession.findMany({
      where: { restaurantId },
    });
    return prismaSessions
      .map((s) => TableSessionMapper.toDomain(s))
      .filter((s): s is TableSession => s !== null);
  }

  async save(session: TableSession): Promise<void> {
    const data = TableSessionMapper.toPrisma(session);
    await prisma.tableSession.upsert({
      where: { id: session.id },
      update: data as any,
      create: data as any,
    });
  }
}
