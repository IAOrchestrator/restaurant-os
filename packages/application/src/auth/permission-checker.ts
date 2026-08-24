import { Actor, Permission, StaffRole, ROLE_PERMISSIONS, CUSTOMER_PERMISSIONS, TABLE_DEVICE_PERMISSIONS } from '@restaurant-os/domain';

export interface PermissionChecker {
  hasPermission(actor: Actor, permission: Permission): Promise<boolean>;
  hasAnyPermission(actor: Actor, permissions: Permission[]): Promise<boolean>;
  hasAllPermissions(actor: Actor, permissions: Permission[]): Promise<boolean>;
}

export class RoleBasedPermissionChecker implements PermissionChecker {
  constructor(private readonly getStaffRoles: (staffId: string) => Promise<StaffRole[]>) {}

  async hasPermission(actor: Actor, permission: Permission): Promise<boolean> {
    if (actor.isSystem()) return true;
    if (actor.isCustomer()) {
      return CUSTOMER_PERMISSIONS.includes(permission);
    }
    if (actor.isTableDevice()) {
      return TABLE_DEVICE_PERMISSIONS.includes(permission);
    }
    if (actor.isStaff()) {
      const roles = await this.getStaffRoles(actor.id);
      const permissions = roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []);
      return permissions.includes(permission);
    }
    return false;
  }

  async hasAnyPermission(actor: Actor, permissions: Permission[]): Promise<boolean> {
    for (const p of permissions) {
      if (await this.hasPermission(actor, p)) return true;
    }
    return false;
  }

  async hasAllPermissions(actor: Actor, permissions: Permission[]): Promise<boolean> {
    for (const p of permissions) {
      if (!(await this.hasPermission(actor, p))) return false;
    }
    return true;
  }
}
