import type { TableDevice } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';

export class GetTableDeviceUseCase {
  constructor(private readonly deviceRepo: TableDeviceRepository) {}

  async execute(id: string): Promise<TableDevice | null> {
    return this.deviceRepo.findById(id);
  }
}
