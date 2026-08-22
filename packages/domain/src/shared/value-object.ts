export abstract class ValueObject {
  equals(other: ValueObject): boolean {
    return JSON.stringify(this) === JSON.stringify(other);
  }
}
