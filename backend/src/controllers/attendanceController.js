const prisma = require('../config/db');

// --- HELPER: Safely parse vector to standard 128-float array ---
function parseDescriptor(raw) {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  // Convert object with numeric keys (e.g. { '0': -0.12, '1': 0.05 }) or TypedArray into normal Array
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    parsed = Object.values(parsed);
  }
  return Array.isArray(parsed) ? parsed.map(Number) : null;
}

// --- HELPER: Compute Euclidean Distance between two 128-d vectors ---
function computeFaceDistance(desc1, desc2) {
  const d1 = parseDescriptor(desc1);
  const d2 = parseDescriptor(desc2);

  if (!d1 || !d2 || d1.length !== 128 || d2.length !== 128) {
    console.warn(`[BIOMETRIC] Invalid descriptor shape: d1=${d1?.length}, d2=${d2?.length}`);
    return 1.0;
  }

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// 0.55 is the standard threshold: strictly rejects strangers (typically 0.68-0.95+) while accommodating real-world webcam variations (typically 0.35-0.52)
const MATCH_THRESHOLD = 0.55;

exports.checkIn = async (req, res) => {
  const userId = req.user.id;
  const { latitude, longitude, photo, faceDescriptor } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Account has been disbanded/disabled. Contact Admin.' });
    }

    /* --- BIOMETRIC VERIFICATION --- */
    if (!user.faceDescriptor) {
      return res.status(403).json({
        message: 'No registered facial profile found. Please contact Admin for enrollment.',
      });
    }

    const liveVector = parseDescriptor(faceDescriptor);
    if (!liveVector || liveVector.length !== 128) {
      return res.status(400).json({
        message: 'Valid 128-point face scan required. Ensure good lighting and look straight at the lens.',
      });
    }

    const distance = computeFaceDistance(liveVector, user.faceDescriptor);
    console.log(`[BIOMETRIC CHECK-IN] User: ${user.email} | Score: ${distance.toFixed(3)} | Threshold: ${MATCH_THRESHOLD}`);

    if (distance > MATCH_THRESHOLD) {
      return res.status(401).json({
        message: `Biometric Verification Failed! Face does not match registered employee (${user.name}). Distance: ${distance.toFixed(2)}`,
      });
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
        latitude: latitude ? String(latitude) : null,
        longitude: longitude ? String(longitude) : null,
        photo: photo || null,
      },
    });

    return res.status(201).json({ message: 'Checked in successfully (Face Verified)', attendance });
  } catch (error) {
    console.error('CheckIn error:', error);
    return res.status(500).json({ message: 'Check-in failed', error: error.message });
  }
};

exports.checkOut = async (req, res) => {
  const userId = req.user.id;
  const { task, latitude, longitude, photo, faceDescriptor } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Account has been disbanded/disabled. Contact Admin.' });
    }

    /* --- BIOMETRIC VERIFICATION --- */
    if (user.faceDescriptor) {
      const liveVector = parseDescriptor(faceDescriptor);
      if (!liveVector || liveVector.length !== 128) {
        return res.status(400).json({
          message: 'Valid facial scan is required to check out.',
        });
      }

      const distance = computeFaceDistance(liveVector, user.faceDescriptor);
      console.log(`[BIOMETRIC CHECK-OUT] User: ${user.email} | Score: ${distance.toFixed(3)} | Threshold: ${MATCH_THRESHOLD}`);

      if (distance > MATCH_THRESHOLD) {
        return res.status(401).json({
          message: `Biometric Verification Failed! Face does not match registered employee (${user.name}). Distance: ${distance.toFixed(2)}`,
        });
      }
    }

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
        latitude: latitude ? String(latitude) : activeShift.latitude,
        longitude: longitude ? String(longitude) : activeShift.longitude,
        photo: photo || activeShift.photo,
      },
    });

    return res.status(200).json({ message: 'Checked out successfully (Face Verified)', attendance: updatedAttendance });
  } catch (error) {
    console.error('CheckOut error:', error);
    return res.status(500).json({ message: 'Check-out failed', error: error.message });
  }
};

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