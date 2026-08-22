import { Actor, ResourceScope, StaffRole } from '@restaurant-os/domain';

export interface ResourceScoper {
  getScope(actor: Actor, resourceType: string): Promise<ResourceScope>;
}

export class OperationalResourceScoper implements ResourceScoper {
  constructor(
    private readonly getWaiterTableSessionIds: (waiterId: string) => Promise<string[]>,
    private readonly getTableDeviceSessionId?: (tableDeviceId: string) => Promise<string | null>,
    private readonly getStaffRoles?: (staffId: string) => Promise<StaffRole[]>,
  ) {}

  async getScope(actor: Actor, resourceType: string): Promise<ResourceScope> {
    if (actor.isSystem()) return ResourceScope.global();
    if (actor.isCustomer()) return ResourceScope.own();

    if (actor.isTableDevice()) {
      if (resourceType === 'table-device') {
        return ResourceScope.own([actor.id]);
      }
      if (this.getTableDeviceSessionId) {
        const sessionId = await this.getTableDeviceSessionId(actor.id);
        if (sessionId) {
          return ResourceScope.own([sessionId]);
        }
      }
      return ResourceScope.own();
    }

    if (actor.isStaff()) {
      if (this.getStaffRoles) {
        const roles = await this.getStaffRoles(actor.id);
        if (roles.includes(StaffRole.ADMIN) || roles.includes(StaffRole.RECEPTIONIST)) {
          return ResourceScope.restaurant();
        }
      }

      // WAITER gets OWN scope for table-session (matching session IDs)
      if (resourceType === 'table-session') {
        const sessionIds = await this.getWaiterTableSessionIds(actor.id);
        return ResourceScope.own(sessionIds);
      }

      // Operational staff has RESTAURANT scope for orders, accounts, kitchen-orders, tasks, etc.
      return ResourceScope.restaurant();
    }

    return ResourceScope.own();
  }
}
