import { Table } from '@restaurant-os/domain';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';
import { ok, err, type Result } from '@restaurant-os/domain';

export interface AssignTableInput {
  tableId: string;
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
    await this.eventPublisher.publish('TABLE_ASSIGNED', {
      tableId: assigned.value.id,
      restaurantId: assigned.value.restaurantId,
      status: assigned.value.status,
    });

    return ok(assigned.value);
  }
}
