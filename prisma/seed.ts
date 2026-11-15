import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gridwatch.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!Secure';
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminPhone = process.env.ADMIN_PHONE || '+8801700000000';

  const defaultUserPassword = 'User123!Secure';
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
  const hashedUserPassword = await bcrypt.hash(defaultUserPassword, 10);

  // 1. Seed Distribution Zones
  console.log('📍 Seeding Zones...');
  const zoneNorth = await prisma.zone.upsert({
    where: { code: 'ZONE-DHAKA-NORTH' },
    update: {},
    create: {
      name: 'Dhaka North Distribution Zone',
      code: 'ZONE-DHAKA-NORTH',
      description: 'North electricity supply grid covering Gulshan, Banani, Uttara, and Mirpur.',
    },
  });

  const zoneSouth = await prisma.zone.upsert({
    where: { code: 'ZONE-DHAKA-SOUTH' },
    update: {},
    create: {
      name: 'Dhaka South Distribution Zone',
      code: 'ZONE-DHAKA-SOUTH',
      description: 'South electricity supply grid covering Dhanmondi, Motijheel, and Old Dhaka.',
    },
  });

  // 2. Seed Substations
  console.log('⚡ Seeding Substations...');
  const subGulshan = await prisma.substation.upsert({
    where: { code: 'SUB-GULSHAN-01' },
    update: {},
    create: {
      name: 'Gulshan 132/33kV Grid Substation',
      code: 'SUB-GULSHAN-01',
      zoneId: zoneNorth.id,
      capacityKva: 100000,
    },
  });

  const subDhanmondi = await prisma.substation.upsert({
    where: { code: 'SUB-DHANMONDI-01' },
    update: {},
    create: {
      name: 'Dhanmondi 132/33kV Grid Substation',
      code: 'SUB-DHANMONDI-01',
      zoneId: zoneSouth.id,
      capacityKva: 80000,
    },
  });

  // 3. Seed Feeders
  console.log('🔌 Seeding Feeders...');
  const feederGulshanRes = await prisma.feeder.upsert({
    where: { code: 'FDR-GUL-RES-01' },
    update: {},
    create: {
      name: 'Gulshan Residential Feeder 01',
      code: 'FDR-GUL-RES-01',
      substationId: subGulshan.id,
      maxLoadKw: 15000,
    },
  });

  const feederBananiCom = await prisma.feeder.upsert({
    where: { code: 'FDR-BAN-COM-01' },
    update: {},
    create: {
      name: 'Banani Commercial Feeder 01',
      code: 'FDR-BAN-COM-01',
      substationId: subGulshan.id,
      maxLoadKw: 20000,
    },
  });

  const feederDhanmondiRes = await prisma.feeder.upsert({
    where: { code: 'FDR-DHN-RES-01' },
    update: {},
    create: {
      name: 'Dhanmondi Residential Feeder 01',
      code: 'FDR-DHN-RES-01',
      substationId: subDhanmondi.id,
      maxLoadKw: 18000,
    },
  });

  // 4. Seed Areas
  console.log('🏘️  Seeding Areas...');
  const areaGulshan2 = await prisma.area.upsert({
    where: { id: 'area-gulshan-2-c' },
    update: {},
    create: {
      id: 'area-gulshan-2-c',
      name: 'Gulshan-2 Sector C',
      postalCode: '1212',
      feederId: feederGulshanRes.id,
    },
  });

  const areaBananiR11 = await prisma.area.upsert({
    where: { id: 'area-banani-r11' },
    update: {},
    create: {
      id: 'area-banani-r11',
      name: 'Banani Road 11 Commercial Strip',
      postalCode: '1213',
      feederId: feederBananiCom.id,
    },
  });

  const areaDhanmondi27 = await prisma.area.upsert({
    where: { id: 'area-dhanmondi-27' },
    update: {},
    create: {
      id: 'area-dhanmondi-27',
      name: 'Dhanmondi Road 27 Residential Area',
      postalCode: '1209',
      feederId: feederDhanmondiRes.id,
    },
  });

  // 5. Seed Users (ADMIN, POWER_OPERATOR, CUSTOMER)
  console.log('👤 Seeding Users...');
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      role: Role.ADMIN,
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: hashedAdminPassword,
      phone: adminPhone,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@gridwatch.com' },
    update: {
      role: Role.POWER_OPERATOR,
      isActive: true,
    },
    create: {
      name: 'Chief Grid Operator',
      email: 'operator@gridwatch.com',
      passwordHash: hashedUserPassword,
      phone: '+8801800000001',
      role: Role.POWER_OPERATOR,
      isActive: true,
    },
  });

  const customer = await prisma.user.upsert({
    where: { email: 'customer@gridwatch.com' },
    update: {
      role: Role.CUSTOMER,
      areaId: areaGulshan2.id,
      isActive: true,
    },
    create: {
      name: 'Tariq Rahman',
      email: 'customer@gridwatch.com',
      passwordHash: hashedUserPassword,
      phone: '+8801900000001',
      role: Role.CUSTOMER,
      areaId: areaGulshan2.id,
      isActive: true,
    },
  });

  // 6. Seed Technicians
  console.log('🔧 Seeding Technicians...');
  await prisma.technician.upsert({
    where: { id: 'tech-rahim-01' },
    update: {},
    create: {
      id: 'tech-rahim-01',
      name: 'Rahim Uddin',
      phone: '+8801711111111',
      specialization: 'High-Voltage Line & Transformer Repair',
      zoneId: zoneNorth.id,
      isAvailable: true,
    },
  });

  await prisma.technician.upsert({
    where: { id: 'tech-karim-02' },
    update: {},
    create: {
      id: 'tech-karim-02',
      name: 'Karim Hossain',
      phone: '+8801722222222',
      specialization: 'Underground Cable & Feeder Specialist',
      zoneId: zoneNorth.id,
      isAvailable: true,
    },
  });

  await prisma.technician.upsert({
    where: { id: 'tech-jamil-03' },
    update: {},
    create: {
      id: 'tech-jamil-03',
      name: 'Jamil Ahmed',
      phone: '+8801733333333',
      specialization: 'Substation Switchgear & Distribution Panels',
      zoneId: zoneSouth.id,
      isAvailable: true,
    },
  });

  console.log('✅ Database seed completed successfully!');
  console.log(`   Admin:    ${admin.email}`);
  console.log(`   Operator: ${operator.email}`);
  console.log(`   Customer: ${customer.email}`);
}

main()
  .catch((e) => {
    console.error('❌ Error during database seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
