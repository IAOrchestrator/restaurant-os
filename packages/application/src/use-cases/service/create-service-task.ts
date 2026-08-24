import {
  ServiceTask,
  EventType,
  ActorType,
  createDomainEvent,
  ok,
  err,
  type Result,
} from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '../../ports/service-task-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface CreateServiceTaskInput {
  id: string;
  restaurantId: string;
  tableSessionId?: string | null;
  type: string;
  notes?: string | null;
  actorType?: ActorType;
  actorId?: string | null;
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

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.SERVICE_TASK_CREATED,
        restaurantId: result.value.restaurantId,
        aggregateType: 'ServiceTask',
        aggregateId: result.value.id,
        tableSessionId: result.value.tableSessionId,
        actorType: input.actorType ?? ActorType.CUSTOMER,
        actorId: input.actorId ?? null,
        payload: {
          serviceTaskId: result.value.id,
          restaurantId: result.value.restaurantId,
          tableSessionId: result.value.tableSessionId,
          type: result.value.type,
          notes: result.value.notes,
        },
      }),
    );

    return ok(result.value);
  }
}
