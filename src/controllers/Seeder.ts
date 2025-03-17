import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import prisma from '../database/Prisma';

async function seed(req: Request, res: Response) {
  try {
    const { secret } = req.params;

    if (secret !== process.env.SESSION_SECRET) {
      return res.status(401).json({ message: 'Unauthorized' });
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
    return res
      .status(200)
      .json({ message: 'Database seeding completed successfully!' });
  } catch (error) {
    console.error('Error seeding database:', error);
    return res.status(500).json({ message: 'Error seeding database' });
  }
}

export default seed;
