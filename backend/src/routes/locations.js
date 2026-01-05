const express = require('express');
const { query } = require('../config/database');
const logger = require('../utils/logger');

const router = express.Router();

// Get all districts
router.get('/districts', async (req, res) => {
  try {
    const districts = await query('SELECT id, name FROM districts ORDER BY name');
    res.json(districts);
  } catch (error) {
    logger.error('Error fetching districts:', error);
    res.status(500).json({ error: 'Failed to fetch districts' });
  }
});

// Get all locations (with district info)
router.get('/', async (req, res) => {
  try {
    const { district, search, limit = 50 } = req.query;
    
    let sql = `
      SELECT l.id, l.name, l.latitude, l.longitude, l.altitude, l.is_reference_location,
             d.id as district_id, d.name as district_name
      FROM locations l
      JOIN districts d ON l.district_id = d.id
      WHERE 1=1
    `;
    const params = [];

    if (district) {
      sql += ' AND d.id = ?';
      params.push(district);
    }

    if (search) {
      sql += ' AND l.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' ORDER BY d.name, l.name LIMIT ?';
    params.push(parseInt(limit));

    const locations = await query(sql, params);
    res.json(locations);
  } catch (error) {
    logger.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// Search locations with autocomplete
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const locations = await query(`
      SELECT l.id, l.name, l.latitude, l.longitude, l.altitude,
             d.name as district_name
      FROM locations l
      JOIN districts d ON l.district_id = d.id
      WHERE l.name LIKE ? OR d.name LIKE ?
      ORDER BY 
        CASE WHEN l.name LIKE ? THEN 0 ELSE 1 END,
        l.name
      LIMIT ?
    `, [`%${q}%`, `%${q}%`, `${q}%`, parseInt(limit)]);

    res.json(locations);
  } catch (error) {
    logger.error('Error searching locations:', error);
    res.status(500).json({ error: 'Failed to search locations' });
  }
});

// Get location by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const locations = await query(`
      SELECT l.id, l.name, l.latitude, l.longitude, l.altitude, l.is_reference_location,
             d.id as district_id, d.name as district_name
      FROM locations l
      JOIN districts d ON l.district_id = d.id
      WHERE l.id = ?
    `, [id]);

    if (locations.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(locations[0]);
  } catch (error) {
    logger.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// Find nearest location to given coordinates
router.get('/nearest/coords', async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude required' });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Validate coordinates are roughly within Mauritius region
    if (latitude < -21 || latitude > -19 || longitude < 57 || longitude > 64) {
      // Allow Rodrigues coordinates (around -19.7, 63.4)
      if (!(latitude > -20.5 && latitude < -19 && longitude > 62.5 && longitude < 64.5)) {
        return res.status(400).json({ error: 'Coordinates outside Mauritius region' });
      }
    }

    // Find nearest location using Haversine formula
    const locations = await query(`
      SELECT l.id, l.name, l.latitude, l.longitude, l.altitude,
             d.name as district_name,
             (6371 * acos(cos(radians(?)) * cos(radians(latitude)) * 
              cos(radians(longitude) - radians(?)) + 
              sin(radians(?)) * sin(radians(latitude)))) AS distance
      FROM locations l
      JOIN districts d ON l.district_id = d.id
      ORDER BY distance
      LIMIT 5
    `, [latitude, longitude, latitude]);

    res.json(locations);
  } catch (error) {
    logger.error('Error finding nearest location:', error);
    res.status(500).json({ error: 'Failed to find nearest location' });
  }
});

module.exports = router;
