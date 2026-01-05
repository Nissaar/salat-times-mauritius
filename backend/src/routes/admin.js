const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require authentication and admin role
router.use(verifyToken);
router.use(requireRole('admin'));

// Get all users
router.get('/users', async (req, res) => {
  try {
    const users = await query(`
      SELECT id, email, full_name, role, is_approved, is_active, 
             created_at, last_login, approved_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(users);
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get pending registration requests
router.get('/registration-requests', async (req, res) => {
  try {
    const requests = await query(`
      SELECT id, email, full_name, reason, status, created_at
      FROM registration_requests
      WHERE status = 'pending'
      ORDER BY created_at ASC
    `);
    res.json(requests);
  } catch (error) {
    logger.error('Error fetching registration requests:', error);
    res.status(500).json({ error: 'Failed to fetch registration requests' });
  }
});

// Approve registration request
router.post('/registration-requests/:id/approve', [
  body('role').optional().isIn(['admin', 'editor', 'viewer'])
], async (req, res) => {
  try {
    const { id } = req.params;
    const { role = 'viewer' } = req.body;

    // Get the registration request
    const requests = await query(
      'SELECT * FROM registration_requests WHERE id = ? AND status = "pending"',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Registration request not found or already processed' });
    }

    const request = requests[0];

    // Create the user
    await query(`
      INSERT INTO users (email, password_hash, full_name, role, is_approved, approved_by, approved_at)
      VALUES (?, ?, ?, ?, TRUE, ?, NOW())
    `, [request.email, request.password_hash, request.full_name, role, req.user.id]);

    // Update request status
    await query(
      'UPDATE registration_requests SET status = "approved", reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [req.user.id, id]
    );

    // Log audit
    await query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id, new_values, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, 'approve_registration', 'registration_requests', id, JSON.stringify({ email: request.email, role }), req.ip]
    );

    logger.info(`Registration approved: ${request.email} by ${req.user.email}`);

    res.json({ message: 'Registration approved successfully' });
  } catch (error) {
    logger.error('Error approving registration:', error);
    res.status(500).json({ error: 'Failed to approve registration' });
  }
});

// Reject registration request
router.post('/registration-requests/:id/reject', [
  body('reason').optional().trim()
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const requests = await query(
      'SELECT email FROM registration_requests WHERE id = ? AND status = "pending"',
      [id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ error: 'Registration request not found or already processed' });
    }

    await query(
      'UPDATE registration_requests SET status = "rejected", reviewed_by = ?, reviewed_at = NOW(), review_notes = ? WHERE id = ?',
      [req.user.id, reason || null, id]
    );

    logger.info(`Registration rejected: ${requests[0].email} by ${req.user.email}`);

    res.json({ message: 'Registration rejected' });
  } catch (error) {
    logger.error('Error rejecting registration:', error);
    res.status(500).json({ error: 'Failed to reject registration' });
  }
});

// Update user role
router.patch('/users/:id/role', [
  body('role').isIn(['admin', 'editor', 'viewer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { role } = req.body;

    // Prevent self-demotion
    if (parseInt(id) === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    await query('UPDATE users SET role = ? WHERE id = ?', [role, id]);

    logger.info(`User role updated: ID ${id} to ${role} by ${req.user.email}`);

    res.json({ message: 'User role updated' });
  } catch (error) {
    logger.error('Error updating user role:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Deactivate/Activate user
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    // Prevent self-deactivation
    if (parseInt(id) === req.user.id && !active) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    await query('UPDATE users SET is_active = ? WHERE id = ?', [active, id]);

    logger.info(`User status updated: ID ${id} to ${active ? 'active' : 'inactive'} by ${req.user.email}`);

    res.json({ message: `User ${active ? 'activated' : 'deactivated'}` });
  } catch (error) {
    logger.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get audit log
router.get('/audit-log', async (req, res) => {
  try {
    const { limit = 100, action, userId } = req.query;

    let sql = `
      SELECT al.*, u.email as user_email, u.full_name as user_name
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      sql += ' AND al.action = ?';
      params.push(action);
    }

    if (userId) {
      sql += ' AND al.user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY al.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = await query(sql, params);
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [usersCount] = await query('SELECT COUNT(*) as count FROM users');
    const [locationsCount] = await query('SELECT COUNT(*) as count FROM locations');
    const [prayerTimesCount] = await query('SELECT COUNT(*) as count FROM prayer_times');
    const [pendingRequests] = await query('SELECT COUNT(*) as count FROM registration_requests WHERE status = "pending"');

    res.json({
      users: usersCount.count,
      locations: locationsCount.count,
      prayerTimesEntries: prayerTimesCount.count,
      pendingRegistrations: pendingRequests.count
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
