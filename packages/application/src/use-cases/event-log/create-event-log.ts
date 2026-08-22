import { EventLog, ok, err, type Result } from '@restaurant-os/domain';
import type { EventLogRepository } from '../../ports/event-log-repository';

export interface CreateEventLogInput {
  id: string;
  eventType: string;
  restaurantId: string;
  aggregateType: string;
  aggregateId: string;
  actorType?: string | null;
  actorId?: string | null;
  payload?: Record<string, unknown>;
  timestamp?: Date;
}

export class CreateEventLogUseCase {
  constructor(private readonly eventLogRepo: EventLogRepository) {}

  async execute(input: CreateEventLogInput): Promise<Result<EventLog, Error>> {
    const eventResult = EventLog.create({
      id: input.id,
      eventType: input.eventType,
      restaurantId: input.restaurantId,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      actorType: input.actorType,
      actorId: input.actorId,
      payload: input.payload,
      timestamp: input.timestamp,
    });

    if (!eventResult.success) {
      return err(eventResult.error);
    }

    await this.eventLogRepo.save(eventResult.value);
    return ok(eventResult.value);
  }
}
