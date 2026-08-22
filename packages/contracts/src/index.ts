import { z } from 'zod';

// --- Shared primitives ---
export const UuidSchema = z.string().uuid();
export const TimestampSchema = z.date().or(z.string().datetime());

// --- Health ---
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// --- Version ---
export const VersionResponseSchema = z.object({
  version: z.string(),
  apiVersion: z.string(),
});

export type VersionResponse = z.infer<typeof VersionResponseSchema>;

// --- Enums ---
export const WaitlistStatusSchema = z.enum([
  'PREPARED',
  'WAITING',
  'CALLED',
  'CUSTOMER_CONFIRMED',
  'WAITING_FOR_SEATING',
  'SEATED',
  'CANCELLED',
  'TAKEAWAY',
  'EXPIRED',
  'NO_SHOW',
]);

export type WaitlistStatus = z.infer<typeof WaitlistStatusSchema>;

export const TableStatusSchema = z.enum([
  'AVAILABLE',
  'ASSIGNED',
  'OCCUPIED',
]);

export type TableStatus = z.infer<typeof TableStatusSchema>;

export const TableSessionStatusSchema = z.enum([
  'ASSIGNED',
  'OCCUPIED',
  'OPEN',
  'CLOSING',
  'CLOSED',
]);

export type TableSessionStatus = z.infer<typeof TableSessionStatusSchema>;

export const PreOrderStatusSchema = z.enum([
  'DRAFT',
  'READY',
  'REVIEWING',
  'CONFIRMED',
  'CANCELLED',
]);

export type PreOrderStatus = z.infer<typeof PreOrderStatusSchema>;

export const OrderStatusSchema = z.enum([
  'DRAFT',
  'CONFIRMED',
  'SENT_TO_KITCHEN',
  'PREPARING',
  'READY',
  'DELIVERED',
  'CANCELLED',
]);

export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const AccountStatusSchema = z.enum([
  'OPEN',
  'REQUESTED',
  'PAID',
  'CLOSED',
]);

export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const StaffRoleSchema = z.enum([
  'ADMIN',
  'RECEPTIONIST',
  'WAITER',
  'KITCHEN',
  'CASHIER',
]);

export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const EventTypeSchema = z.enum([
  'CUSTOMER_JOINED_WAITLIST',
  'CUSTOMER_CALLED',
  'CUSTOMER_CONFIRMED',
  'CUSTOMER_CANCELLED_WAIT',
  'CUSTOMER_SELECTED_TAKEAWAY',
  'TABLE_ASSIGNED',
  'CUSTOMER_SEATED',
  'WAITER_ASSIGNED',
  'WAITER_CHANGED',
  'PREORDER_CREATED',
  'PREORDER_UPDATED',
  'ORDER_CONFIRMED',
  'ORDER_SENT_TO_KITCHEN',
  'KITCHEN_RECEIVED',
  'KITCHEN_STARTED',
  'ORDER_NEARLY_READY',
  'ORDER_READY',
  'ORDER_DELIVERED',
  'ADDITIONAL_ORDER_CREATED',
  'CUSTOMER_ADDED_TO_TABLE',
  'CUSTOMER_REMOVED_FROM_TABLE',
  'TABLE_CHANGED',
  'ORDER_CANCELLED',
  'SERVICE_TASK_CREATED',
  'KITCHEN_ORDER_ASSIGNED',
  'ACCOUNT_REQUESTED',
  'PAYMENT_REGISTERED',
  'TABLE_CLOSED',
  'TABLE_RELEASED',
  'TABLE_DEVICE_REGISTERED',
  'TABLE_DEVICE_ASSOCIATED',
  'TABLE_DEVICE_DISASSOCIATED',
  'REVIEW_CREATED',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

// --- Table Contracts ---
export const CreateTableSchema = z.object({
  restaurantId: UuidSchema,
  number: z.number().int().positive(),
  capacity: z.number().int().positive(),
});

export type CreateTableInput = z.infer<typeof CreateTableSchema>;

export const TableResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  number: z.number().int().positive(),
  capacity: z.number().int().positive(),
  status: TableStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TableResponse = z.infer<typeof TableResponseSchema>;

export const UpdateTableStatusSchema = z.object({
  status: TableStatusSchema,
});

export type UpdateTableStatusInput = z.infer<typeof UpdateTableStatusSchema>;

// --- TableSession Contracts ---
export const TableAssignmentSchema = z.object({
  tableId: UuidSchema,
  assignedAt: z.string().datetime(),
  releasedAt: z.string().datetime().optional(),
});

export type TableAssignment = z.infer<typeof TableAssignmentSchema>;

export const CreateTableSessionSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  tableId: UuidSchema,
  initialWaiterId: UuidSchema,
  customerIds: z.array(UuidSchema).optional(),
});

export type CreateTableSessionInput = z.infer<typeof CreateTableSessionSchema>;

export const TableSessionResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  tableId: UuidSchema,
  status: TableSessionStatusSchema,
  customerIds: z.array(UuidSchema).default([]),
  currentWaiterId: UuidSchema.nullable(),
  tableHistory: z.array(TableAssignmentSchema).optional(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TableSessionResponse = z.infer<typeof TableSessionResponseSchema>;

export const ChangeWaiterSchema = z.object({
  newWaiterId: UuidSchema,
});

export type ChangeWaiterInput = z.infer<typeof ChangeWaiterSchema>;

export const ChangeTableSchema = z.object({
  newTableId: UuidSchema,
});

export type ChangeTableInput = z.infer<typeof ChangeTableSchema>;

export const AddCustomerToSessionSchema = z.object({
  customerId: UuidSchema,
});

export type AddCustomerToSessionInput = z.infer<typeof AddCustomerToSessionSchema>;

export const RemoveCustomerFromSessionSchema = z.object({
  customerId: UuidSchema,
});

export type RemoveCustomerFromSessionInput = z.infer<typeof RemoveCustomerFromSessionSchema>;

// --- Waitlist Contracts ---
export const JoinWaitlistSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  customerId: UuidSchema.optional(),
  customerName: z.string().optional(),
  partySize: z.number().int().positive(),
  preOrderId: UuidSchema.nullable().optional(),
});

export type JoinWaitlistInput = z.infer<typeof JoinWaitlistSchema>;

export const WaitlistEntryResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  customerId: UuidSchema,
  partySize: z.number().int().positive(),
  status: WaitlistStatusSchema,
  enteredAt: z.string().datetime(),
  calledAt: z.string().datetime().nullable(),
  seatedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  preOrderId: UuidSchema.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type WaitlistEntryResponse = z.infer<typeof WaitlistEntryResponseSchema>;

// --- PreOrder Contracts ---
export const PreOrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});

export const CreatePreOrderSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  customerId: UuidSchema,
  items: z.array(PreOrderItemSchema).default([]),
});

export type CreatePreOrderInput = z.infer<typeof CreatePreOrderSchema>;

export const PreOrderResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  customerId: UuidSchema,
  status: PreOrderStatusSchema,
  items: z.array(PreOrderItemSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PreOrderResponse = z.infer<typeof PreOrderResponseSchema>;

// --- Order Contracts ---
export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const CreateOrderSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema,
  customerId: UuidSchema.nullable().optional(),
  preOrderId: UuidSchema.nullable().optional(),
  items: z.array(OrderItemSchema).min(1),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

export const OrderResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema,
  customerId: UuidSchema.nullable(),
  status: OrderStatusSchema,
  items: z.array(OrderItemSchema),
  totalAmount: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type OrderResponse = z.infer<typeof OrderResponseSchema>;

// --- Billing Contracts ---
export const CreateAccountSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema,
});

export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

export const PaymentRecordSchema = z.object({
  id: UuidSchema,
  amount: z.number().positive(),
  method: z.string().min(1),
  registeredAt: z.string().datetime(),
});

export const AccountResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema,
  status: AccountStatusSchema,
  totalAmount: z.number().nonnegative(),
  paidAmount: z.number().nonnegative(),
  remainingAmount: z.number().nonnegative(),
  isFullyPaid: z.boolean(),
  payments: z.array(PaymentRecordSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const AddOrderToAccountSchema = z.object({
  orderId: UuidSchema,
});

export type AddOrderToAccountInput = z.infer<typeof AddOrderToAccountSchema>;

export const RegisterPaymentSchema = z.object({
  paymentId: UuidSchema.optional(),
  amount: z.number().positive(),
  method: z.string().min(1),
});

export type RegisterPaymentInput = z.infer<typeof RegisterPaymentSchema>;

// --- Catalog Contracts ---
export const CreateCategorySchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().nonnegative().default(0),
});

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;

export const CategoryResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

export const CreateProductSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  categoryId: UuidSchema,
  name: z.string().min(1).max(150),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().nonnegative(),
  imageUrl: z.string().url().nullable().optional(),
});

export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(1000).nullable().optional(),
  price: z.number().nonnegative().optional(),
  imageUrl: z.string().url().nullable().optional(),
  categoryId: UuidSchema.optional(),
});

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;

export const ChangeAvailabilitySchema = z.object({
  available: z.boolean(),
});

export type ChangeAvailabilityInput = z.infer<typeof ChangeAvailabilitySchema>;

export const ProductResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  categoryId: UuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().nonnegative(),
  imageUrl: z.string().nullable(),
  isAvailable: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ProductResponse = z.infer<typeof ProductResponseSchema>;

// --- Review Contracts ---
export const CreateReviewSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  customerId: UuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const UpdateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(2000).nullable().optional(),
});

export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

export const ReviewResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  customerId: UuidSchema,
  rating: z.number().int().min(1).max(5),
  comment: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

// --- Customer Contracts ---
export const CreateCustomerSchema = z.object({
  id: UuidSchema.optional(),
  name: z.string().min(1).max(150).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
});

export type CreateCustomerInput = z.infer<typeof CreateCustomerSchema>;

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(150).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().optional(),
});

export type UpdateCustomerInput = z.infer<typeof UpdateCustomerSchema>;

export const CustomerResponseSchema = z.object({
  id: UuidSchema,
  name: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type CustomerResponse = z.infer<typeof CustomerResponseSchema>;

// --- EventLog Contracts ---
export const CreateEventLogSchema = z.object({
  id: UuidSchema.optional(),
  eventType: z.string().min(1),
  restaurantId: UuidSchema,
  aggregateType: z.string().min(1),
  aggregateId: UuidSchema,
  tableSessionId: UuidSchema.nullable().optional(),
  actorType: z.string().nullable().optional(),
  actorId: z.string().nullable().optional(),
  payload: z.record(z.unknown()).optional(),
});

export type CreateEventLogInput = z.infer<typeof CreateEventLogSchema>;

export const EventLogResponseSchema = z.object({
  id: UuidSchema,
  eventType: z.string(),
  restaurantId: UuidSchema,
  aggregateType: z.string(),
  aggregateId: UuidSchema,
  tableSessionId: UuidSchema.nullable(),
  timestamp: z.string().datetime(),
  actorType: z.string().nullable(),
  actorId: z.string().nullable(),
  payload: z.record(z.unknown()),
  createdAt: z.string().datetime(),
});

export type EventLogResponse = z.infer<typeof EventLogResponseSchema>;

// --- KitchenOrder Contracts ---
export const KitchenOrderStatusSchema = z.enum([
  'RECEIVED',
  'STARTED',
  'NEARLY_READY',
  'READY',
  'COMPLETED',
]);

export type KitchenOrderStatus = z.infer<typeof KitchenOrderStatusSchema>;

export const CreateKitchenOrderSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  orderId: UuidSchema,
  assignedTo: UuidSchema.nullable().optional(),
  priority: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
});

export type CreateKitchenOrderInput = z.infer<typeof CreateKitchenOrderSchema>;

export const KitchenOrderResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  orderId: UuidSchema,
  status: KitchenOrderStatusSchema,
  assignedTo: UuidSchema.nullable(),
  priority: z.number().int(),
  receivedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  nearlyReadyAt: z.string().datetime().nullable(),
  readyAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KitchenOrderResponse = z.infer<typeof KitchenOrderResponseSchema>;

// --- ServiceTask Contracts ---
export const ServiceTaskTypeSchema = z.enum([
  'TAKE_ORDER',
  'SERVE_FOOD',
  'CHECK_ACCOUNT',
  'CLEAN_TABLE',
  'DELIVER_ORDER',
  'CUSTOMER_REQUEST',
]);

export type ServiceTaskType = z.infer<typeof ServiceTaskTypeSchema>;

export const ServiceTaskStatusSchema = z.enum([
  'PENDING',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export type ServiceTaskStatus = z.infer<typeof ServiceTaskStatusSchema>;

export const CreateServiceTaskSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema.nullable().optional(),
  type: ServiceTaskTypeSchema,
  notes: z.string().nullable().optional(),
});

export type CreateServiceTaskInput = z.infer<typeof CreateServiceTaskSchema>;

export const ServiceTaskResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema.nullable(),
  type: ServiceTaskTypeSchema,
  status: ServiceTaskStatusSchema,
  assignedTo: UuidSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  assignedAt: z.string().datetime().nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

export type ServiceTaskResponse = z.infer<typeof ServiceTaskResponseSchema>;

// --- TableDevice Contracts ---
export const RegisterTableDeviceSchema = z.object({
  id: UuidSchema.optional(),
  restaurantId: UuidSchema,
  name: z.string().min(1).max(100),
  tableId: UuidSchema.nullable().optional(),
});

export type RegisterTableDeviceInput = z.infer<typeof RegisterTableDeviceSchema>;

export const AssociateTableDeviceSchema = z.object({
  tableId: UuidSchema,
});

export type AssociateTableDeviceInput = z.infer<typeof AssociateTableDeviceSchema>;

export const UpdateTableDeviceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export type UpdateTableDeviceInput = z.infer<typeof UpdateTableDeviceSchema>;

export const TableDeviceResponseSchema = z.object({
  id: UuidSchema,
  restaurantId: UuidSchema,
  tableId: UuidSchema.nullable(),
  name: z.string(),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type TableDeviceResponse = z.infer<typeof TableDeviceResponseSchema>;

// --- Auth Contracts ---
export const StaffLoginSchema = z.object({
  staffId: UuidSchema.optional(),
  email: z.string().email().optional(),
  restaurantId: UuidSchema,
});

export type StaffLoginInput = z.infer<typeof StaffLoginSchema>;

export const TableDeviceAuthSchema = z.object({
  deviceId: UuidSchema,
  restaurantId: UuidSchema,
});

export type TableDeviceAuthInput = z.infer<typeof TableDeviceAuthSchema>;

export const CustomerSessionAuthSchema = z.object({
  customerId: UuidSchema.optional(),
  restaurantId: UuidSchema,
  tableSessionId: UuidSchema.optional(),
  name: z.string().optional(),
});

export type CustomerSessionAuthInput = z.infer<typeof CustomerSessionAuthSchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  actor: z.object({
    id: z.string(),
    type: z.enum(['STAFF', 'TABLE_DEVICE', 'CUSTOMER', 'SYSTEM']),
    restaurantId: z.string().nullable(),
    name: z.string().optional(),
    roles: z.array(z.string()).optional(),
  }),
});

export type AuthResponse = z.infer<typeof AuthResponseSchema>;
