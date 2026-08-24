import { TableDevice, EventType, ActorType, createDomainEvent } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';
import type { EventPublisher } from '../../ports/event-publisher';

export interface DisassociateTableDeviceInput {
  deviceId: string;
  actorType?: ActorType;
  actorId?: string | null;
}

export class DisassociateTableDeviceUseCase {
  constructor(
    private readonly deviceRepo: TableDeviceRepository,
    private readonly eventPublisher: EventPublisher,
  ) {}

  async execute(input: DisassociateTableDeviceInput): Promise<TableDevice> {
    const device = await this.deviceRepo.findById(input.deviceId);
    if (!device) {
      throw new Error(`TableDevice not found: ${input.deviceId}`);
    }

    const previousTableId = device.tableId;
    const disassocResult = device.disassociateTable();
    if (!disassocResult.success) {
      throw disassocResult.error;
    }

    await this.deviceRepo.save(device);

    await this.eventPublisher.publish(
      createDomainEvent({
        type: EventType.TABLE_DEVICE_DISASSOCIATED,
        restaurantId: device.restaurantId,
        aggregateType: 'TableDevice',
        aggregateId: device.id,
        tableId: previousTableId,
        actorType: input.actorType ?? ActorType.STAFF,
        actorId: input.actorId ?? null,
        payload: {
          deviceId: device.id,
          restaurantId: device.restaurantId,
          previousTableId,
        },
      }),
    );

    return device;
  }
}
