import type { TableDevice } from '@restaurant-os/domain';
import type { TableDeviceRepository } from '../../ports/table-device-repository';

export class ListTableDevicesUseCase {
  constructor(private readonly deviceRepo: TableDeviceRepository) {}

  async execute(restaurantId: string): Promise<TableDevice[]> {
    return this.deviceRepo.findByRestaurantId(restaurantId);
  }
}
