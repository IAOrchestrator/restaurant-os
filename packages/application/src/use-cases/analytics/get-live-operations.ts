import { TableRepository } from '../../ports/table-repository';
import { TableSessionRepository } from '../../ports/table-session-repository';
import { WaitlistRepository } from '../../ports/waitlist-repository';
import { KitchenOrderRepository } from '../../ports/kitchen-order-repository';
import { AccountRepository } from '../../ports/account-repository';
import { ServiceTaskRepository } from '../../ports/service-task-repository';
import { OrderRepository } from '../../ports/order-repository';
import { RawMaterialRepository } from '../../ports/raw-material-repository';

export interface LiveOperationsReport {
  timestamp: string;
  salon: {
    totalTables: number;
    occupiedTables: number;
    availableTables: number;
    occupancyRate: number;
    seatedGuests: number;
    avgTableDurationMinutes: number;
    waitingCustomers: number;
  };
  waiters: {
    activeWaitersCount: number;
    pendingServiceTasksCount: number;
    waiterLoad: Array<{ waiterId: string; tablesCount: number }>;
  };
  kitchen: {
    pendingOrdersCount: number;
    inPrepOrdersCount: number;
    readyOrdersCount: number;
    delayedOrdersCount: number;
    avgPrepTimeMinutes: number;
  };
  financials: {
    totalRevenueShift: number;
    paidAmountShift: number;
    pendingBalanceShift: number;
    closedAccountsCount: number;
    openAccountsCount: number;
    avgTicketPerTable: number;
    paymentMethodsBreakdown: {
      cash: number;
      card: number;
      qr: number;
      transfer: number;
    };
  };
  topProducts: Array<{
    productId: string;
    productName: string;
    quantitySold: number;
    totalAmount: number;
  }>;
  inventoryAlertsCount: number;
}

export class GetLiveOperationsUseCase {
  constructor(
    private tableRepo: TableRepository,
    private sessionRepo: TableSessionRepository,
    private waitlistRepo: WaitlistRepository,
    private kitchenRepo: KitchenOrderRepository,
    private accountRepo: AccountRepository,
    private taskRepo: ServiceTaskRepository,
    private orderRepo?: OrderRepository,
    private rawMaterialRepo?: RawMaterialRepository,
  ) {}

  async execute(restaurantId: string): Promise<LiveOperationsReport> {
    const now = Date.now();

    // 1. Salon & Tables
    const tables = await this.tableRepo.findByRestaurantId(restaurantId);
    const allSessions = await this.sessionRepo.findByRestaurantId(restaurantId);
    const activeSessions = allSessions.filter((s) => s.status !== 'CLOSED');
    const allWaitlist = await this.waitlistRepo.findByRestaurantId(restaurantId);
    const waitlist = allWaitlist.filter((w) => ['PREPARED', 'WAITING', 'CALLED', 'CUSTOMER_CONFIRMED', 'WAITING_FOR_SEATING'].includes(w.status));

    const totalTables = tables.length;
    const occupiedTables = activeSessions.length;
    const availableTables = Math.max(0, totalTables - occupiedTables);
    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
    const seatedGuests = activeSessions.reduce((sum: number, s) => sum + (s.customerIds?.length || 0), 0);

    // Calculate avg table duration
    let totalDurationMinutes = 0;
    for (const session of activeSessions) {
      const openedAt = new Date(session.openedAt).getTime();
      if (!isNaN(openedAt)) {
        totalDurationMinutes += Math.max(0, Math.floor((now - openedAt) / (1000 * 60)));
      }
    }
    const avgTableDurationMinutes = occupiedTables > 0 ? Math.round(totalDurationMinutes / occupiedTables) : 0;

    // 2. Waiters
    const waiterTableMap = new Map<string, number>();
    for (const s of activeSessions) {
      const wId = s.currentWaiterId || 'unassigned';
      const current = waiterTableMap.get(wId) || 0;
      waiterTableMap.set(wId, current + 1);
    }
    const waiterLoad = Array.from(waiterTableMap.entries()).map(([waiterId, tablesCount]) => ({
      waiterId,
      tablesCount,
    }));

    const tasks = await this.taskRepo.findByRestaurantId(restaurantId);
    const pendingServiceTasksCount = tasks.filter((t) => t.status === 'PENDING' || t.status === 'IN_PROGRESS').length;

    // 3. Kitchen KDS
    const kitchenOrders = await this.kitchenRepo.findByRestaurantId(restaurantId);
    const pendingOrdersCount = kitchenOrders.filter((k) => k.status === 'RECEIVED').length;
    const inPrepOrdersCount = kitchenOrders.filter((k) => k.status === 'STARTED' || k.status === 'NEARLY_READY').length;
    const readyOrdersCount = kitchenOrders.filter((k) => k.status === 'READY').length;

    let delayedOrdersCount = 0;
    let totalPrepTimeMinutes = 0;
    let completedCount = 0;

    for (const k of kitchenOrders) {
      const rec = new Date(k.receivedAt).getTime();
      const elapsedSec = !isNaN(rec) ? Math.floor((now - rec) / 1000) : 0;
      if (k.status !== 'COMPLETED' && elapsedSec > 600) {
        delayedOrdersCount++;
      }
      if (k.completedAt && !isNaN(rec)) {
        const completed = new Date(k.completedAt).getTime();
        totalPrepTimeMinutes += Math.max(0, Math.floor((completed - rec) / (1000 * 60)));
        completedCount++;
      }
    }
    const avgPrepTimeMinutes = completedCount > 0 ? Math.round(totalPrepTimeMinutes / completedCount) : 12;

    // 4. Financials
    const accounts = await this.accountRepo.findByRestaurantId(restaurantId);
    let totalRevenueShift = 0;
    let paidAmountShift = 0;
    let closedAccountsCount = 0;
    let openAccountsCount = 0;

    const paymentMethods = { cash: 0, card: 0, qr: 0, transfer: 0 };

    for (const acc of accounts) {
      totalRevenueShift += Number(acc.totalAmount);
      paidAmountShift += Number(acc.paidAmount);
      if (acc.status === 'CLOSED') {
        closedAccountsCount++;
      } else {
        openAccountsCount++;
      }

      for (const p of acc.payments) {
        const amt = Number(p.amount);
        const m = (p.method || '').toUpperCase();
        if (m === 'CASH' || m === 'EFECTIVO') paymentMethods.cash += amt;
        else if (m === 'CARD' || m === 'TARJETA') paymentMethods.card += amt;
        else if (m === 'QR') paymentMethods.qr += amt;
        else paymentMethods.transfer += amt;
      }
    }

    const pendingBalanceShift = Math.max(0, totalRevenueShift - paidAmountShift);
    const totalAccounts = accounts.length;
    const avgTicketPerTable = totalAccounts > 0 ? Math.round(totalRevenueShift / totalAccounts) : 0;

    // 5. Top Products Sold
    const topProductsMap = new Map<string, { productName: string; quantitySold: number; totalAmount: number }>();
    if (this.orderRepo) {
      const orders = await this.orderRepo.findByRestaurantId(restaurantId);
      for (const ord of orders) {
        for (const it of ord.items) {
          const key = it.productId;
          const prev = topProductsMap.get(key) || {
            productName: it.productId,
            quantitySold: 0,
            totalAmount: 0,
          };
          prev.quantitySold += it.quantity;
          prev.totalAmount += it.unitPrice * it.quantity;
          topProductsMap.set(key, prev);
        }
      }
    }

    const topProducts = Array.from(topProductsMap.entries())
      .map(([productId, data]) => ({
        productId,
        productName: data.productName,
        quantitySold: data.quantitySold,
        totalAmount: data.totalAmount,
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    // 6. Inventory Low Stock Alerts Count
    let inventoryAlertsCount = 0;
    if (this.rawMaterialRepo) {
      const lowStock = await this.rawMaterialRepo.findLowStockByRestaurantId(restaurantId);
      inventoryAlertsCount = lowStock.length;
    }

    return {
      timestamp: new Date().toISOString(),
      salon: {
        totalTables,
        occupiedTables,
        availableTables,
        occupancyRate,
        seatedGuests,
        avgTableDurationMinutes,
        waitingCustomers: waitlist.length,
      },
      waiters: {
        activeWaitersCount: waiterLoad.length,
        pendingServiceTasksCount,
        waiterLoad,
      },
      kitchen: {
        pendingOrdersCount,
        inPrepOrdersCount,
        readyOrdersCount,
        delayedOrdersCount,
        avgPrepTimeMinutes,
      },
      financials: {
        totalRevenueShift,
        paidAmountShift,
        pendingBalanceShift,
        closedAccountsCount,
        openAccountsCount,
        avgTicketPerTable,
        paymentMethodsBreakdown: paymentMethods,
      },
      topProducts,
      inventoryAlertsCount,
    };
  }
}
