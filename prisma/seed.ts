import bcryptjs from 'bcryptjs';
import prisma from '../src/database/Prisma';

async function main() {
  const rolesData = [
    { name: 'User' },
    { name: 'Moderator' },
    { name: 'Admin' },
  ];

  await prisma.role.createMany({
    data: rolesData,
    skipDuplicates: true,
  });

  const roles = await prisma.role.findMany();
  const RoleIdMap = new Map<string, number>();
  roles.forEach((role) => {
    RoleIdMap.set(role.name, role.id);
  });

  // Create users and attach roles via UserRole
  const users = [
    {
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcryptjs.hash('Admin123!', 10),
      roleName: 'Admin',
    },
    {
      name: 'Moderator User',
      email: 'moderator@example.com',
      password: await bcryptjs.hash('Moderator123!', 10),
      roleName: 'Moderator',
    },
    {
      name: 'Regular User',
      email: 'user@example.com',
      password: await bcryptjs.hash('User123!', 10),
      roleName: 'User',
    },
  ];

  for (const user of users) {
    const role = RoleIdMap.get(user.roleName);
    if (!role) {
      console.error(`Role ${user.roleName} not found`);
      continue;
    }
    const userCreate = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password: user.password,
        email: user.email,
        isVerified: true,
      },
      create: {
        name: user.name,
        email: user.email,
        password: user.password,
        isVerified: true,
      },
    });

    const userRole = await prisma.userRole.findFirst({
      where: {
        userId: userCreate.id,
        roleId: role,
      },
      select: {
        id: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        id: userRole ? userRole.id : -1, // Use a non-existent ID to force creation if not found
      },
      update: {
        userId: userCreate.id,
        roleId: role,
      },
      create: {
        userId: userCreate.id,
        roleId: role,
      },
    });
  }

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
