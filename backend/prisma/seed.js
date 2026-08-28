const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  options: '-c search_path=attendance_app,public',
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const employeesData = [
  { name: 'Manik Dhiman', email: 'manik.dhiman.ug23@nsut.ac.in', baseSalary: 17000, role: 'ADMIN' },
  { name: 'Khyati', email: 'khyati@attendanceapp.internal', baseSalary: 17000, role: 'EMPLOYEE' },
  { name: 'Amrit', email: 'amrit@attendanceapp.internal', baseSalary: 15000, role: 'EMPLOYEE' },
  { name: 'Jitender', email: 'jitender@attendanceapp.internal', baseSalary: 27000, role: 'EMPLOYEE' },
  { name: 'Avi', email: 'avi@attendanceapp.internal', baseSalary: 10000, role: 'EMPLOYEE' },
  { name: 'Rhythem', email: 'rhythem@attendanceapp.internal', baseSalary: 15000, role: 'EMPLOYEE' },
];

const holidays2026 = [
  { title: 'Republic Day', date: new Date('2026-01-26') },
  { title: 'Holi', date: new Date('2026-03-04') },
  { title: 'Eid-ul-Fitr', date: new Date('2026-03-21') },
  { title: 'Independence Day', date: new Date('2026-08-15') },
  { title: 'Gandhi Jayanti', date: new Date('2026-10-02') },
  { title: 'Dussehra', date: new Date('2026-10-20') },
  { title: 'Diwali', date: new Date('2026-11-08') },
  { title: 'Christmas', date: new Date('2026-12-25') },
];

async function main() {
  const defaultPassword = await bcrypt.hash('Password@123', 10);

  // Upsert Employees
  for (const emp of employeesData) {
    await prisma.user.upsert({
      where: { email: emp.email },
      update: {
        name: emp.name,
        baseSalary: emp.baseSalary,
        role: emp.role,
        isActive: true,
      },
      create: {
        name: emp.name,
        email: emp.email,
        password: defaultPassword,
        role: emp.role,
        baseSalary: emp.baseSalary,
        overtimeRate: 150.0,
        isActive: true,
      },
    });
    console.log(`Synced user: ${emp.name} (₹${emp.baseSalary})`);
  }

  // Upsert Holidays
  for (const h of holidays2026) {
    await prisma.holiday.upsert({
      where: { date: h.date },
      update: { title: h.title },
      create: { title: h.title, date: h.date },
    });
  }
  console.log('Synced standard paid festival holidays.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });