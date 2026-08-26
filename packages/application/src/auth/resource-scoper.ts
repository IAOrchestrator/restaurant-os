import { Actor, ResourceScope, StaffRole } from '@restaurant-os/domain';

export interface ResourceScoper {
  getScope(actor: Actor, resourceType: string): Promise<ResourceScope>;
}

export class OperationalResourceScoper implements ResourceScoper {
  constructor(
    private readonly getWaiterTableSessionIds: (waiterId: string) => Promise<string[]>,
    private readonly getTableDeviceSessionId?: (tableDeviceId: string) => Promise<string | null>,
    private readonly getStaffRoles?: (staffId: string) => Promise<StaffRole[]>,
    private readonly getTableDeviceTableId?: (tableDeviceId: string) => Promise<string | null>,
    private readonly getCustomerSessionIds?: (customerId: string) => Promise<string[]>,
  ) {}

  async getScope(actor: Actor, resourceType: string): Promise<ResourceScope> {
    if (actor.isSystem()) return ResourceScope.global();

    if (actor.isCustomer()) {
      if (resourceType === 'customer') {
        return ResourceScope.own([actor.id]);
      }
      if (resourceType === 'preorder' || resourceType === 'catalog' || resourceType === 'review') {
        return ResourceScope.restaurant();
      }
      if (this.getCustomerSessionIds) {
        const sessionIds = await this.getCustomerSessionIds(actor.id);
        return ResourceScope.own(sessionIds);
      }
      return ResourceScope.own();
    }

    if (actor.isTableDevice()) {
      if (resourceType === 'table-device') {
        return ResourceScope.own([actor.id]);
      }
      if (resourceType === 'table') {
        if (this.getTableDeviceTableId) {
          const tableId = await this.getTableDeviceTableId(actor.id);
          return ResourceScope.own(tableId ? [tableId] : []);
        }
        return ResourceScope.own([]);
      }
      if (resourceType === 'table-session' || resourceType === 'order' || resourceType === 'account' || resourceType === 'service-task') {
        if (this.getTableDeviceSessionId) {
          const sessionId = await this.getTableDeviceSessionId(actor.id);
          return ResourceScope.own(sessionId ? [sessionId] : []);
        }
        return ResourceScope.own([]);
      }
      return ResourceScope.own([]);
    }

    if (actor.isStaff()) {
      if (this.getStaffRoles) {
        const roles = await this.getStaffRoles(actor.id);
        if (
          roles.includes(StaffRole.ADMIN) ||
          roles.includes(StaffRole.RECEPTIONIST) ||
          roles.includes(StaffRole.CASHIER)
        ) {
          return ResourceScope.restaurant();
        }
      }

      // WAITER gets OWN scope for table-session (matching assigned session IDs)
      if (resourceType === 'table-session') {
        const sessionIds = await this.getWaiterTableSessionIds(actor.id);
        return ResourceScope.own(sessionIds);
      }

      // Operational staff has RESTAURANT scope for orders, accounts, kitchen-orders, tasks, tables, etc.
      return ResourceScope.restaurant();
    }

    return ResourceScope.own();
  }
}
