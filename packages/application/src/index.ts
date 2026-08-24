// Application layer: use cases and application services
// Depends only on Domain and Contracts. No infrastructure details.

export * from './ports/repository';
export * from './ports/event-publisher';
export * from './ports/transaction-runner';
export * from './ports/table-repository';
export * from './ports/table-session-repository';
export * from './ports/customer-repository';
export * from './ports/table-device-repository';

export * from './use-cases/table/assign-table';
export * from './use-cases/table/occupy-table';
export * from './use-cases/table-session/create-table-session';
export * from './use-cases/table-session/close-table-session';
export * from './use-cases/table-session/change-waiter';
export * from './use-cases/table-session/change-table';
export * from './use-cases/table-session/add-customer';
export * from './use-cases/table-session/remove-customer';
export * from './use-cases/customer/create-customer';
export * from './use-cases/customer/get-customer';
export * from './use-cases/customer/update-customer-profile';
export * from './use-cases/table-device/register-table-device';
export * from './use-cases/table-device/associate-table-device';
export * from './use-cases/table-device/disassociate-table-device';
export * from './use-cases/table-device/get-table-device';
export * from './use-cases/table-device/list-table-devices';
export * from './use-cases/table-device/get-table-device-session';

export * from './ports/waitlist-repository';
export * from './use-cases/waitlist/join-waitlist';
export * from './use-cases/waitlist/call-customer';
export * from './use-cases/waitlist/confirm-customer';
export * from './use-cases/waitlist/cancel-waitlist';
export * from './use-cases/waitlist/select-takeaway';
export * from './use-cases/waitlist/seat-customer';

export * from './ports/preorder-repository';
export * from './ports/order-repository';
export * from './use-cases/preorder/create-preorder';
export * from './use-cases/preorder/confirm-preorder';
export * from './use-cases/preorder/cancel-preorder';
export * from './use-cases/order/create-order';
export * from './use-cases/order/send-to-kitchen';
export * from './use-cases/order/start-preparing';
export * from './use-cases/order/mark-ready';
export * from './use-cases/order/deliver-order';
export * from './use-cases/order/cancel-order';

export * from './ports/account-repository';
export * from './use-cases/billing/create-account';
export * from './use-cases/billing/add-order-to-account';
export * from './use-cases/billing/request-payment';
export * from './use-cases/billing/register-payment';
export * from './use-cases/billing/close-account';

export * from './ports/category-repository';
export * from './ports/product-repository';
export * from './use-cases/catalog/create-category';
export * from './use-cases/catalog/update-category';
export * from './use-cases/catalog/create-product';
export * from './use-cases/catalog/update-product';
export * from './use-cases/catalog/change-availability';

export * from './ports/review-repository';
export * from './use-cases/review/create-review';
export * from './use-cases/review/update-review';

export * from './ports/event-log-repository';
export * from './ports/notification-service';
export * from './use-cases/event-log/create-event-log';
export * from './use-cases/event-log/list-event-logs';
export * from './use-cases/event-log/get-event-log';
export * from './use-cases/event-log/list-events-by-aggregate';
export * from './use-cases/notification/send-notification';

export * from './ports/kitchen-order-repository';
export * from './use-cases/kitchen/create-kitchen-order';
export * from './use-cases/kitchen/start-kitchen-order';
export * from './use-cases/kitchen/mark-nearly-ready';
export * from './use-cases/kitchen/mark-kitchen-order-ready';
export * from './use-cases/kitchen/complete-kitchen-order';
export * from './use-cases/kitchen/assign-kitchen-order';

export * from './ports/service-task-repository';
export * from './use-cases/service/create-service-task';
export * from './use-cases/service/assign-service-task';
export * from './use-cases/service/start-service-task';
export * from './use-cases/service/complete-service-task';
export * from './use-cases/service/cancel-service-task';

export * from './ports/raw-material-repository';
export * from './ports/recipe-repository';
export * from './use-cases/inventory/get-raw-materials';
export * from './use-cases/inventory/create-raw-material';
export * from './use-cases/inventory/update-raw-material-stock';
export * from './use-cases/inventory/manage-recipe';
export * from './use-cases/inventory/deduct-inventory-for-order';
export * from './use-cases/analytics/get-live-operations';

export * from './auth';
