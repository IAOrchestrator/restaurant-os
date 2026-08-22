import { Account, AccountStatus } from '@restaurant-os/domain';
import type { Account as PrismaAccount } from '@restaurant-os/database';

export class AccountMapper {
  static toDomain(prismaAccount: PrismaAccount): Account | null {

    const result = Account.create({
      id: prismaAccount.id,
      restaurantId: prismaAccount.restaurantId,
      tableSessionId: prismaAccount.tableSessionId,
      createdAt: prismaAccount.createdAt,
    });

    if (!result.success) return null;
    let account = result.value;

    // Add total amount if present
    if (prismaAccount.totalAmount && Number(prismaAccount.totalAmount) > 0) {
      const added = account.addOrderAmount(Number(prismaAccount.totalAmount));
      if (added.success) account = added.value;
    }

    // Replay state transitions
    const targetStatus = prismaAccount.status as AccountStatus;
    const transitions: Record<AccountStatus, () => void> = {
      [AccountStatus.OPEN]: () => {},
      [AccountStatus.REQUESTED]: () => {
        const r = account.requestPayment();
        if (r.success) account = r.value;
      },
      [AccountStatus.PAID]: () => {
        let r = account.requestPayment();
        if (r.success) account = r.value;
        // We can't replay exact payments without payment data
        // The state will be approximated
      },
      [AccountStatus.CLOSED]: () => {
        let r = account.requestPayment();
        if (r.success) account = r.value;
        r = account.close();
        if (r.success) account = r.value;
      },
    };

    transitions[targetStatus]();
    return account;
  }

  static toPrisma(account: Account): Omit<PrismaAccount, 'restaurant' | 'tableSession' | 'payments'> {
    return {
      id: account.id,
      restaurantId: account.restaurantId,
      tableSessionId: account.tableSessionId,
      status: account.status,
      totalAmount: account.totalAmount as any,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
    };
  }
}
