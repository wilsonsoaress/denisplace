import { PrismaClient } from '@prisma/client';

// Singleton: em dev o Next recarrega modulos a cada hot reload e cada recarga
// abriria um novo pool de conexoes contra o Postgres.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
