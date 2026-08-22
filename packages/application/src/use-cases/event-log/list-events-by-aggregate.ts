import type { EventLog } from '@restaurant-os/domain';
import type { EventLogRepository } from '../../ports/event-log-repository';

export class ListEventsByAggregateUseCase {
  constructor(private readonly eventLogRepo: EventLogRepository) {}

  async execute(aggregateId: string): Promise<EventLog[]> {
    return this.eventLogRepo.findByAggregateId(aggregateId);
  }
}
