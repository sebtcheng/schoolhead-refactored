import crypto from 'crypto';

/**
 * Upserts a binary buffer into the unified_binaries table.
 * Computes SHA-256 hash for deduplication.
 * 
 * @param {object} poolOrClient - PostgreSQL client or pool
 * @param {Buffer} buffer - Binary content
 * @param {string} mimeType - MIME type string
 * @param {number} [originalSize] - Original size in bytes
 * @returns {Promise<{binary_id: string, stored_size: number, original_size: number}>}
 */
export async function upsertBinary(poolOrClient, buffer, mimeType = 'application/octet-stream', originalSize) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('upsertBinary requires a valid Buffer');
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex');
  const sizeBytes = buffer.length;
  const origSize = originalSize || sizeBytes;

  const res = await poolOrClient.query(
    `INSERT INTO unified_binaries (hash, content, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (hash) DO UPDATE SET mime_type = EXCLUDED.mime_type
     RETURNING id, size_bytes`,
    [hash, buffer, mimeType, sizeBytes]
  );

  const row = res.rows[0];
  return {
    binary_id: row.id,
    stored_size: row.size_bytes,
    original_size: origSize
  };
}

export default upsertBinary;
