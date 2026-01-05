const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { verifyToken, generateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name is required'),
  body('reason').optional().trim()
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

// Register new user (pending approval)
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, fullName, reason } = req.body;

    // Check if email already exists in users or pending requests
    const existingUser = await query(
      'SELECT id FROM users WHERE email = ? UNION SELECT id FROM registration_requests WHERE email = ? AND status = "pending"',
      [email, email]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Email already registered or pending approval' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create registration request
    await query(
      'INSERT INTO registration_requests (email, password_hash, full_name, reason) VALUES (?, ?, ?, ?)',
      [email, passwordHash, fullName, reason || null]
    );

    logger.info(`New registration request: ${email}`);

    res.status(201).json({ 
      message: 'Registration submitted. Please wait for admin approval.',
      pendingApproval: true
    });
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const users = await query(
      'SELECT id, email, password_hash, full_name, role, is_approved, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      // Check if there's a pending registration
      const pending = await query(
        'SELECT id FROM registration_requests WHERE email = ? AND status = "pending"',
        [email]
      );
      
      if (pending.length > 0) {
        return res.status(403).json({ error: 'Your registration is pending approval' });
      }
      
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // Check if account is approved
    if (!user.is_approved) {
      return res.status(403).json({ error: 'Account pending approval' });
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    logger.info(`User logged in: ${email}`);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/me', verifyToken, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.full_name,
      role: req.user.role
    }
  });
});

// Change password
router.post('/change-password', verifyToken, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Get current password hash
    const users = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, req.user.id]
    );

    logger.info(`Password changed for user: ${req.user.email}`);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
