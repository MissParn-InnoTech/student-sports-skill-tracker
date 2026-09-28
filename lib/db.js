/**
 * db.js - Prisma Client singleton
 * ป้องกันการสร้าง PrismaClient ซ้ำหลายตัวตอน hot-reload ใน dev mode ของ Next.js
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
