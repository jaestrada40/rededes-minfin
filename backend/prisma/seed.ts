import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

const ROLE_NAMES = ['admin', 'editor', 'auditor', 'viewer'] as const;

async function main() {
  for (const name of ROLE_NAMES) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@minfin.gob.gt';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Administrador DTI',
      roleId: adminRole.id,
      mfaEnabled: false,
    },
  });

  await prisma.systemSettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      webhookSecret: crypto.randomBytes(32).toString('hex'),
      allowedCorsDomains: [],
      officialAccounts: {},
    },
  });

  console.log(`Seed completo. Usuario admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
