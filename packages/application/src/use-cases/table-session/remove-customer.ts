import {
  type TableSession,
  type TableSessionId,
  EventType,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface RemoveCustomerFromSessionInput {
  sessionId: TableSessionId;
  customerId: string;
}

export class RemoveCustomerFromSessionUseCase {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: RemoveCustomerFromSessionInput): Promise<TableSession> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      throw new Error(`TableSession not found: ${input.sessionId}`);
    }

    const removeResult = session.removeCustomer(input.customerId);
    if (!removeResult.success) {
      throw removeResult.error;
    }

    const updatedSession = removeResult.value;
    await this.sessionRepo.save(updatedSession);

    await this.eventPublisher.publish(EventType.CUSTOMER_REMOVED_FROM_TABLE, {
      tableSessionId: updatedSession.id,
      restaurantId: updatedSession.restaurantId,
      customerId: input.customerId,
      aggregateType: 'TableSession',
      aggregateId: updatedSession.id,
    });

    return updatedSession;
  }
}
