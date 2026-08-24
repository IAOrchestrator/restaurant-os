import { TableDevice, EventType, ActorType, createDomainEvent } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface RegisterTableDeviceInput {
  id: string;
  restaurantId: string;
  name: string;
  tableId?: string | null;
  actorType?: ActorType;
  actorId?: string | null;
}

export class RegisterTableDeviceUseCase {
  constructor(
    private readonly deviceRepo: TableDeviceRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: RegisterTableDeviceInput): Promise<TableDevice> {
    const createResult = TableDevice.create({
      id: input.id,
      restaurantId: input.restaurantId,
      name: input.name,
      tableId: input.tableId,
    });

    if (!createResult.success) {
      throw createResult.error;
    }

    const device = createResult.value;
    await this.deviceRepo.save(device);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_DEVICE_REGISTERED,
        restaurantId: device.restaurantId,
        aggregateType: 'TableDevice',
        aggregateId: device.id,
        tableId: device.tableId ?? null,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          deviceId: device.id,
          restaurantId: device.restaurantId,
          name: device.name,
          tableId: device.tableId,
        },
      }),
    );

    return device;
  }
}
