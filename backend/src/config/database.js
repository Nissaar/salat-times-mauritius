const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'db',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'salat_user',
  password: process.env.DB_PASSWORD || 'salat_password',
  database: process.env.DB_NAME || 'salat_times',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return true;
  } catch (error) {
    throw new Error(`Database connection failed: ${error.message}`);
  }
}

async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

async function getConnection() {
  return await pool.getConnection();
}

module.exports = {
  pool,
  query,
  getConnection,
  testConnection
};
