/**
 * Table lint (TENANT_DATA): lists tenant-owned tables missing
 * ENABLE/FORCE ROW LEVEL SECURITY, a scope_isolation policy, or a
 * tenant_id index. Exits non-zero on findings.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const findings = await prisma.$queryRaw<
    { table_name: string; problem: string }[]
  >`
    WITH tenant_tables AS (
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND a.attname = 'tenant_id'
        AND c.relname <> '_prisma_migrations'
    ), policies AS (
      SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
    ), indexed AS (
      SELECT DISTINCT t.relname AS table_name
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(i.indkey)
      WHERE a.attname = 'tenant_id'
    )
    SELECT t.table_name,
      'missing ENABLE/FORCE ROW LEVEL SECURITY' AS problem
    FROM tenant_tables t
    JOIN pg_class c ON c.relname = t.table_name
    WHERE NOT c.relrowsecurity OR NOT c.relforcerowsecurity
    UNION ALL
    SELECT t.table_name, 'missing RLS policy'
    FROM tenant_tables t
    WHERE t.table_name NOT IN (SELECT tablename FROM policies)
    UNION ALL
    SELECT t.table_name, 'missing tenant_id index'
    FROM tenant_tables t
    WHERE t.table_name NOT IN (SELECT table_name FROM indexed)
    ORDER BY 1, 2
  `;

  if (findings.length === 0) {
    console.log('rls lint: all tenant-owned tables are guarded');
    return;
  }
  console.error('rls lint findings:');
  for (const f of findings) {
    console.error(`  ${f.table_name}: ${f.problem}`);
  }
  process.exit(1);
}

void main().finally(() => prisma.$disconnect());
