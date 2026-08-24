// Domain layer: pure business logic, no infrastructure dependencies
// Each module follows: entity -> value-object -> repository-interface -> errors

// --- Shared ---
export * from './shared/entity';
export * from './shared/value-object';
export * from './shared/result';

// --- Implemented Modules ---
export * from './table/index';
export * from './table-session/index';
export * from './waitlist/index';
export * from './catalog/index';
export * from './preorder/index';
export * from './order/index';
export * from './kitchen/index';
export * from './service/index';
export * from './billing/index';
export * from './review/index';
export * from './event/index';
export * from './customer/index';
export * from './table-device/index';

// --- Scaffolded Modules ---
export * as Restaurant from './restaurant/index';
export * as Staff from './staff/index';
export * as Notification from './notification/index';
export * as Analytics from './analytics/index';

export * from './identity';
export { Actor, ActorType, type ActorId } from './identity/actor';
export * from './auth';
export * from './inventory/raw-material';
export * from './inventory/recipe';
