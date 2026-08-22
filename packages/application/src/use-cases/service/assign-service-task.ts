import { ServiceTask, ok, err, type Result } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AssignServiceTaskInput {
  serviceTaskId: string;
  staffId: string;
}

export class AssignServiceTaskUseCase {
  constructor(
    private readonly serviceTaskRepo: ServiceTaskRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AssignServiceTaskInput): Promise<Result<ServiceTask, Error>> {
    const task = await this.serviceTaskRepo.findById(input.serviceTaskId);
    if (!task) {
      return err(new Error('Service task not found'));
    }

    const assigned = task.assign(input.staffId);
    if (!assigned.success) {
      return err(assigned.error);
    }

    await this.serviceTaskRepo.save(assigned.value);
    await this.eventPublisher.publish('SERVICE_TASK_ASSIGNED', {
      serviceTaskId: assigned.value.id,
      assignedTo: input.staffId,
      restaurantId: assigned.value.restaurantId,
    });

    return ok(assigned.value);
  }
}
