import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  try {
    const rolesCount = await prisma.roles.count();

    if (rolesCount > 0) {
      console.log('Database already seeded');
      return;
    }

    const rolesData = [
      { name: 'User' },
      { name: 'Moderator' },
      { name: 'Admin' },
    ];

    await prisma.roles.createMany({
      data: rolesData,
      skipDuplicates: true,
    });

    const roles = await prisma.roles.findMany();

    const RoleIdMap = new Map<string, number>();

    roles.forEach((role) => {
      RoleIdMap.set(role.name, role.id);
    });

    const users = [
      {
        name: 'Admin User',
        email: 'admin@example.com',
        password: await bcryptjs.hash('Admin123!', 10),
        role: RoleIdMap.get('Admin') || 3,
      },
      {
        name: 'Moderator User',
        email: 'moderator@example.com',
        password: await bcryptjs.hash('Moderator123!', 10),
        role: RoleIdMap.get('Moderator') || 2,
      },
      {
        name: 'Regular User',
        email: 'user@example.com',
        password: await bcryptjs.hash('User123!', 10),
        role: RoleIdMap.get('User') || 1,
      },
    ];

    await prisma.user.createMany({
      data: users,
      skipDuplicates: true,
    });

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

main()
  .catch(async (e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
