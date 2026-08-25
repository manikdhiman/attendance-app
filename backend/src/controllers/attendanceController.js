const prisma = require('../config/db');

// 1. Check-in (Starts the shift)
exports.checkIn = async (req, res) => {
  const userId = req.user.id;

  try {
    // Check if the user already checked in today without checking out
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId,
        createdAt: { gte: today },
        outTime: null,
      },
    });

    if (activeSession) {
      return res.status(400).json({ message: 'You have already checked in for today.' });
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        inTime: new Date(),
      },
    });

    return res.status(201).json({ message: 'Checked in successfully', attendance });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking in', error: error.message });
  }
};

// 2. Check-out (Ends the shift & calculates working hours)
exports.checkOut = async (req, res) => {
  const userId = req.user.id;
  const { task } = req.body;

  try {
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId,
        outTime: null,
      },
      orderBy: { inTime: 'desc' },
    });

    if (!activeSession) {
      return res.status(400).json({ message: 'No active check-in found to check out from.' });
    }

    const outTime = new Date();
    const inTime = new Date(activeSession.inTime);

    // Calculate total hours worked in decimal (e.g. 8.5)
    const diffMs = outTime - inTime;
    const workingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    const updatedAttendance = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        outTime,
        workingHours,
        task: task || activeSession.task,
      },
    });

    return res.status(200).json({ message: 'Checked out successfully', attendance: updatedAttendance });
  } catch (error) {
    return res.status(500).json({ message: 'Error checking out', error: error.message });
  }
};

// 3. Update or Log Daily Task
exports.updateTask = async (req, res) => {
  const userId = req.user.id;
  const { attendanceId, task } = req.body;

  try {
    const record = await prisma.attendance.findUnique({ where: { id: attendanceId } });

    if (!record || record.userId !== userId) {
      return res.status(404).json({ message: 'Attendance record not found or unauthorized' });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { task },
    });

    return res.status(200).json({ message: 'Task updated successfully', attendance: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating task', error: error.message });
  }
};

// 4. Request Overtime (Employee submits, sets status to PENDING)
exports.requestOvertime = async (req, res) => {
  const userId = req.user.id;
  const { attendanceId, overtimeHours } = req.body;

  try {
    const record = await prisma.attendance.findUnique({ where: { id: attendanceId } });

    if (!record || record.userId !== userId) {
      return res.status(404).json({ message: 'Attendance record not found or unauthorized' });
    }

    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        overtimeHours: parseFloat(overtimeHours),
        overtimeStatus: 'PENDING',
      },
    });

    return res.status(200).json({ message: 'Overtime request submitted for approval', attendance: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Error requesting overtime', error: error.message });
  }
};

// 5. Fetch Attendance (Employee sees own, Admin sees all)
exports.getAttendanceRecords = async (req, res) => {
  const { role, id: userId } = req.user;
  const { employeeId, date } = req.query;

  try {
    let whereClause = {};

    if (role === 'EMPLOYEE') {
      whereClause.userId = userId;
    } else if (role === 'ADMIN') {
      if (employeeId) whereClause.userId = employeeId;
      if (date) {
        const queryDate = new Date(date);
        const nextDay = new Date(date);
        nextDay.setDate(queryDate.getDate() + 1);
        whereClause.date = { gte: queryDate, lt: nextDay };
      }
    }

    const records = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { inTime: 'desc' },
    });

    return res.status(200).json({ records });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching records', error: error.message });
  }
};

// 6. Admin: Assign Task to Employee for a specific day
exports.assignTask = async (req, res) => {
  const { attendanceId, assignedTask } = req.body;

  try {
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { assignedTask },
    });

    return res.status(200).json({ message: 'Task assigned successfully', attendance: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Error assigning task', error: error.message });
  }
};

// 7. Admin: Approve or Reject Overtime
exports.reviewOvertime = async (req, res) => {
  const { attendanceId, status } = req.body; // status: "APPROVED" | "REJECTED"

  if (!['APPROVED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ message: 'Status must be APPROVED or REJECTED' });
  }

  try {
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { overtimeStatus: status },
    });

    return res.status(200).json({ message: `Overtime ${status.toLowerCase()} successfully`, attendance: updated });
  } catch (error) {
    return res.status(500).json({ message: 'Error reviewing overtime', error: error.message });
  }
};