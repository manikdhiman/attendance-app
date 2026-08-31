// backend/seed_team.js
require('dotenv').config();
const prisma = require('./src/config/db'); // Uses your project's configured Prisma client
const bcrypt = require('bcryptjs');

const teamMembers = [
  // Admins
  {
    name: 'Manik Dhiman',
    email: 'manikdhiman2005@gmail.com',
    role: 'ADMIN',
    passwordRaw: 'manik@123',
    baseSalary: 17000,
  },
  {
    name: 'Boss (CEO)',
    email: 'ceo@bisconsultancyservices.com',
    role: 'ADMIN',
    passwordRaw: 'ceo@123',
    baseSalary: 0,
  },
  {
    name: 'Rhythm (General Manager)',
    email: 'generalmanagerR023@gmail.com',
    role: 'ADMIN',
    passwordRaw: 'rhythm@123',
    baseSalary: 0,
  },

  // Employees
  {
    name: 'Amrit',
    email: 'kaur2026jk@gmail.com',
    role: 'EMPLOYEE',
    passwordRaw: 'amrit@123',
    baseSalary: 15000,
  },
  {
    name: 'Khyati',
    email: 'khyati0227@gmail.com',
    role: 'EMPLOYEE',
    passwordRaw: 'khyati@123',
    baseSalary: 17000,
  },
  {
    name: 'Avi',
    email: 'sethighanisth@gmail.com',
    role: 'EMPLOYEE',
    passwordRaw: 'avi@123',
    baseSalary: 10000,
  },
  {
    name: 'Jitender',
    email: 'jitender.biscs@gmail.com',
    role: 'EMPLOYEE',
    passwordRaw: 'jitender@123',
    baseSalary: 27000,
  },
  {
    name: 'Hemant',
    email: 'hemantlamba741@gmail.com',
    role: 'EMPLOYEE',
    passwordRaw: 'hemant@123',
    baseSalary: 15000,
  },
];

async function seed() {
  console.log('🔄 Cleaning old dummy/stray users...');

  const allowedEmails = teamMembers.map((m) => m.email.toLowerCase());

  // 1. Delete all users not in our official team list
  const usersToDelete = await prisma.user.findMany({
    where: {
      email: { notIn: allowedEmails },
    },
  });

  for (const user of usersToDelete) {
    await prisma.attendance.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`❌ Removed dummy user: ${user.email}`);
  }

  console.log('\n🚀 Seeding/Updating official team accounts...');

  for (const member of teamMembers) {
    const hashedPassword = await bcrypt.hash(member.passwordRaw, 10);

    const user = await prisma.user.upsert({
      where: { email: member.email.toLowerCase() },
      update: {
        name: member.name,
        role: member.role,
        password: hashedPassword,
        baseSalary: member.baseSalary,
        overtimeRate: 0,
        isActive: true,
        adminRequestStatus: member.role === 'ADMIN' ? 'APPROVED' : 'NONE',
      },
      create: {
        name: member.name,
        email: member.email.toLowerCase(),
        role: member.role,
        password: hashedPassword,
        baseSalary: member.baseSalary,
        overtimeRate: 0,
        isActive: true,
        adminRequestStatus: member.role === 'ADMIN' ? 'APPROVED' : 'NONE',
      },
    });

    console.log(`✅ [${user.role}] ${user.name} (${user.email}) -> Password: ${member.passwordRaw}`);
  }

  console.log('\n🎉 Team seeding completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });