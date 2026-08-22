export enum Permission {
  // Waitlist
  WAITLIST_READ = 'waitlist.read',
  WAITLIST_MANAGE = 'waitlist.manage',

  // Tables
  TABLES_READ = 'tables.read',
  TABLES_ASSIGN = 'tables.assign',
  TABLES_OCCUPY = 'tables.occupy',
  TABLES_RELEASE = 'tables.release',

  // Table Devices
  TABLE_DEVICES_READ = 'table_devices.read',
  TABLE_DEVICES_MANAGE = 'table_devices.manage',

  // Table Sessions
  TABLE_SESSIONS_READ = 'table_sessions.read',
  TABLE_SESSIONS_MANAGE = 'table_sessions.manage',
  TABLE_SESSIONS_CHANGE_WAITER = 'table_sessions.change_waiter',

  // Orders
  ORDERS_READ = 'orders.read',
  ORDERS_CREATE = 'orders.create',
  ORDERS_UPDATE = 'orders.update',
  ORDERS_SEND_TO_KITCHEN = 'orders.send_to_kitchen',
  ORDERS_DELIVER = 'orders.deliver',

  // PreOrders
  PREORDERS_READ = 'preorders.read',
  PREORDERS_CREATE = 'preorders.create',
  PREORDERS_UPDATE = 'preorders.update',

  // Kitchen Orders
  KITCHEN_ORDERS_READ = 'kitchen_orders.read',
  KITCHEN_ORDERS_START = 'kitchen_orders.start',
  KITCHEN_ORDERS_READY = 'kitchen_orders.ready',
  KITCHEN_ORDERS_COMPLETE = 'kitchen_orders.complete',
  KITCHEN_ORDERS_ASSIGN = 'kitchen_orders.assign',

  // Accounts
  ACCOUNTS_READ = 'accounts.read',
  ACCOUNTS_REQUEST_PAYMENT = 'accounts.request_payment',
  ACCOUNTS_CLOSE = 'accounts.close',

  // Payments
  PAYMENTS_REGISTER = 'payments.register',
  PAYMENTS_READ = 'payments.read',

  // Catalog
  CATALOG_READ = 'catalog.read',
  CATALOG_MANAGE = 'catalog.manage',

  // Reviews
  REVIEWS_READ = 'reviews.read',
  REVIEWS_CREATE = 'reviews.create',
  REVIEWS_MANAGE = 'reviews.manage',

  // Staff
  STAFF_READ = 'staff.read',
  STAFF_MANAGE = 'staff.manage',

  // Customer
  CUSTOMER_MANAGE = 'customer.manage',

  // Events
  EVENTS_READ = 'events.read',

  // Service Tasks
  SERVICE_TASKS_READ = 'service_tasks.read',
  SERVICE_TASKS_MANAGE = 'service_tasks.manage',

  // Analytics
  ANALYTICS_READ = 'analytics.read',

  // Restaurant
  RESTAURANT_MANAGE = 'restaurant.manage',
}

export const ALL_PERMISSIONS = Object.values(Permission);
