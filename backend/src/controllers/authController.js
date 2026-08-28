const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

// Registration logic:
// - manikdhiman2005@gmail.com is auto-promoted to ADMIN
// - If user requests Admin, role starts as EMPLOYEE and adminRequestStatus becomes 'PENDING'
// - Every new employee is isActive: true by default
exports.register = async (req, res) => {
  const { name, email, password, requestAdminRole } = req.body;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const isSuperAdminEmail = email.toLowerCase() === 'manikdhiman2005@gmail.com';

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: isSuperAdminEmail ? 'ADMIN' : 'EMPLOYEE',
        isActive: true, // Always active upon signup
        adminRequestStatus: isSuperAdminEmail ? 'APPROVED' : requestAdminRole ? 'PENDING' : 'NONE',
        baseSalary: 17000.0,
        overtimeRate: 150.0,
      },
    });

    return res.status(201).json({
      message: isSuperAdminEmail
        ? 'Super Admin account created successfully'
        : requestAdminRole
        ? 'Account created. Admin privileges are pending approval by Super Admin.'
        : 'Account created successfully',
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Auto-fix: Ensure primary admin email is always active and ADMIN role
    if (email.toLowerCase() === 'manikdhiman2005@gmail.com' && (!user.isActive || user.role !== 'ADMIN')) {
      await prisma.user.update({
        where: { email },
        data: { isActive: true, role: 'ADMIN', adminRequestStatus: 'APPROVED' },
      });
      user.isActive = true;
      user.role = 'ADMIN';
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Your account has been disbanded/disabled by Admin.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
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