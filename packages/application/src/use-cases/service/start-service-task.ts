import { ServiceTask, ok, err, type Result } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface StartServiceTaskInput {
  serviceTaskId: string;
}

export class StartServiceTaskUseCase {
  constructor(
    private readonly serviceTaskRepo: ServiceTaskRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: StartServiceTaskInput): Promise<Result<ServiceTask, Error>> {
    const task = await this.serviceTaskRepo.findById(input.serviceTaskId);
    if (!task) {
      return err(new Error('Service task not found'));
    }

    const started = task.start();
    if (!started.success) {
      return err(started.error);
    }

    await this.serviceTaskRepo.save(started.value);
    await this.eventPublisher.publish('SERVICE_TASK_STARTED', {
      serviceTaskId: started.value.id,
      assignedTo: started.value.assignedTo,
      restaurantId: started.value.restaurantId,
    });

    return ok(started.value);
  }
}
