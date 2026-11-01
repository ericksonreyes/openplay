/**
 * Canonical seeds run on every environment: the permission/role catalog and
 * the platform.admin identity. Demo fixtures are gated behind SEED_DEMO.
 * Idempotent — safe to re-run (`npm run db:seed`).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();

const PERMISSIONS = [
  ['platform.tenants.manage', 'Manage tenant lifecycle'],
  ['platform.settings.manage', 'Manage platform settings'],
  ['venue.config.manage', 'Configure venues, resources, and rules'],
  ['bookings.manage', 'Create and manage bookings'],
  ['bookings.view', 'View bookings'],
  ['events.manage', 'Create and manage events'],
  ['checkin.perform', 'Check in attendees'],
  ['memberships.manage', 'Manage membership plans'],
  ['memberships.purchase', 'Purchase memberships'],
  ['rentals.manage', 'Manage equipment rentals'],
  ['payments.manage', 'Manage payments and refunds'],
  ['disputes.manage', 'Handle disputes'],
] as const;

const ROLES: Record<string, { name: string; permissions: string[] }> = {
  'platform.admin': {
    name: 'Platform Administrator',
    permissions: ['platform.tenants.manage', 'platform.settings.manage'],
  },
  'business.owner': {
    name: 'Business Owner',
    permissions: [
      'venue.config.manage', 'bookings.manage', 'bookings.view', 'events.manage',
      'checkin.perform', 'memberships.manage', 'rentals.manage',
      'payments.manage', 'disputes.manage',
    ],
  },
  'venue.manager': {
    name: 'Venue Manager',
    permissions: [
      'venue.config.manage', 'bookings.manage', 'bookings.view', 'events.manage',
      'checkin.perform', 'memberships.manage', 'rentals.manage', 'disputes.manage',
    ],
  },
  'venue.staff': {
    name: 'Venue Staff',
    permissions: ['bookings.view', 'checkin.perform'],
  },
  player: {
    name: 'Player',
    permissions: ['memberships.purchase'],
  },
};

async function upsertPermission(key: string, name: string): Promise<string> {
  const row = await prisma.iamPermission.upsert({
    where: { key },
    update: { name },
    create: { id: uuidv7(), key, name },
  });
  return row.id;
}

async function upsertRole(key: string, name: string, permissionIds: string[]): Promise<string> {
  const role = await prisma.iamRole.upsert({
    where: { key },
    update: { name },
    create: { id: uuidv7(), key, name },
  });
  for (const permissionId of permissionIds) {
    await prisma.iamRolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      update: {},
      create: { roleId: role.id, permissionId },
    });
  }
  return role.id;
}

async function upsertUser(input: {
  scope: string;
  username?: string;
  email?: string;
  password?: string;
  displayName?: string;
  tenantId?: string;
  roleId?: string;
}): Promise<void> {
  const existing = await prisma.iamUser.findFirst({
    where: { scope: input.scope, username: input.username ?? undefined, email: input.email ?? undefined },
  });
  const data = {
    scope: input.scope,
    username: input.username,
    email: input.email,
    passwordHash: input.password ? await bcrypt.hash(input.password, 10) : undefined,
    displayName: input.displayName,
    tenantId: input.tenantId,
  };
  const user = existing
    ? await prisma.iamUser.update({ where: { id: existing.id }, data })
    : await prisma.iamUser.create({ data: { id: uuidv7(), ...data } });
  if (input.roleId) {
    await prisma.iamUserRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: input.roleId } },
      update: {},
      create: { userId: user.id, roleId: input.roleId },
    });
  }
}

async function main(): Promise<void> {
  const permissionIds = new Map<string, string>();
  for (const [key, name] of PERMISSIONS) {
    permissionIds.set(key, await upsertPermission(key, name));
  }

  const roleIds = new Map<string, string>();
  for (const [key, role] of Object.entries(ROLES)) {
    roleIds.set(
      key,
      await upsertRole(key, role.name, role.permissions.map((p) => permissionIds.get(p)!)),
    );
  }

  await upsertUser({
    scope: 'platform',
    username: 'platform.admin',
    email: 'platform.admin@demo.openplay.test',
    password: process.env.PLATFORM_ADMIN_PASSWORD ?? 'demo-pass-123',
    displayName: 'Platform Admin',
    roleId: roleIds.get('platform.admin'),
  });
  console.log('canonical seeds applied (permission/role catalog + platform.admin)');

  if (process.env.SEED_DEMO === 'true') {
    const acme = await prisma.tenant.upsert({
      where: { code: 'acme' },
      update: {},
      create: { id: uuidv7(), code: 'acme', name: 'Acme Sports Club', status: 'active', published: true, details: { description: 'Demo multi-sport club with bookable courts and open play sessions.', logo: null, images: [], links: { website: 'https://acme.demo.openplay.test' } } },
    });
    const bayside = await prisma.tenant.upsert({
      where: { code: 'bayside' },
      update: {},
      create: { id: uuidv7(), code: 'bayside', name: 'Bayside Courts', status: 'active', published: true },
    });
    const acmeTenant = acme.id;
    const baysideTenant = bayside.id;
    const demoPassword = 'demo-pass-123';
    const demo = [
      { scope: 'tenant', username: 'acme.owner', displayName: 'Acme Owner', tenantId: acmeTenant, roleId: roleIds.get('business.owner') },
      { scope: 'tenant', username: 'acme.manager', displayName: 'Acme Manager', tenantId: acmeTenant, roleId: roleIds.get('venue.manager') },
      { scope: 'tenant', username: 'acme.staff', displayName: 'Acme Staff', tenantId: acmeTenant, roleId: roleIds.get('venue.staff') },
      { scope: 'tenant', username: 'bayside.owner', displayName: 'Bayside Owner', tenantId: baysideTenant, roleId: roleIds.get('business.owner') },
      { scope: 'platform', username: 'jane.player', email: 'jane.player@demo.openplay.test', displayName: 'Jane Player', roleId: roleIds.get('player') },
      { scope: 'platform', username: 'pio.player', email: 'pio.player@demo.openplay.test', displayName: 'Pio Player', roleId: roleIds.get('player') },
    ];
    for (const u of demo) {
      await upsertUser({ ...u, password: demoPassword });
    }
    console.log('demo fixtures applied (SEED_DEMO=true)');
  }
}

main().finally(() => prisma.$disconnect());
