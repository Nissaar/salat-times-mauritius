-- Migration: Add start/end time columns for forbidden prayer periods
-- This script adds sunrise_end_time, istiwa_end_time, sunset_end_time columns
-- and renames existing columns to _start_time

-- Check if migration is needed (if sunrise_start_time doesn't exist)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = DATABASE() 
    AND table_name = 'prayer_times' 
    AND column_name = 'sunrise_start_time'
);

-- Only run migration if columns don't exist
SET @sql = IF(@column_exists = 0,
    'ALTER TABLE prayer_times
        CHANGE COLUMN sunrise_time sunrise_start_time TIME NOT NULL,
        ADD COLUMN sunrise_end_time TIME NULL AFTER sunrise_start_time,
        CHANGE COLUMN istiwa_time istiwa_start_time TIME NOT NULL,
        ADD COLUMN istiwa_end_time TIME NULL AFTER istiwa_start_time,
        CHANGE COLUMN sunset_time sunset_start_time TIME NOT NULL,
        ADD COLUMN sunset_end_time TIME NULL AFTER sunset_start_time',
    'SELECT "Migration already applied - columns exist"'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add computed columns for backward compatibility (if they don't exist)
-- Note: Generated columns may not work in all MySQL versions, so we skip these
-- The backend code handles backward compatibility instead

SELECT 'Migration complete: Added start/end time columns for sunrise, istiwa, and sunset periods' AS result;
