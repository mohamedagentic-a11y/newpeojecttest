const poolModule = require('../db/pool');

// pool.js has no default export. Use its named Pool export.
const pool = poolModule.pool;

/**
 * Normalise the details payload into a JSON string suitable for storage.
 * The parameter type is inferred from the column (JSON/JSONB or TEXT).
 */
function serializeDetails(details) {
  if (details === undefined || details === null) {
    return null;
  }
  if (typeof details === 'string') {
    return JSON.stringify({ message: details });
  }
  try {
    return JSON.stringify(details);
  } catch (err) {
    return JSON.stringify({ message: String(details) });
  }
}

/**
 * Insert a row into audit_logs.
 *
 * @param {import('pg').PoolClient|null} clientOrNull - transaction client to use, or null to use the pool
 * @param {{actionType: string, actorId: string|null, details?: any}} entry
 * @returns {Promise<object>} the inserted audit log row
 */
async function log(clientOrNull, { actionType, actorId = null, details = null } = {}) {
  if (!actionType || typeof actionType !== 'string') {
    throw new Error('auditLogRepository.log: actionType is required');
  }

  const executor = clientOrNull || pool;
  if (!executor || typeof executor.query !== 'function') {
    throw new Error('auditLogRepository.log: no database client or pool available');
  }

  const sql = `
    INSERT INTO audit_logs (action_type, actor_id, details)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const params = [actionType, actorId || null, serializeDetails(details)];

  const result = await executor.query(sql, params);
  return result.rows[0];
}

module.exports = { log };