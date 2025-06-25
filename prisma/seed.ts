import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('123456789', 10);

  const user = await prisma.user.create({
    data: {
      name: 'Trần Đình Kiên',
      dateOfBirth: new Date('2003-05-07'),
      address: 'TP HCM',
      citizenId: '1234567890',
      avatar:
        'https://res.cloudinary.com/dxxsudprj/image/upload/v1733839978/Anime_Characters_cnkjji.jpg',
      gender: 'male',
      role: 'DOCTOR',
      auth: {
        create: {
          phone: '0325421881',
          email: 'test@example.com',
          password,
        },
      },
    },
  });
  console.log('Seeded user:', user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  .finally(() => prisma.$disconnect());
