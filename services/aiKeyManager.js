import { pool } from '../config/database.js';

/**
 * AI API 키 저장
 */
export async function saveApiKey(provider, apiKey, name = null) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `INSERT INTO ai_api_keys (provider, api_key, name, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (provider, name) 
       DO UPDATE SET api_key = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [provider, apiKey, name]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * AI API 키 조회
 */
export async function getApiKey(provider, name = null) {
  const client = await pool.connect();
  try {
    const query = name
      ? `SELECT * FROM ai_api_keys WHERE provider = $1 AND name = $2 AND is_active = true`
      : `SELECT * FROM ai_api_keys WHERE provider = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`;
    
    const params = name ? [provider, name] : [provider];
    const result = await client.query(query, params);
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * 모든 AI API 키 조회
 */
export async function getAllApiKeys() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, provider, name, is_active, created_at, updated_at 
       FROM ai_api_keys 
       ORDER BY provider, created_at DESC`
    );
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * AI API 키 수정
 */
export async function updateApiKey(id, updates) {
  const client = await pool.connect();
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updates.api_key) {
      fields.push(`api_key = $${paramIndex++}`);
      values.push(updates.api_key);
    }
    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await client.query(
      `UPDATE ai_api_keys 
       SET ${fields.join(', ')} 
       WHERE id = $${paramIndex}
       RETURNING id, provider, name, is_active, created_at, updated_at`,
      values
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

/**
 * AI API 키 삭제
 */
export async function deleteApiKey(id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM ai_api_keys WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}
