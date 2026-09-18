const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

// Protect all admin routes: must be authenticated and have role 'ADMIN'
router.use(authenticateToken, authorizeRoles('ADMIN'));

router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/ban', adminController.toggleBanUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/holidays', adminController.getHolidays);
router.patch('/review-admin-request', adminController.reviewAdminRequest);

// Biometric enrollment route (inherited router.use middleware handles auth)
router.post('/enroll-face', adminController.enrollUserFace);

module.exports = router;