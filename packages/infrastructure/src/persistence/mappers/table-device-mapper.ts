import { TableDevice } from '@restaurant-os/domain';
import type { TableDevice as PrismaTableDevice } from '@restaurant-os/database';

export class TableDeviceMapper {
  static toDomain(raw: PrismaTableDevice): TableDevice {
    const result = TableDevice.create({
      id: raw.id,
      restaurantId: raw.restaurantId,
      name: raw.name,
      tableId: raw.tableId ?? null,
      active: raw.active,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });

    if (!result.success) {
      throw result.error;
    }

    return result.value;
  }

  static toPersistence(device: TableDevice): {
    id: string;
    restaurantId: string;
    name: string;
    tableId: string | null;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: device.id,
      restaurantId: device.restaurantId,
      name: device.name,
      tableId: device.tableId,
      active: device.active,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
