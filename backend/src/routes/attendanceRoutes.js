const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// All attendance routes require valid JWT
router.use(authenticateToken);

// Employee & Shared Routes
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.patch('/task', attendanceController.updateTask);
router.post('/overtime/request', attendanceController.requestOvertime);
router.get('/records', attendanceController.getAttendanceRecords);

// Admin-Only Routes (Guarded by authorizeRole)
router.patch('/admin/assign-task', authorizeRole('ADMIN'), attendanceController.assignTask);
router.patch('/admin/overtime/review', authorizeRole('ADMIN'), attendanceController.reviewOvertime);

module.exports = router;