const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get all altitude adjustments
router.get('/', async (req, res) => {
  try {
    const adjustments = await query(
      'SELECT * FROM altitude_adjustments ORDER BY altitude_min'
    );
    res.json(adjustments);
  } catch (error) {
    logger.error('Error fetching adjustments:', error);
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
});

// Get adjustment for specific altitude
router.get('/altitude/:altitude', async (req, res) => {
  try {
    const { altitude } = req.params;
    const alt = parseInt(altitude);

    const adjustments = await query(
      'SELECT * FROM altitude_adjustments WHERE altitude_min <= ? AND altitude_max >= ?',
      [alt, alt]
    );

    if (adjustments.length === 0) {
      return res.json({ sunrise_adjustment: 0, sunset_adjustment: 0 });
    }

    res.json(adjustments[0]);
  } catch (error) {
    logger.error('Error fetching adjustment:', error);
    res.status(500).json({ error: 'Failed to fetch adjustment' });
  }
});

// Admin: Update altitude adjustment
router.put('/:id', verifyToken, requireRole('admin'), [
  body('altitudeMin').isInt({ min: 0 }),
  body('altitudeMax').isInt({ min: 0 }),
  body('sunriseAdjustment').isInt({ min: -30, max: 30 }),
  body('sunsetAdjustment').isInt({ min: -30, max: 30 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { altitudeMin, altitudeMax, sunriseAdjustment, sunsetAdjustment, description } = req.body;

    await query(`
      UPDATE altitude_adjustments 
      SET altitude_min = ?, altitude_max = ?, sunrise_adjustment = ?, 
          sunset_adjustment = ?, description = ?
      WHERE id = ?
    `, [altitudeMin, altitudeMax, sunriseAdjustment, sunsetAdjustment, description || null, id]);

    logger.info(`Altitude adjustment updated: ID ${id} by ${req.user.email}`);

    res.json({ message: 'Adjustment updated successfully' });
  } catch (error) {
    logger.error('Error updating adjustment:', error);
    res.status(500).json({ error: 'Failed to update adjustment' });
  }
});

// Admin: Create new altitude adjustment
router.post('/', verifyToken, requireRole('admin'), [
  body('altitudeMin').isInt({ min: 0 }),
  body('altitudeMax').isInt({ min: 0 }),
  body('sunriseAdjustment').isInt({ min: -30, max: 30 }),
  body('sunsetAdjustment').isInt({ min: -30, max: 30 }),
  body('description').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { altitudeMin, altitudeMax, sunriseAdjustment, sunsetAdjustment, description } = req.body;

    const result = await query(`
      INSERT INTO altitude_adjustments 
      (altitude_min, altitude_max, sunrise_adjustment, sunset_adjustment, description)
      VALUES (?, ?, ?, ?, ?)
    `, [altitudeMin, altitudeMax, sunriseAdjustment, sunsetAdjustment, description || null]);

    logger.info(`New altitude adjustment created by ${req.user.email}`);

    res.status(201).json({ 
      message: 'Adjustment created successfully',
      id: result.insertId
    });
  } catch (error) {
    logger.error('Error creating adjustment:', error);
    res.status(500).json({ error: 'Failed to create adjustment' });
  }
});

// Admin: Delete altitude adjustment
router.delete('/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM altitude_adjustments WHERE id = ?', [id]);

    logger.info(`Altitude adjustment deleted: ID ${id} by ${req.user.email}`);

    res.json({ message: 'Adjustment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting adjustment:', error);
    res.status(500).json({ error: 'Failed to delete adjustment' });
  }
});

module.exports = router;
