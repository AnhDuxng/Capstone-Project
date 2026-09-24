import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client singleton for Next.js
 *
 * In development, Next.js hot-reloads modules — without this singleton,
 * each reload would create a new PrismaClient instance, eventually
 * exhausting the database connection pool.
 *
 * @see https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
