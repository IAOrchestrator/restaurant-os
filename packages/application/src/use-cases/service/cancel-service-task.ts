import { ServiceTask, ok, err, type Result } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CancelServiceTaskInput {
  serviceTaskId: string;
}

export class CancelServiceTaskUseCase {
  constructor(
    private readonly serviceTaskRepo: ServiceTaskRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: CancelServiceTaskInput): Promise<Result<ServiceTask, Error>> {
    const task = await this.serviceTaskRepo.findById(input.serviceTaskId);
    if (!task) {
      return err(new Error('Service task not found'));
    }

    const cancelled = task.cancel();
    if (!cancelled.success) {
      return err(cancelled.error);
    }

    await this.serviceTaskRepo.save(cancelled.value);
    await this.eventPublisher.publish('SERVICE_TASK_CANCELLED', {
      serviceTaskId: cancelled.value.id,
      restaurantId: cancelled.value.restaurantId,
    });

    return ok(cancelled.value);
  }
}
