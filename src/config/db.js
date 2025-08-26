const mssql = require("mssql");
const config = require("./index");
const logger = require("./logger");

let pool;

async function getPool() {
  if (pool) return pool;
  try {
    pool = await mssql.connect(config.db);
    logger.info("MSSQL connected");
    pool.on("error", (err) => logger.error("MSSQL pool error:", err));
    return pool;
  } catch (err) {
    logger.error("MSSQL connection error:", err);
    throw err;
  }
}

async function query(strings, ...values) {
  // Tagged template helper: await db.query`SELECT * FROM Users WHERE Id = ${id}`;
  const pool = await getPool();
  const request = pool.request();
  const sql = strings.reduce((acc, s, i) => {
    const v = values[i - 1];
    if (i === 0) return s;
    const param = "p" + i;
    if (typeof v === "number") request.input(param, mssql.Int, v);
    else if (v instanceof Date) request.input(param, mssql.DateTime, v);
    else request.input(param, mssql.NVarChar, v);
    return acc + "@" + param + s;
  }, "");
  const result = await request.query(sql);
  return result;
}

module.exports = { getPool, query };