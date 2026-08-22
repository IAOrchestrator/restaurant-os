import type { TableDeviceRepository } from '@restaurant-os/application';
import type { TableDevice } from '@restaurant-os/domain';
import { prisma } from './prisma-client';
import { TableDeviceMapper } from './mappers/table-device-mapper';

export class PrismaTableDeviceRepository implements TableDeviceRepository {
  async findById(id: string): Promise<TableDevice | null> {
    const raw = await prisma.tableDevice.findUnique({
      where: { id },
    });
    return raw ? TableDeviceMapper.toDomain(raw) : null;
  }

  async findByTableId(tableId: string): Promise<TableDevice | null> {
    const raw = await prisma.tableDevice.findUnique({
      where: { tableId },
    });
    return raw ? TableDeviceMapper.toDomain(raw) : null;
  }

  async findByRestaurantId(restaurantId: string): Promise<TableDevice[]> {
    const rows = await prisma.tableDevice.findMany({
      where: { restaurantId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => TableDeviceMapper.toDomain(r));
  }

  async save(device: TableDevice): Promise<void> {
    const data = TableDeviceMapper.toPersistence(device);
    await prisma.tableDevice.upsert({
      where: { id: device.id },
      create: data,
      update: data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.tableDevice.delete({
      where: { id },
    });
  }
}
