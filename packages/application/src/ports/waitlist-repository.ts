import type { WaitlistEntry, WaitlistEntryId } from '@restaurant-os/domain';

export interface WaitlistRepository {
  findById(id: WaitlistEntryId): Promise<WaitlistEntry | null>;
  findByRestaurantId(restaurantId: string): Promise<WaitlistEntry[]>;
  findActiveByCustomerId(customerId: string): Promise<WaitlistEntry | null>;
  save(entry: WaitlistEntry): Promise<void>;
  delete(id: WaitlistEntryId): Promise<void>;
}
