// Prisma client singleton — Infrastructure only
// Domain and Application MUST NOT import this file.

import { PrismaClient } from '@restaurant-os/database';

export const prisma = new PrismaClient();
