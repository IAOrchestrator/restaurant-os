import { ServiceTask, ok, err, type Result } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CreateServiceTaskInput {
  id: string;
  restaurantId: string;
  tableSessionId?: string | null;
  type: string;
  notes?: string | null;
}

export class CreateServiceTaskUseCase {
  constructor(
    private readonly serviceTaskRepo: ServiceTaskRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CreateServiceTaskInput): Promise<Result<ServiceTask, Error>> {
    const result = ServiceTask.create({
      id: input.id,
      restaurantId: input.restaurantId,
      tableSessionId: input.tableSessionId,
      type: input.type,
      notes: input.notes,
    });

    if (!result.success) {
      return err(result.error);
    }

    await this.serviceTaskRepo.save(result.value);
    await this.eventPublisher.publish('SERVICE_TASK_CREATED', {
      serviceTaskId: result.value.id,
      restaurantId: result.value.restaurantId,
      tableSessionId: result.value.tableSessionId,
      type: result.value.type,
    });

    return ok(result.value);
  }
}
