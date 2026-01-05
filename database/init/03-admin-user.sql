-- Create default admin user
-- Password: admin123456 (bcrypt hash)

INSERT INTO users (email, password_hash, full_name, role, is_approved, is_active, approved_at) 
VALUES (
    'admin@salattimes.mu',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G5aIqpGJKP5kKy',
    'System Administrator',
    'admin',
    TRUE,
    TRUE,
    NOW()
);
