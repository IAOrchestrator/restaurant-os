import { TableDevice, EventType } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';
import type { TableRepository } from '../../ports/table-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface AssociateTableDeviceInput {
  deviceId: string;
  tableId: string;
}

export class AssociateTableDeviceUseCase {
  constructor(
    private readonly deviceRepo: TableDeviceRepository,
    private readonly tableRepo: TableRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: AssociateTableDeviceInput): Promise<TableDevice> {
    const device = await this.deviceRepo.findById(input.deviceId);
    if (!device) {
      throw new Error(`TableDevice not found: ${input.deviceId}`);
    }

    const table = await this.tableRepo.findById(input.tableId);
    if (!table) {
      throw new Error(`Table not found: ${input.tableId}`);
    }
    if (table.restaurantId !== device.restaurantId) {
      throw new Error('Table and TableDevice belong to different restaurants');
    }

    // Check if another device is currently associated to this table
    const existingForTable = await this.deviceRepo.findByTableId(input.tableId);
    if (existingForTable && existingForTable.id !== device.id) {
      throw new Error(`Table ${input.tableId} is already associated with device ${existingForTable.id}`);
    }

    const assocResult = device.associateTable(input.tableId);
    if (!assocResult.success) {
      throw assocResult.error;
    }

    await this.deviceRepo.save(device);

    await this.eventPublisher.publish(EventType.TABLE_DEVICE_ASSOCIATED, {
      deviceId: device.id,
      restaurantId: device.restaurantId,
      tableId: input.tableId,
      aggregateType: 'TableDevice',
      aggregateId: device.id,
    });

    return device;
  }
}
