import { EventLog } from '@restaurant-os/domain';
import type { EventLog as PrismaEventLog } from '@restaurant-os/database';

export class EventLogMapper {
  static toDomain(prismaEventLog: PrismaEventLog): EventLog | null {
    const result = EventLog.create({
      id: prismaEventLog.id,
      eventType: prismaEventLog.eventType,
      restaurantId: prismaEventLog.restaurantId,
      aggregateType: prismaEventLog.aggregateType,
      aggregateId: prismaEventLog.aggregateId,
      tableSessionId: prismaEventLog.tableSessionId,
      actorType: prismaEventLog.actorType,
      actorId: prismaEventLog.actorId,
      payload: prismaEventLog.payload as Record<string, unknown>,
      timestamp: prismaEventLog.timestamp,
      createdAt: (prismaEventLog as any).createdAt ?? prismaEventLog.timestamp,
    });

    return result.success ? result.value : null;
  }

  static toPrisma(eventLog: EventLog): Omit<PrismaEventLog, 'restaurant'> {
    return {
      id: eventLog.id,
      eventType: eventLog.eventType,
      restaurantId: eventLog.restaurantId,
      aggregateType: eventLog.aggregateType,
      aggregateId: eventLog.aggregateId,
      tableSessionId: eventLog.tableSessionId,
      timestamp: eventLog.timestamp,
      actorType: eventLog.actorType,
      actorId: eventLog.actorId,
      payload: eventLog.payload as any,
    };
  }
}
