-- Salat Times Mauritius Database Schema
-- This script initializes the database with all required tables

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'editor', 'viewer') DEFAULT 'viewer',
    is_approved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_approved (is_approved)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Districts table
CREATE TABLE IF NOT EXISTS districts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Locations table with all Mauritius villages and cities
CREATE TABLE IF NOT EXISTS locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district_id INT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    altitude INT DEFAULT 0 COMMENT 'Altitude in meters',
    is_reference_location BOOLEAN DEFAULT FALSE COMMENT 'If true, this is Port Louis or another reference point',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
    INDEX idx_name (name),
    INDEX idx_district (district_id),
    INDEX idx_altitude (altitude),
    INDEX idx_coords (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Location adjustments based on altitude groups
CREATE TABLE IF NOT EXISTS altitude_adjustments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    altitude_min INT NOT NULL COMMENT 'Minimum altitude in meters',
    altitude_max INT NOT NULL COMMENT 'Maximum altitude in meters',
    sunrise_adjustment INT DEFAULT 0 COMMENT 'Minutes to add/subtract for sunrise',
    sunset_adjustment INT DEFAULT 0 COMMENT 'Minutes to add/subtract for sunset',
    description VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_altitude_range (altitude_min, altitude_max)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Prayer times for reference location (Port Louis)
-- day_of_year: 1-366 (handles leap years)
CREATE TABLE IF NOT EXISTS prayer_times (
    id INT AUTO_INCREMENT PRIMARY KEY,
    day_of_year INT NOT NULL COMMENT '1-366 day of year',
    month INT NOT NULL COMMENT '1-12',
    day INT NOT NULL COMMENT '1-31',
    
    -- Sehri/Suhoor time (end of eating for fasting)
    sehri_time TIME NOT NULL,
    
    -- Fajr prayer
    fajr_time TIME NOT NULL,
    
    -- Sunrise forbidden period (start and end)
    sunrise_start_time TIME NOT NULL,
    sunrise_end_time TIME NULL,
    sunrise_time TIME AS (sunrise_start_time) STORED COMMENT 'Alias for backward compatibility',
    
    -- Istiwa/Zawaal forbidden period (start and end)
    istiwa_start_time TIME NOT NULL,
    istiwa_end_time TIME NULL,
    istiwa_time TIME AS (istiwa_start_time) STORED COMMENT 'Alias for backward compatibility',
    
    -- Zohr/Dhuhr prayer
    zohr_time TIME NOT NULL,
    
    -- Asr prayer times
    asr_hanafi_time TIME NOT NULL,
    asr_shafii_time TIME NOT NULL,
    
    -- Sunset forbidden period (start and end)
    sunset_start_time TIME NOT NULL,
    sunset_end_time TIME NULL,
    sunset_time TIME AS (sunset_start_time) STORED COMMENT 'Alias for backward compatibility',
    
    -- Maghrib prayer / Iftar time
    maghrib_hanafi_time TIME NOT NULL,
    maghrib_shafii_time TIME NOT NULL,
    
    -- Isha prayer
    esha_hanafi_time TIME NOT NULL,
    esha_shafii_time TIME NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NULL,
    
    UNIQUE KEY unique_day (day_of_year),
    INDEX idx_month_day (month, day),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit log for tracking changes
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_table (table_name),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions table for managing user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User registration requests (pending approval)
CREATE TABLE IF NOT EXISTS registration_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    reason TEXT NULL COMMENT 'Why they want access',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT NULL,
    reviewed_at TIMESTAMP NULL,
    review_notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default districts of Mauritius
INSERT INTO districts (name) VALUES
('Port Louis'),
('Pamplemousses'),
('Rivière du Rempart'),
('Flacq'),
('Grand Port'),
('Savanne'),
('Black River'),
('Plaines Wilhems'),
('Moka'),
('Rodrigues');

-- Insert default altitude adjustments
INSERT INTO altitude_adjustments (altitude_min, altitude_max, sunrise_adjustment, sunset_adjustment, description) VALUES
(0, 50, 0, 0, 'Sea level to 50m - No adjustment'),
(51, 150, -1, 1, '51-150m - Minor adjustment'),
(151, 300, -2, 2, '151-300m - Moderate adjustment'),
(301, 500, -3, 3, '301-500m - Significant adjustment'),
(501, 828, -4, 4, 'Above 500m - Major adjustment (highest point is ~828m)');
