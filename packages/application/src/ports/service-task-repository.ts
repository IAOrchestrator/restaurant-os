import type { ServiceTask, ServiceTaskId } from '@restaurant-os/domain';

export interface ServiceTaskRepository {
  findById(id: ServiceTaskId): Promise<ServiceTask | null>;
  findByRestaurantId(restaurantId: string, status?: string): Promise<ServiceTask[]>;
  findByAssignedTo(staffId: string): Promise<ServiceTask[]>;
  findByTableSessionId(tableSessionId: string): Promise<ServiceTask[]>;
  save(task: ServiceTask): Promise<void>;
  delete(id: ServiceTaskId): Promise<void>;
}
