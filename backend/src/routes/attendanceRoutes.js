const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const attendanceController = require('../controllers/attendanceController');

// All routes require valid user token
router.use(authenticateToken);

// Employee actions
router.post('/check-in', attendanceController.checkIn);
router.post('/check-out', attendanceController.checkOut);
router.patch('/overtime/request', attendanceController.requestOvertime);
router.get('/records', attendanceController.getRecords);

// Admin-only actions
router.patch('/admin/overtime/review', authorizeRoles('ADMIN'), attendanceController.reviewOvertime);
router.patch('/admin/assign-task', authorizeRoles('ADMIN'), attendanceController.assignTask);

module.exports = router;