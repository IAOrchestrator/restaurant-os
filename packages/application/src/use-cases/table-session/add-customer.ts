import {
  type TableSession,
  type TableSessionId,
  EventType,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AddCustomerToSessionInput {
  sessionId: TableSessionId;
  customerId: string;
}

export class AddCustomerToSessionUseCase {
  constructor(
    private readonly sessionRepo: TableSessionRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AddCustomerToSessionInput): Promise<TableSession> {
    const session = await this.sessionRepo.findById(input.sessionId);
    if (!session) {
      throw new Error(`TableSession not found: ${input.sessionId}`);
    }

    const addResult = session.addCustomer(input.customerId);
    if (!addResult.success) {
      throw addResult.error;
    }

    const updatedSession = addResult.value;
    await this.sessionRepo.save(updatedSession);

    await this.eventPublisher.publish(EventType.CUSTOMER_ADDED_TO_TABLE, {
      tableSessionId: updatedSession.id,
      restaurantId: updatedSession.restaurantId,
      customerId: input.customerId,
      aggregateType: 'TableSession',
      aggregateId: updatedSession.id,
    });

    return updatedSession;
  }
}
