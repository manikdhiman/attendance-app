const prisma = require('../config/db');
const bcrypt = require('bcryptjs');

// Get all employees for the admin management table and dropdown
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        baseSalary: true,
        overtimeRate: true,
        isActive: true,
        adminRequestStatus: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    // Return direct array for cleaner frontend mapping
    return res.status(200).json(users);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
};

// Admin updates employee details (name, email, baseSalary, overtimeRate, password)
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const { name, email, baseSalary, overtimeRate, password, isActive } = req.body;

  try {
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (baseSalary !== undefined) updateData.baseSalary = parseFloat(baseSalary);
    if (overtimeRate !== undefined) updateData.overtimeRate = parseFloat(overtimeRate);
    if (isActive !== undefined) updateData.isActive = isActive;

    if (password && password.trim().length > 0) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, baseSalary: true, overtimeRate: true, isActive: true },
    });

    return res.status(200).json({ message: 'User details updated successfully', user });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update user', error: error.message });
  }
};

// Toggle Disband / Ban Account
exports.toggleBanUser = async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
    });
    return res.status(200).json({ message: `User account ${isActive ? 'activated' : 'disbanded/banned'}.`, user });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to modify user status', error: error.message });
  }
};

// Permanently Delete Employee Account
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id } });
    return res.status(200).json({ message: 'Employee account and related records deleted permanently' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete user', error: error.message });
  }
};

// Holiday Management - Get all holidays
exports.getHolidays = async (req, res) => {
  try {
    const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
    // Return direct array for calendar matching
    return res.status(200).json(holidays);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch holidays', error: error.message });
  }
};

// Add a new festival/public holiday
exports.addHoliday = async (req, res) => {
  const { title, date } = req.body;
  try {
    const newHoliday = await prisma.holiday.create({
      data: {
        title,
        date: new Date(date),
      },
    });
    return res.status(201).json(newHoliday);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to add holiday', error: error.message });
  }
};

// Approve or Reject Admin Role Requests
exports.reviewAdminRequest = async (req, res) => {
  const { userId, approve } = req.body;

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        role: approve ? 'ADMIN' : 'EMPLOYEE',
        adminRequestStatus: approve ? 'APPROVED' : 'REJECTED',
      },
    });

    return res.status(200).json({
      message: `User is now ${approve ? 'an Admin' : 'an Employee (Request Rejected)'}`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update admin role', error: error.message });
  }
};