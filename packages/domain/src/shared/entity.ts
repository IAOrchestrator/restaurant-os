export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other: Entity<TId>): boolean {
    return other instanceof Entity && other.id === this.id;
  }
}
