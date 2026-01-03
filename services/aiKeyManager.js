import { pool } from '../config/database.js';

/**
 * AI API 키 저장
 */
export async function saveApiKey(provider, apiKey, name = null) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `INSERT INTO ai_api_keys (provider, api_key, name, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (provider, name) 
       DO UPDATE SET api_key = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [provider, apiKey, name]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Save API key database error:', error);
    throw new Error(`Failed to save API key: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * AI API 키 조회
 */
export async function getApiKey(provider, name = null) {
  let client;
  try {
    client = await pool.connect();
    const query = name
      ? `SELECT * FROM ai_api_keys WHERE provider = $1 AND name = $2 AND is_active = true`
      : `SELECT * FROM ai_api_keys WHERE provider = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`;
    
    const params = name ? [provider, name] : [provider];
    const result = await client.query(query, params);
    return result.rows[0];
  } catch (error) {
    console.error('Get API key database error:', error);
    throw new Error(`Failed to get API key: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * 모든 AI API 키 조회
 */
export async function getAllApiKeys() {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT id, provider, name, is_active, created_at, updated_at 
       FROM ai_api_keys 
       ORDER BY provider, created_at DESC`
    );
    return result.rows;
  } catch (error) {
    console.error('Get all API keys database error:', error);
    throw new Error(`Failed to get API keys: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * AI API 키 수정
 */
export async function updateApiKey(id, updates) {
  let client;
  try {
    client = await pool.connect();
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
  } catch (error) {
    console.error('Update API key database error:', error);
    throw new Error(`Failed to update API key: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}

/**
 * AI API 키 삭제
 */
export async function deleteApiKey(id) {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `DELETE FROM ai_api_keys WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Delete API key database error:', error);
    throw new Error(`Failed to delete API key: ${error.message}`);
  } finally {
    if (client) {
      client.release();
    }
  }
}
