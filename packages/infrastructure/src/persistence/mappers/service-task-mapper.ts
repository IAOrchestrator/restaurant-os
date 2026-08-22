import { ServiceTask, ServiceTaskStatus } from '@restaurant-os/domain';
import type { ServiceTask as PrismaServiceTask } from '@restaurant-os/database';

export class ServiceTaskMapper {
  static toDomain(prismaTask: PrismaServiceTask): ServiceTask | null {
    const result = ServiceTask.create({
      id: prismaTask.id,
      restaurantId: prismaTask.restaurantId,
      tableSessionId: prismaTask.tableSessionId,
      type: prismaTask.type,
      notes: prismaTask.notes,
      createdAt: prismaTask.createdAt,
    });

    if (!result.success) return null;
    let task = result.value;

    // Replay state transitions
    const targetStatus = prismaTask.status as ServiceTaskStatus;
    const transitions: Record<ServiceTaskStatus, () => void> = {
      [ServiceTaskStatus.PENDING]: () => {},
      [ServiceTaskStatus.ASSIGNED]: () => {
        if (prismaTask.assignedTo) {
          const r = task.assign(prismaTask.assignedTo);
          if (r.success) task = r.value;
        }
      },
      [ServiceTaskStatus.IN_PROGRESS]: () => {
        if (prismaTask.assignedTo) {
          let r = task.assign(prismaTask.assignedTo);
          if (r.success) task = r.value;
        }
        const r = task.start();
        if (r.success) task = r.value;
      },
      [ServiceTaskStatus.COMPLETED]: () => {
        if (prismaTask.assignedTo) {
          let r = task.assign(prismaTask.assignedTo);
          if (r.success) task = r.value;
        }
        let r = task.start();
        if (r.success) task = r.value;
        r = task.complete();
        if (r.success) task = r.value;
      },
      [ServiceTaskStatus.CANCELLED]: () => {
        const r = task.cancel();
        if (r.success) task = r.value;
      },
    };

    transitions[targetStatus]();
    return task;
  }

  static toPrisma(task: ServiceTask): Omit<PrismaServiceTask, 'restaurant'> {
    return {
      id: task.id,
      restaurantId: task.restaurantId,
      tableSessionId: task.tableSessionId,
      type: task.type,
      status: task.status,
      assignedTo: task.assignedTo,
      notes: task.notes,
      createdAt: task.createdAt,
      assignedAt: task.assignedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      updatedAt: task.updatedAt,
    };
  }
}
