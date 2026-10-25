import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../generated/prisma/client";
import { getDatabaseUrl } from "./database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaSchema?: string };
// A client retained by hot reload still uses the schema it was constructed with.
// Regeneration must invalidate it, otherwise newly added scalar fields are omitted.
const metadata = Prisma as unknown as Record<string, unknown>;
const schema = JSON.stringify(Object.values(Prisma.ModelName).map(model => [model, metadata[`${model}ScalarFieldEnum`]]));

function createPrismaClient() {
  const connectionString = getDatabaseUrl();

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: ["error", "warn"],
  });
}

export const prisma = globalForPrisma.prisma && globalForPrisma.prismaSchema === schema
  ? globalForPrisma.prisma : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchema = schema;
}
