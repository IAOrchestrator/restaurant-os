import { ServiceTask, type ServiceTaskId } from '@restaurant-os/domain';
import type { ServiceTaskRepository } from '@restaurant-os/application';
import { prisma } from './prisma-client';
import { ServiceTaskMapper } from './mappers/service-task-mapper';

export class PrismaServiceTaskRepository implements ServiceTaskRepository {
  async findById(id: ServiceTaskId): Promise<ServiceTask | null> {
    const prismaTask = await prisma.serviceTask.findUnique({ where: { id } });
    if (!prismaTask) return null;
    return ServiceTaskMapper.toDomain(prismaTask);
  }

  async findByRestaurantId(restaurantId: string, status?: string): Promise<ServiceTask[]> {
    const where: Record<string, unknown> = { restaurantId };
    if (status) where.status = status;
    const prismaTasks = await prisma.serviceTask.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    return prismaTasks
      .map((t) => ServiceTaskMapper.toDomain(t))
      .filter((t): t is ServiceTask => t !== null);
  }

  async findByAssignedTo(staffId: string): Promise<ServiceTask[]> {
    const prismaTasks = await prisma.serviceTask.findMany({
      where: { assignedTo: staffId },
      orderBy: { createdAt: 'asc' },
    });
    return prismaTasks
      .map((t) => ServiceTaskMapper.toDomain(t))
      .filter((t): t is ServiceTask => t !== null);
  }

  async findByTableSessionId(tableSessionId: string): Promise<ServiceTask[]> {
    const prismaTasks = await prisma.serviceTask.findMany({
      where: { tableSessionId },
      orderBy: { createdAt: 'asc' },
    });
    return prismaTasks
      .map((t) => ServiceTaskMapper.toDomain(t))
      .filter((t): t is ServiceTask => t !== null);
  }

  async save(task: ServiceTask): Promise<void> {
    const data = ServiceTaskMapper.toPrisma(task);
    await prisma.serviceTask.upsert({
      where: { id: task.id },
      update: data as any,
      create: data as any,
    });
  }

  async delete(id: ServiceTaskId): Promise<void> {
    await prisma.serviceTask.delete({ where: { id } });
  }
}
