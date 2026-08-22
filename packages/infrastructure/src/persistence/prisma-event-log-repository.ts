import { EventLog, type EventLogId } from '@restaurant-os/domain';
import type { EventLogRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { EventLogMapper } from './mappers/event-log-mapper';

export class PrismaEventLogRepository implements EventLogRepository {
  async findById(id: EventLogId): Promise<EventLog | null> {
    const prismaEventLog = await prisma.eventLog.findUnique({ where: { id } });
    if (!prismaEventLog) return null;
    return EventLogMapper.toDomain(prismaEventLog);
  }

  async findByRestaurantId(restaurantId: string, limit = 100): Promise<EventLog[]> {
    const prismaEventLogs = await prisma.eventLog.findMany({
      where: { restaurantId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return prismaEventLogs
      .map((e) => EventLogMapper.toDomain(e))
      .filter((e): e is EventLog => e !== null);
  }

  async findByAggregateId(aggregateId: string): Promise<EventLog[]> {
    const prismaEventLogs = await prisma.eventLog.findMany({
      where: { aggregateId },
      orderBy: { timestamp: 'asc' },
    });
    return prismaEventLogs
      .map((e) => EventLogMapper.toDomain(e))
      .filter((e): e is EventLog => e !== null);
  }

  async findByTableSessionId(tableSessionId: string): Promise<EventLog[]> {
    const prismaEventLogs = await prisma.eventLog.findMany({
      where: { tableSessionId },
      orderBy: { timestamp: 'asc' },
    });
    return prismaEventLogs
      .map((e) => EventLogMapper.toDomain(e))
      .filter((e): e is EventLog => e !== null);
  }

  async findByEventType(eventType: string, restaurantId: string, limit = 100): Promise<EventLog[]> {
    const prismaEventLogs = await prisma.eventLog.findMany({
      where: { eventType, restaurantId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
    return prismaEventLogs
      .map((e) => EventLogMapper.toDomain(e))
      .filter((e): e is EventLog => e !== null);
  }

  async save(eventLog: EventLog): Promise<void> {
    const data = EventLogMapper.toPrisma(eventLog);
    await prisma.eventLog.create({ data: data as any });
  }
}
