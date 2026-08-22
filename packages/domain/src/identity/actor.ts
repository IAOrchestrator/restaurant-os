// Actor — represents WHO is performing an operation
// Can be a Customer, Staff member, or System

export type ActorId = string;

export enum ActorType {
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  TABLE_DEVICE = 'TABLE_DEVICE',
  SYSTEM = 'SYSTEM',
}

export class Actor {
  private constructor(
    public readonly id: ActorId,
    public readonly type: ActorType,
    public readonly restaurantId: string | null,
    public readonly metadata: Record<string, unknown>,
  ) {}

  static customer(id: ActorId, restaurantId: string | null, metadata?: Record<string, unknown>): Actor {
    return new Actor(id, ActorType.CUSTOMER, restaurantId, metadata ?? {});
  }

  static staff(id: ActorId, restaurantId: string, metadata?: Record<string, unknown>): Actor {
    return new Actor(id, ActorType.STAFF, restaurantId, metadata ?? {});
  }

  static tableDevice(id: ActorId, restaurantId: string, metadata?: Record<string, unknown>): Actor {
    return new Actor(id, ActorType.TABLE_DEVICE, restaurantId, metadata ?? {});
  }

  static system(metadata?: Record<string, unknown>): Actor {
    return new Actor('system', ActorType.SYSTEM, null, metadata ?? {});
  }

  isCustomer(): boolean {
    return this.type === ActorType.CUSTOMER;
  }

  isStaff(): boolean {
    return this.type === ActorType.STAFF;
  }

  isTableDevice(): boolean {
    return this.type === ActorType.TABLE_DEVICE;
  }

  isSystem(): boolean {
    return this.type === ActorType.SYSTEM;
  }

  get staffId(): string | null {
    return this.isStaff() ? this.id : null;
  }

  get customerId(): string | null {
    return this.isCustomer() ? this.id : null;
  }

  get tableDeviceId(): string | null {
    return this.isTableDevice() ? this.id : null;
  }
}
