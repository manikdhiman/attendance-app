const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');

router.use(authenticateToken, authorizeRoles('ADMIN'));

router.get('/users', adminController.getAllUsers);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/ban', adminController.toggleBanUser);
router.delete('/users/:id', adminController.deleteUser);
router.get('/holidays', adminController.getHolidays);

module.exports = router;