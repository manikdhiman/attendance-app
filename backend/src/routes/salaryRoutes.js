const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const salaryController = require('../controllers/salaryController');

router.get('/payroll', authenticateToken, authorizeRoles('ADMIN'), salaryController.getMonthlyPayroll);

module.exports = router;