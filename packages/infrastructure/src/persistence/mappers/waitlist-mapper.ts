import { WaitlistEntry, WaitlistStatus } from '@restaurant-os/domain';
import type { WaitlistEntry as PrismaWaitlistEntry } from '@restaurant-os/database';

export class WaitlistMapper {
  static toDomain(prismaEntry: PrismaWaitlistEntry): WaitlistEntry | null {
    const result = WaitlistEntry.create({
      id: prismaEntry.id,
      restaurantId: prismaEntry.restaurantId,
      customerId: prismaEntry.customerId,
      partySize: prismaEntry.partySize,
      status: prismaEntry.status as WaitlistStatus,
      preOrderId: prismaEntry.preOrderId,
      createdAt: prismaEntry.createdAt,
    });

    if (!result.success) return null;
    let entry = result.value;

    // Replay state transitions based on stored status
    const targetStatus = prismaEntry.status as WaitlistStatus;
    const transitions: Record<WaitlistStatus, () => void> = {
      [WaitlistStatus.PREPARED]: () => {},
      [WaitlistStatus.WAITING]: () => {
        const r = entry.joinQueue();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.CALLED]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.CUSTOMER_CONFIRMED]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
        r = entry.confirm();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.WAITING_FOR_SEATING]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
        r = entry.confirm();
        if (r.success) entry = r.value;
        r = entry.markWaitingForSeating();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.SEATED]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
        r = entry.confirm();
        if (r.success) entry = r.value;
        r = entry.markWaitingForSeating();
        if (r.success) entry = r.value;
        r = entry.seat();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.CANCELLED]: () => {
        const r = entry.joinQueue();
        if (r.success) entry = r.value;
        // Cancel can happen from multiple states; we approximate from WAITING
        const c = entry.cancel();
        if (c.success) entry = c.value;
      },
      [WaitlistStatus.TAKEAWAY]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.selectTakeaway();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.EXPIRED]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
        r = entry.expire();
        if (r.success) entry = r.value;
      },
      [WaitlistStatus.NO_SHOW]: () => {
        let r = entry.joinQueue();
        if (r.success) entry = r.value;
        r = entry.call();
        if (r.success) entry = r.value;
        r = entry.markNoShow();
        if (r.success) entry = r.value;
      },
    };

    transitions[targetStatus]();
    return entry;
  }

  static toPrisma(entry: WaitlistEntry): Omit<PrismaWaitlistEntry, 'restaurant' | 'customer'> {
    return {
      id: entry.id,
      restaurantId: entry.restaurantId,
      customerId: entry.customerId,
      partySize: entry.partySize,
      status: entry.status,
      enteredAt: entry.enteredAt,
      calledAt: entry.calledAt,
      seatedAt: entry.seatedAt,
      cancelledAt: entry.cancelledAt,
      preOrderId: entry.preOrderId,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
