import bcryptjs from 'bcryptjs';
import prisma from '@database/Prisma';

async function main() {
  const rolesData = [{ name: 'User' }, { name: 'Hospital' }, { name: 'Admin' }];

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

  const promises = users.map((user) =>
    prisma.user.upsert({
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
        Role: {
          connect: { name: user.roleName },
        },
      },
    }),
  );

  await Promise.all(promises);

  console.log('Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
