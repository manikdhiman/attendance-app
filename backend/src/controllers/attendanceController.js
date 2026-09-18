const prisma = require('../config/db');
const { uploadAttendancePhoto } = require('../utils/supabaseStorage');

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
    return 1.0;
  }

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = d1[i] - d2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

// --- HELPER: Match against single vector OR multi-angle array [[128], [128], [128]] ---
function getBestMatchDistance(liveVector, storedDescriptor) {
  let parsed = storedDescriptor;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return 1.0;
    }
  }

  // If stored as multi-angle array: [ [128 floats], [128 floats], ... ]
  if (Array.isArray(parsed) && Array.isArray(parsed[0])) {
    let minDistance = 1.0;
    for (const refVec of parsed) {
      const dist = computeFaceDistance(liveVector, refVec);
      if (dist < minDistance) minDistance = dist;
    }
    return minDistance;
  }

  // Single vector fallback
  return computeFaceDistance(liveVector, parsed);
}

const MATCH_THRESHOLD = 0.55;

exports.checkIn = async (req, res) => {
  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Missing user authentication token.' });
  }

  const { latitude, longitude, photo, faceDescriptor } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Account has been disbanded/disabled. Contact Admin.' });
    }

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

    const distance = getBestMatchDistance(liveVector, user.faceDescriptor);
    console.log(`[BIOMETRIC CHECK-IN] User: ${user.email} | Best Score: ${distance.toFixed(3)} | Threshold: ${MATCH_THRESHOLD}`);

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

    // Offload photo to Supabase Storage bucket (stores lightweight URL, not raw base64)
    const photoUrl = await uploadAttendancePhoto(photo, userId, 'checkin');

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        date: now,
        inTime: now,
        checkInLat: latitude ? parseFloat(latitude) : null,
        checkInLng: longitude ? parseFloat(longitude) : null,
        checkInPhoto: photoUrl || null,
      },
    });

    return res.status(201).json({ message: 'Checked in successfully (Face Verified)', attendance });
  } catch (error) {
    console.error('CheckIn error:', error);
    return res.status(500).json({ message: 'Check-in failed', error: error.message });
  }
};

exports.checkOut = async (req, res) => {
  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: Missing user authentication token.' });
  }

  const { task, latitude, longitude, photo, faceDescriptor } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      return res.status(403).json({ message: 'Account has been disbanded/disabled. Contact Admin.' });
    }

    if (user.faceDescriptor) {
      const liveVector = parseDescriptor(faceDescriptor);
      if (!liveVector || liveVector.length !== 128) {
        return res.status(400).json({
          message: 'Valid facial scan is required to check out.',
        });
      }

      const distance = getBestMatchDistance(liveVector, user.faceDescriptor);
      console.log(`[BIOMETRIC CHECK-OUT] User: ${user.email} | Best Score: ${distance.toFixed(3)} | Threshold: ${MATCH_THRESHOLD}`);

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

    // Offload photo to Supabase Storage bucket
    const photoUrl = await uploadAttendancePhoto(photo, userId, 'checkout');

    const updatedAttendance = await prisma.attendance.update({
      where: { id: activeShift.id },
      data: {
        outTime,
        workingHours,
        task: task || activeShift.task,
        checkOutLat: latitude ? parseFloat(latitude) : activeShift.checkOutLat,
        checkOutLng: longitude ? parseFloat(longitude) : activeShift.checkOutLng,
        checkOutPhoto: photoUrl || activeShift.checkOutPhoto,
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
    const userId = req.user?.id || req.user?.userId;
    let whereClause = {};
    if (req.user?.role === 'EMPLOYEE') {
      whereClause.userId = userId;
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

// --- Check if Current Logged-in User Has an Enrolled Face ---
exports.getBiometricStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized: No token credentials found.' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, faceDescriptor: true },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const hasFaceEnrolled = Boolean(
      user.faceDescriptor &&
      (typeof user.faceDescriptor === 'string' ? user.faceDescriptor.trim().length > 2 : true)
    );

    return res.status(200).json({ hasFaceEnrolled });
  } catch (error) {
    console.error('getBiometricStatus error:', error);
    return res.status(500).json({ message: 'Failed to check status', error: error.message });
  }
};

// --- First-Time Face Registration for the Logged-In User ---
exports.registerSelfFace = async (req, res) => {
  const userId = req.user?.id || req.user?.userId;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: No token credentials found.' });
  }

  const { faceDescriptor } = req.body;
  if (!faceDescriptor) {
    return res.status(400).json({ message: 'Face descriptor is required.' });
  }

  try {
    // Determine format to support String or Json Prisma columns
    const descriptorData = typeof faceDescriptor === 'string' 
      ? faceDescriptor 
      : JSON.stringify(faceDescriptor);

    let updatedUser;
    try {
      // First attempt: string representation (standard Text column)
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { faceDescriptor: descriptorData },
        select: { id: true, name: true, email: true },
      });
    } catch (prismaTypeErr) {
      // Fallback: If schema is defined as Json type instead of String
      updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { faceDescriptor },
        select: { id: true, name: true, email: true },
      });
    }

    console.log(`[BIOMETRIC ENROLLED] Successfully saved 3-angle vectors for ${updatedUser.email}`);

    return res.status(200).json({
      message: 'Biometric profile registered successfully! You can now check in.',
      user: updatedUser,
    });
  } catch (error) {
    console.error('registerSelfFace error:', error);
    return res.status(500).json({ message: 'Failed to save biometric profile to database', error: error.message });
  }
};