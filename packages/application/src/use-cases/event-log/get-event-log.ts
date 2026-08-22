import type { EventLog, EventLogId } from '@restaurant-os/domain';
import type { EventLogRepository } from '../../ports/event-log-repository';

export class GetEventLogUseCase {
  constructor(private readonly eventLogRepo: EventLogRepository) {}

  async execute(id: EventLogId): Promise<EventLog | null> {
    return this.eventLogRepo.findById(id);
  }
}
