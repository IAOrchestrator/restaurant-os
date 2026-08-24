// Database package — single source of truth for Prisma
// This is the ONLY package that depends on @prisma/client directly.
// All other packages import PrismaClient and Prisma from here.

export { PrismaClient, Prisma } from '@prisma/client';
export type {
  Restaurant,
  Staff,
  StaffRoleAssignment,
  Customer,
  Table,
  TableDevice,
  TableSession,
  WaitlistEntry,
  PreOrder,
  Order,
  Account,
  Payment,
  Category,
  Product,
  KitchenOrder,
  ServiceTask,
  EventLog,
  Review,
} from '@prisma/client';
