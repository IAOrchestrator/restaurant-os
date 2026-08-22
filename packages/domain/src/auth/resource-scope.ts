// ResourceScope — defines which resources an actor can access
// Simple but extensible: covers the main operational cases

export enum ResourceScopeType {
  OWN = 'OWN',           // Only resources directly assigned to the actor
  RESTAURANT = 'RESTAURANT', // All resources within the restaurant
  GLOBAL = 'GLOBAL',     // All resources (admin)
}

export class ResourceScope {
  private constructor(
    public readonly type: ResourceScopeType,
    public readonly resourceIds: string[] | null, // null = all within scope
  ) {}

  static own(resourceIds?: string[]): ResourceScope {
    return new ResourceScope(ResourceScopeType.OWN, resourceIds ?? null);
  }

  static restaurant(): ResourceScope {
    return new ResourceScope(ResourceScopeType.RESTAURANT, null);
  }

  static global(): ResourceScope {
    return new ResourceScope(ResourceScopeType.GLOBAL, null);
  }

  canAccess(resourceId: string): boolean {
    if (this.type === ResourceScopeType.GLOBAL) return true;
    if (this.resourceIds === null) return true; // Scope type restricts, not specific IDs
    return this.resourceIds.includes(resourceId);
  }

  isOwn(): boolean {
    return this.type === ResourceScopeType.OWN;
  }

  isRestaurant(): boolean {
    return this.type === ResourceScopeType.RESTAURANT;
  }

  isGlobal(): boolean {
    return this.type === ResourceScopeType.GLOBAL;
  }
}
