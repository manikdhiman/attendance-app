const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

exports.register = async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email is already registered' });
    }

    let assignedRole = 'EMPLOYEE';

    if (role === 'ADMIN') {
      const existingAdmin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
      });

      if (existingAdmin) {
        return res.status(403).json({
          message: 'An Admin account already exists. Only existing Admins can create new Admins.',
        });
      }
      assignedRole = 'ADMIN';
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: assignedRole,
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.status(201).json({ message: 'User registered successfully', user });
  } catch (error) {
    console.error('Registration Error Details:', error); // Logs directly to PowerShell
    return res.status(500).json({ message: error.message || 'Registration failed' });
  }
};
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been disbanded/disabled by Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed', error: error.message });
  }
};