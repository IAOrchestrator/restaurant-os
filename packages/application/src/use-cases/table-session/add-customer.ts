import {
  type TableSession,
  type TableSessionId,
  EventType,
  ActorType,
  createDomainEvent,
} from '@restaurant-os/domain';
import type { TableSessionRepository } from '../../ports/table-session-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AddCustomerToSessionInput {
  sessionId: TableSessionId;
  customerId: string;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.CUSTOMER_ADDED_TO_TABLE,
        restaurantId: updatedSession.restaurantId,
        aggregateType: 'TableSession',
        aggregateId: updatedSession.id,
        tableSessionId: updatedSession.id,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? input.customerId,
        payload: {
          tableSessionId: updatedSession.id,
          restaurantId: updatedSession.restaurantId,
          customerId: input.customerId,
        },
      }),
    );

    return updatedSession;
  }
}
