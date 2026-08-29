const prisma = require('../config/db');

exports.checkIn = async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Account has been disbanded/disabled. Contact Admin.' });
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const existingToday = await prisma.attendance.findFirst({
      where: {
        userId,
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (existingToday) {
      return res.status(400).json({
        message: 'You have already marked your attendance for today. Multiple check-ins per day are not allowed.',
      });
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: now,
        inTime: now,
      },
    });

    return res.status(201).json({ message: 'Checked in successfully', attendance });
  } catch (error) {
    return res.status(500).json({ message: 'Check-in failed', error: error.message });
  }
};

exports.checkOut = async (req, res) => {
  const userId = req.user.id;
  const { task } = req.body;

  try {
    const activeShift = await prisma.attendance.findFirst({
      where: { userId, outTime: null },
      orderBy: { inTime: 'desc' },
    });

    if (!activeShift) {
      return res.status(400).json({ message: 'No active check-in found to check out from.' });
    }

    const outTime = new Date();
    const workingHours = parseFloat(((outTime - new Date(activeShift.inTime)) / (1000 * 60 * 60)).toFixed(2));

    const updatedAttendance = await prisma.attendance.update({
      where: { id: activeShift.id },
      data: {
        outTime,
        workingHours,
        task: task || activeShift.task,
      },
    });

    return res.status(200).json({ message: 'Checked out successfully', attendance: updatedAttendance });
  } catch (error) {
    return res.status(500).json({ message: 'Check-out failed', error: error.message });
  }
};

// Handle Overtime Claim / Request
exports.requestOvertime = async (req, res) => {
  const { attendanceId, overtimeHours } = req.body;

  if (!attendanceId || overtimeHours === undefined) {
    return res.status(400).json({ message: 'attendanceId and overtimeHours are required' });
  }

  const parsedHours = parseFloat(overtimeHours);
  if (isNaN(parsedHours) || parsedHours <= 0) {
    return res.status(400).json({ message: 'Overtime hours must be a positive number' });
  }

  try {
    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        overtimeHours: parsedHours,
        overtimeStatus: 'PENDING',
      },
    });

    return res.status(200).json({ message: 'Overtime request submitted for Admin review', attendance });
  } catch (error) {
    console.error('Submit Overtime Error:', error);
    return res.status(500).json({ message: 'Failed to submit overtime', error: error.message });
  }
};


// Route alias for claimOvertime so router.patch('/overtime/claim') does not crash
exports.claimOvertime = exports.requestOvertime;

exports.reviewOvertime = async (req, res) => {
  const { attendanceId, status } = req.body;

  try {
    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { overtimeStatus: status },
    });

    return res.status(200).json({ message: `Overtime ${status.toLowerCase()}`, attendance });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to review overtime', error: error.message });
  }
};

exports.assignTask = async (req, res) => {
  const { attendanceId, assignedTask } = req.body;

  try {
    const attendance = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { assignedTask },
    });

    return res.status(200).json({ message: 'Task assigned successfully', attendance });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to assign task', error: error.message });
  }
};

exports.getRecords = async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role === 'EMPLOYEE') {
      whereClause.userId = req.user.id;
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, baseSalary: true, isActive: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    return res.status(200).json({ records });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch records', error: error.message });
  }
};