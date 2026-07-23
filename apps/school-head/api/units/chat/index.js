import express from 'express';
import authMiddleware from '@shared/auth';
import { pool } from '@shared/db';
import multer from 'multer';
import { BlobServiceClient, BlobSASPermissions } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB file size limit for photos/screenshots
});

// ─────────────────────────────────────────────────────────────────────────────
// [CONTACTS] GET /api/chat/contacts
// Looks up valid target chat contacts based on user role (SDO, HRMO, ADMIN, etc.).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/chat/contacts', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;

  try {
    const selfRes = await pool.query('SELECT role, region, division FROM users WHERE uid = $1', [userUid]);
    if (selfRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'User profile not found.' });
    }
    const self = selfRes.rows[0];

    if (self.role === 'School Head' || self.role === 'school_head') {
      const sdoQuery = `
        SELECT uid, first_name, last_name, role, position 
        FROM users 
        WHERE (role = 'School Division Office' OR role = 'Regional Division Office' OR role = 'RO/SDO' OR role = 'Ro/sdo')
          AND LOWER(TRIM(division)) = LOWER(TRIM($1)) AND disabled = false 
        ORDER BY last_name ASC, first_name ASC
      `;
      const hrmoQuery = `
        SELECT uid, first_name, last_name, role, position 
        FROM users 
        WHERE (role = 'HRMO' OR role = 'Personnel') AND disabled = false 
        LIMIT 1
      `;
      const adminQuery = `
        SELECT uid, first_name, last_name, role, position 
        FROM users 
        WHERE (school_id = '999009' OR school_id = '999202' OR role = 'Admin' OR role = 'Super Admin') AND disabled = false 
        LIMIT 1
      `;

      const [sdoRes, hrmoRes, adminRes] = await Promise.all([
        pool.query(sdoQuery, [self.division]),
        pool.query(hrmoQuery),
        pool.query(adminQuery)
      ]);

      return res.json({
        success: true,
        contacts: {
          SDOs: sdoRes.rows,
          HRMO: hrmoRes.rows[0] || null,
          ADMIN: adminRes.rows[0] || null
        }
      });

    } else if (self.role === 'School Division Office' || self.role === 'Regional Division Office' || self.role === 'RO/SDO' || self.role === 'Ro/sdo') {
      const schoolHeadsQuery = `
        SELECT uid, first_name, last_name, school_id, role 
        FROM users 
        WHERE (role = 'School Head' OR role = 'school_head') 
          AND division = $1 AND disabled = false
        ORDER BY last_name ASC
      `;
      const schoolHeadsRes = await pool.query(schoolHeadsQuery, [self.division]);
      
      const adminQuery = `
        SELECT uid, first_name, last_name, role 
        FROM users 
        WHERE (school_id = '999009' OR school_id = '999202' OR role = 'Admin' OR role = 'Super Admin') AND disabled = false 
        LIMIT 1
      `;
      const adminRes = await pool.query(adminQuery);

      return res.json({
        success: true,
        contacts: {
          schoolHeads: schoolHeadsRes.rows,
          ADMIN: adminRes.rows[0] || null
        }
      });
    }

    res.json({ success: true, contacts: {} });
  } catch (err) {
    console.error('[CHAT ROUTE] Contacts lookup failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [ROOMS] POST /api/chat/room
// Finds or creates a chat room between the logged-in user and a target user.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/chat/room', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;
  const { target_uid } = req.body;

  if (!target_uid) {
    return res.status(400).json({ success: false, error: 'target_uid is required.' });
  }

  if (userUid === target_uid) {
    return res.status(400).json({ success: false, error: 'Cannot chat with yourself.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userQuery = 'SELECT uid, role, region, division FROM users WHERE uid = $1';
    const targetUserRes = await client.query(userQuery, [target_uid]);
    if (targetUserRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }
    const targetUser = targetUserRes.rows[0];

    const selfRes = await client.query(userQuery, [userUid]);
    const selfUser = selfRes.rows[0];

    const region = targetUser.region || selfUser.region || null;
    const division = targetUser.division || selfUser.division || null;

    const checkRoomQuery = `
      SELECT p1.room_id 
      FROM chat_room_participants p1
      JOIN chat_room_participants p2 ON p1.room_id = p2.room_id
      JOIN chat_rooms r ON p1.room_id = r.id
      WHERE p1.user_uid = $1 AND p2.user_uid = $2 AND r.room_type = 'direct'
      LIMIT 1
    `;
    const checkRes = await client.query(checkRoomQuery, [userUid, target_uid]);

    if (checkRes.rowCount > 0) {
      await client.query('COMMIT');
      return res.json({ success: true, room_id: checkRes.rows[0].room_id });
    }

    const createRoomQuery = `
      INSERT INTO chat_rooms (room_type, region, division) 
      VALUES ('direct', $1, $2) 
      RETURNING id
    `;
    const roomRes = await client.query(createRoomQuery, [region, division]);
    const roomId = roomRes.rows[0].id;

    const addParticipantQuery = `
      INSERT INTO chat_room_participants (room_id, user_uid, user_role) 
      VALUES ($1, $2, $3)
    `;
    
    await client.query(addParticipantQuery, [roomId, userUid, selfUser.role]);
    await client.query(addParticipantQuery, [roomId, target_uid, targetUser.role]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, room_id: roomId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CHAT ROUTE] Create room error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [ROOMS] GET /api/chat/rooms
// Fetches all active chat rooms for the logged-in user, along with participant metadata and the last message.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/chat/rooms', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;

  const query = `
    SELECT 
      r.id AS room_id,
      r.room_type,
      r.region,
      r.division,
      r.updated_at,
      p.user_uid AS participant_uid,
      p.user_role AS participant_role,
      u.first_name,
      u.last_name,
      u.email,
      u.school_id,
      m.message_text AS last_message,
      m.sender_uid AS last_message_sender,
      m.created_at AS last_message_time
    FROM chat_rooms r
    JOIN chat_room_participants self ON r.id = self.room_id AND self.user_uid = $1
    JOIN chat_room_participants p ON r.id = p.room_id AND p.user_uid != $1
    JOIN users u ON p.user_uid = u.uid
    LEFT JOIN LATERAL (
      SELECT message_text, sender_uid, created_at 
      FROM chat_messages 
      WHERE room_id = r.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) m ON TRUE
    ORDER BY r.updated_at DESC
  `;

  try {
    const result = await pool.query(query, [userUid]);
    res.json({ success: true, rooms: result.rows });
  } catch (err) {
    console.error('[CHAT ROUTE] Fetch rooms error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MESSAGES] GET /api/chat/rooms/:roomId/messages
// Loads message history for a specific chat room chronologically.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/chat/rooms/:roomId/messages', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;
  const { roomId } = req.params;

  const membershipQuery = `
    SELECT 1 FROM chat_room_participants 
    WHERE room_id = $1 AND user_uid = $2
  `;

  try {
    const membershipRes = await pool.query(membershipQuery, [roomId, userUid]);
    if (membershipRes.rowCount === 0) {
      return res.status(403).json({ success: false, error: 'Unauthorized to view this room.' });
    }

    const messagesQuery = `
      SELECT 
        m.id,
        m.room_id,
        m.sender_uid,
        m.message_text,
        m.message_type,
        m.attachment_url,
        m.attachment_metadata,
        m.is_read,
        m.created_at,
        u.first_name,
        u.last_name,
        u.role AS sender_role,
        u.position AS sender_position
      FROM chat_messages m
      JOIN users u ON m.sender_uid = u.uid
      WHERE m.room_id = $1
      ORDER BY m.created_at ASC
    `;

    const messagesRes = await pool.query(messagesQuery, [roomId]);
    res.json({ success: true, messages: messagesRes.rows });
  } catch (err) {
    console.error('[CHAT ROUTE] Fetch messages error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MESSAGES] POST /api/chat/messages
// Sends a new message in a chat room.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/chat/messages', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;
  const { room_id, message_text, message_type, attachment_url, attachment_metadata } = req.body;

  if (!room_id) {
    return res.status(400).json({ success: false, error: 'room_id is required.' });
  }

  if (!message_text && !attachment_url) {
    return res.status(400).json({ success: false, error: 'Message body or attachment is required.' });
  }

  const membershipQuery = `
    SELECT 1 FROM chat_room_participants 
    WHERE room_id = $1 AND user_uid = $2
  `;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const membershipRes = await client.query(membershipQuery, [room_id, userUid]);
    if (membershipRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Unauthorized to post to this room.' });
    }

    const type = message_type || 'text';

    const insertMessageQuery = `
      INSERT INTO chat_messages (room_id, sender_uid, message_text, message_type, attachment_url, attachment_metadata) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `;
    const insertRes = await client.query(insertMessageQuery, [
      room_id,
      userUid,
      message_text || null,
      type,
      attachment_url || null,
      attachment_metadata ? JSON.stringify(attachment_metadata) : null
    ]);

    const updateRoomQuery = `
      UPDATE chat_rooms 
      SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await client.query(updateRoomQuery, [room_id]);

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CHAT ROUTE] Send message error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  } finally {
    client.release();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [ATTACHMENTS] POST /api/chat/upload
// Uploads media attachment to Azure Blob Storage with fallback to local disk storage.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/chat/upload', authMiddleware, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image file uploaded.' });
  }

  const fileBuffer = req.file.buffer;
  const fileName = `chat_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

  const isAzureConfigured = connectionString && 
    connectionString !== 'ReplaceWithYourAzureStorageConnectionString' &&
    !connectionString.includes('Replace');

  if (isAzureConfigured) {
    try {
      console.log('[CHAT UPLOAD] Uploading image to Azure Blob Storage...');
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient('chat-attachments');
      
      // Remove public access settings to support enterprise environments where public container access is disabled
      await containerClient.createIfNotExists();
      
      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype }
      });
      
      // Generate a Shared Access Signature (SAS) URL allowing long term browser access (e.g. 10 years)
      const expiryTime = new Date();
      expiryTime.setFullYear(expiryTime.getFullYear() + 10);
      
      const fileUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: expiryTime
      });

      console.log('[CHAT UPLOAD] Azure upload success (SAS URL):', fileUrl.split('?')[0]); // Log without query credentials
      return res.json({ success: true, url: fileUrl });
    } catch (err) {
      console.warn('[CHAT UPLOAD] Azure upload failed, falling back to local storage:', err.message);
    }
  }

  // Fallback to local storage (served via Express static static middleware under /uploads)
  try {
    console.log('[CHAT UPLOAD] Saving file locally...');
    const localUploadsDir = path.join(process.cwd(), 'uploads', 'chat');
    if (!fs.existsSync(localUploadsDir)) {
      fs.mkdirSync(localUploadsDir, { recursive: true });
    }

    const localFilePath = path.join(localUploadsDir, fileName);
    fs.writeFileSync(localFilePath, fileBuffer);

    const fileUrl = `/uploads/chat/${fileName}`;
    console.log('[CHAT UPLOAD] Local save success:', fileUrl);
    res.json({ success: true, url: fileUrl });
  } catch (err) {
    console.error('[CHAT UPLOAD] Storing image attachment failed:', err);
    res.status(500).json({ success: false, error: 'Failed to save attachment.' });
  }
});

export default router;
