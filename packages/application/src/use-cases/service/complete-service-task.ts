import { ServiceTask, ok, err, type Result } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CompleteServiceTaskInput {
  serviceTaskId: string;
}

export class CompleteServiceTaskUseCase {
  constructor(
    private readonly serviceTaskRepo: ServiceTaskRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CompleteServiceTaskInput): Promise<Result<ServiceTask, Error>> {
    const task = await this.serviceTaskRepo.findById(input.serviceTaskId);
    if (!task) {
      return err(new Error('Service task not found'));
    }

    const completed = task.complete();
    if (!completed.success) {
      return err(completed.error);
    }

    await this.serviceTaskRepo.save(completed.value);
    await this.eventPublisher.publish('SERVICE_TASK_COMPLETED', {
      serviceTaskId: completed.value.id,
      assignedTo: completed.value.assignedTo,
      restaurantId: completed.value.restaurantId,
      responseTimeMs: completed.value.responseTimeMs,
      completionTimeMs: completed.value.completionTimeMs,
    });

    return ok(completed.value);
  }
}
