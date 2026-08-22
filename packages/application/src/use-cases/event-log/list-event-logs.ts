import type { EventLog } from '@restaurant-os/domain';
import type { EventLogRepository } from '../../ports/event-log-repository';

export interface ListEventLogsInput {
  restaurantId: string;
  limit?: number;
}

export class ListEventLogsUseCase {
  constructor(private readonly eventLogRepo: EventLogRepository) {}

  async execute(input: ListEventLogsInput): Promise<EventLog[]> {
    return this.eventLogRepo.findByRestaurantId(input.restaurantId, input.limit ?? 100);
  }
}
