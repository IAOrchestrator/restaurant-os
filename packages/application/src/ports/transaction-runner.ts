import type { TableRepository } from './table-repository';
import type { TableSessionRepository } from './table-session-repository';
import type { OrderRepository } from './order-repository';
import type { KitchenOrderRepository } from './kitchen-order-repository';
import type { AccountRepository } from './account-repository';

/**
 * Context that groups repositories sharing the same transactional boundary.
 */
export interface TransactionContext {
  tableRepo: TableRepository;
  sessionRepo: TableSessionRepository;
  orderRepo: OrderRepository;
  kitchenOrderRepo: KitchenOrderRepository;
  accountRepo: AccountRepository;
}

/**
 * Port for atomic multi-aggregate transaction execution.
 * Allows use cases to coordinate operations across multiple repositories
 * within a single ACID transaction without coupling to any specific database.
 */
export interface TransactionRunner {
  run<T>(fn: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
