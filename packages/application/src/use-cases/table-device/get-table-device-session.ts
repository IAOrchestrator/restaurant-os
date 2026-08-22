import type { TableSession } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';
import type { TableSessionRepository } from '../../ports/table-session-repository';

export class GetTableDeviceSessionUseCase {
  constructor(
    private readonly deviceRepo: TableDeviceRepository,
    private readonly sessionRepo: TableSessionRepository,
  ) {}

  async execute(deviceId: string): Promise<TableSession | null> {
    const device = await this.deviceRepo.findById(deviceId);
    if (!device) {
      throw new Error(`TableDevice not found: ${deviceId}`);
    }

    if (!device.tableId) {
      return null;
    }

    return this.sessionRepo.findActiveByTableId(device.tableId);
  }
}
