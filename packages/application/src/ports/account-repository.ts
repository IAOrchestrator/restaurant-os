import type { Account, AccountId } from '@restaurant-os/domain';

export interface AccountRepository {
  findById(id: AccountId): Promise<Account | null>;
  findByTableSessionId(tableSessionId: string): Promise<Account | null>;
  findByRestaurantId(restaurantId: string): Promise<Account[]>;
  save(account: Account): Promise<void>;
}
