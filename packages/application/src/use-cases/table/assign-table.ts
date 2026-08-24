import {
  Table,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AssignTableInput {
  tableId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class AssignTableUseCase {
  constructor(
    private readonly tableRepo: TableRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AssignTableInput): Promise<Result<Table, Error>> {
    const table = await this.tableRepo.findById(input.tableId);
    if (!table) {
      return err(new Error('Table not found'));
    }

    const assigned = table.assign();
    if (!assigned.success) {
      return err(assigned.error);
    }

    await this.tableRepo.save(assigned.value);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_ASSIGNED,
        restaurantId: assigned.value.restaurantId,
        aggregateType: 'Table',
        aggregateId: assigned.value.id,
        tableId: assigned.value.id,
        tableNumber: assigned.value.number,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          tableId: assigned.value.id,
          tableNumber: assigned.value.number,
          restaurantId: assigned.value.restaurantId,
          status: assigned.value.status,
        },
      }),
    );

    return ok(assigned.value);
  }
}
