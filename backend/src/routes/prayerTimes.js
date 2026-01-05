const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Get prayer times for a specific date and location
router.get('/', async (req, res) => {
  try {
    const { date, locationId, madhab = 'hanafi' } = req.query;

    // Parse date or use today
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }

    // Calculate day of year
    const start = new Date(targetDate.getFullYear(), 0, 0);
    const diff = targetDate - start;
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);

    // Get base prayer times for this day
    const prayerTimes = await query(
      'SELECT * FROM prayer_times WHERE day_of_year = ?',
      [dayOfYear]
    );

    if (prayerTimes.length === 0) {
      return res.status(404).json({ 
        error: 'Prayer times not found for this date',
        dayOfYear,
        date: targetDate.toISOString().split('T')[0]
      });
    }

    const times = prayerTimes[0];

    // Get location altitude for adjustments
    let altitudeAdjustment = { sunrise_adjustment: 0, sunset_adjustment: 0 };
    
    if (locationId) {
      const locations = await query(
        'SELECT altitude FROM locations WHERE id = ?',
        [locationId]
      );

      if (locations.length > 0) {
        const altitude = locations[0].altitude;

        const adjustments = await query(
          'SELECT sunrise_adjustment, sunset_adjustment FROM altitude_adjustments WHERE altitude_min <= ? AND altitude_max >= ?',
          [altitude, altitude]
        );

        if (adjustments.length > 0) {
          altitudeAdjustment = adjustments[0];
        }
      }
    }

    // Helper function to adjust time
    const adjustTime = (timeStr, minutes) => {
      if (!timeStr || minutes === 0) return timeStr;
      const [hours, mins, secs] = timeStr.split(':').map(Number);
      const date = new Date();
      date.setHours(hours, mins + minutes, secs || 0);
      return date.toTimeString().split(' ')[0];
    };

    // Build response based on madhab selection
    const isHanafi = madhab.toLowerCase() === 'hanafi';
    
    const response = {
      date: targetDate.toISOString().split('T')[0],
      dayOfYear,
      madhab: madhab.toLowerCase(),
      locationId: locationId || null,
      altitudeAdjustment,
      times: {
        sehri: times.sehri_time,
        fajr: times.fajr_time,
        sunrise: adjustTime(times.sunrise_time, altitudeAdjustment.sunrise_adjustment),
        istiwa: times.istiwa_time,
        zohr: times.zohr_time,
        asr: isHanafi ? times.asr_hanafi_time : times.asr_shafii_time,
        sunset: adjustTime(times.sunset_time, altitudeAdjustment.sunset_adjustment),
        maghrib: isHanafi ? times.maghrib_hanafi_time : times.maghrib_shafii_time,
        esha: isHanafi ? times.esha_hanafi_time : times.esha_shafii_time
      },
      forbiddenTimes: {
        afterSunrise: adjustTime(times.sunrise_time, altitudeAdjustment.sunrise_adjustment),
        istiwa: times.istiwa_time,
        beforeSunset: adjustTime(times.sunset_time, altitudeAdjustment.sunset_adjustment)
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching prayer times:', error);
    res.status(500).json({ error: 'Failed to fetch prayer times' });
  }
});

// Get prayer times for a date range (for calendar view)
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate, madhab = 'hanafi', locationId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate day of year for both dates
    const startOfYear = new Date(start.getFullYear(), 0, 0);
    const startDiff = start - startOfYear;
    const endDiff = end - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    const startDayOfYear = Math.floor(startDiff / oneDay);
    const endDayOfYear = Math.floor(endDiff / oneDay);

    const prayerTimes = await query(
      'SELECT * FROM prayer_times WHERE day_of_year >= ? AND day_of_year <= ? ORDER BY day_of_year',
      [startDayOfYear, endDayOfYear]
    );

    // Get altitude adjustment if location provided
    let altitudeAdjustment = { sunrise_adjustment: 0, sunset_adjustment: 0 };
    
    if (locationId) {
      const locations = await query(
        'SELECT altitude FROM locations WHERE id = ?',
        [locationId]
      );

      if (locations.length > 0) {
        const altitude = locations[0].altitude;
        const adjustments = await query(
          'SELECT sunrise_adjustment, sunset_adjustment FROM altitude_adjustments WHERE altitude_min <= ? AND altitude_max >= ?',
          [altitude, altitude]
        );
        if (adjustments.length > 0) {
          altitudeAdjustment = adjustments[0];
        }
      }
    }

    const isHanafi = madhab.toLowerCase() === 'hanafi';

    const results = prayerTimes.map(times => ({
      dayOfYear: times.day_of_year,
      month: times.month,
      day: times.day,
      times: {
        sehri: times.sehri_time,
        fajr: times.fajr_time,
        sunrise: times.sunrise_time,
        istiwa: times.istiwa_time,
        zohr: times.zohr_time,
        asr: isHanafi ? times.asr_hanafi_time : times.asr_shafii_time,
        sunset: times.sunset_time,
        maghrib: isHanafi ? times.maghrib_hanafi_time : times.maghrib_shafii_time,
        esha: isHanafi ? times.esha_hanafi_time : times.esha_shafii_time
      }
    }));

    res.json({
      startDate,
      endDate,
      madhab,
      altitudeAdjustment,
      times: results
    });
  } catch (error) {
    logger.error('Error fetching prayer times range:', error);
    res.status(500).json({ error: 'Failed to fetch prayer times' });
  }
});

// Admin: Add/Update prayer times (bulk)
router.post('/bulk', verifyToken, requireRole('admin', 'editor'), [
  body('times').isArray({ min: 1 }),
  body('times.*.dayOfYear').isInt({ min: 1, max: 366 }),
  body('times.*.month').isInt({ min: 1, max: 12 }),
  body('times.*.day').isInt({ min: 1, max: 31 }),
  body('times.*.sehri').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.fajr').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.sunrise').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.istiwa').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.zohr').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.asrHanafi').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.asrShafii').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.sunset').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.maghribHanafi').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.maghribShafii').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.eshaHanafi').matches(/^\d{2}:\d{2}(:\d{2})?$/),
  body('times.*.eshaShafii').matches(/^\d{2}:\d{2}(:\d{2})?$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { times } = req.body;
    let inserted = 0;
    let updated = 0;

    for (const time of times) {
      // Check if record exists
      const existing = await query(
        'SELECT id FROM prayer_times WHERE day_of_year = ?',
        [time.dayOfYear]
      );

      const values = [
        time.dayOfYear,
        time.month,
        time.day,
        time.sehri,
        time.fajr,
        time.sunrise,
        time.istiwa,
        time.zohr,
        time.asrHanafi,
        time.asrShafii,
        time.sunset,
        time.maghribHanafi,
        time.maghribShafii,
        time.eshaHanafi,
        time.eshaShafii,
        req.user.id
      ];

      if (existing.length > 0) {
        await query(`
          UPDATE prayer_times SET
            month = ?, day = ?, sehri_time = ?, fajr_time = ?, sunrise_time = ?,
            istiwa_time = ?, zohr_time = ?, asr_hanafi_time = ?, asr_shafii_time = ?,
            sunset_time = ?, maghrib_hanafi_time = ?, maghrib_shafii_time = ?,
            esha_hanafi_time = ?, esha_shafii_time = ?, created_by = ?
          WHERE day_of_year = ?
        `, [...values.slice(1), time.dayOfYear]);
        updated++;
      } else {
        await query(`
          INSERT INTO prayer_times (
            day_of_year, month, day, sehri_time, fajr_time, sunrise_time,
            istiwa_time, zohr_time, asr_hanafi_time, asr_shafii_time,
            sunset_time, maghrib_hanafi_time, maghrib_shafii_time,
            esha_hanafi_time, esha_shafii_time, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, values);
        inserted++;
      }
    }

    // Log audit
    await query(
      'INSERT INTO audit_log (user_id, action, table_name, new_values, ip_address) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, 'bulk_update', 'prayer_times', JSON.stringify({ inserted, updated, count: times.length }), req.ip]
    );

    logger.info(`Bulk prayer times update by ${req.user.email}: ${inserted} inserted, ${updated} updated`);

    res.json({ 
      message: 'Prayer times updated successfully',
      inserted,
      updated
    });
  } catch (error) {
    logger.error('Error bulk updating prayer times:', error);
    res.status(500).json({ error: 'Failed to update prayer times' });
  }
});

// Admin: Get all prayer times for a month (for editing)
router.get('/admin/month/:month', verifyToken, requireRole('admin', 'editor'), async (req, res) => {
  try {
    const { month } = req.params;

    const prayerTimes = await query(
      'SELECT * FROM prayer_times WHERE month = ? ORDER BY day',
      [parseInt(month)]
    );

    res.json(prayerTimes);
  } catch (error) {
    logger.error('Error fetching month prayer times:', error);
    res.status(500).json({ error: 'Failed to fetch prayer times' });
  }
});

module.exports = router;
