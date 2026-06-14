const mysql = require('mysql2/promise');

let pool = null;

function createPool(config) {
  if (pool) return pool;

  pool = mysql.createPool({
    host: config.host || 'localhost',
    port: config.port || 3306,
    user: config.user || 'root',
    password: config.password || '',
    database: config.database || 'kvault',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  return pool;
}

async function getPool() {
  if (!pool) {
    throw new Error('MySQL pool not initialized. Call initMySQL(config) first.');
  }
  return pool;
}

async function query(sql, params) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function execute(sql, params) {
  const p = await getPool();
  const [result] = await p.execute(sql, params);
  return result;
}

async function initMySQL(config) {
  if (!config?.host || !config?.database) {
    return false;
  }

  try {
    createPool(config);
    const fs = require('fs');
    const path = require('path');
    const schemaPath = path.join(__dirname, 'mysql-schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    const statements = schema
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await execute(stmt);
    }

    return true;
  } catch (error) {
    console.error('MySQL init failed:', error.message);
    pool = null;
    return false;
  }
}

async function closeMySQL() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initMySQL,
  getPool,
  query,
  execute,
  closeMySQL,
};
