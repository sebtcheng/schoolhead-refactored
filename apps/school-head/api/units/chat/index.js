import express from 'express';
import authMiddleware from '@shared/auth';
import { poolChat as pool, poolUsers } from '@shared/db';
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
// [HELPERS] User profile resolution strictly via poolUsers (user_schoolhead & user_rosdo)
// ─────────────────────────────────────────────────────────────────────────────
async function findUserByUid(userUid) {
  if (!userUid) return null;
  try {
    const shRes = await poolUsers.query(
      'SELECT uid, first_name, last_name, email, role, position, region, division, school_id FROM user_schoolhead WHERE uid = $1 OR seq_id::text = $1',
      [userUid]
    );
    if (shRes.rowCount > 0) return shRes.rows[0];
  } catch (e) {}

  try {
    const rosdoRes = await poolUsers.query(
      'SELECT uid, first_name, last_name, email, role, position, region, division, school_id FROM user_rosdo WHERE uid = $1 OR seq_id::text = $1',
      [userUid]
    );
    if (rosdoRes.rowCount > 0) return rosdoRes.rows[0];
  } catch (e) {}

  return null;
}

async function getUsersByUids(uids) {
  const userMap = {};
  if (!uids || uids.length === 0) return userMap;

  const uniqueUids = [...new Set(uids.filter(Boolean))];
  if (uniqueUids.length === 0) return userMap;

  try {
    const shRes = await poolUsers.query(
      'SELECT uid, first_name, last_name, email, role, position, school_id FROM user_schoolhead WHERE uid = ANY($1)',
      [uniqueUids]
    );
    shRes.rows.forEach(u => { userMap[u.uid] = u; });
  } catch (e) {}

  try {
    const rosdoRes = await poolUsers.query(
      'SELECT uid, first_name, last_name, email, role, position, school_id FROM user_rosdo WHERE uid = ANY($1)',
      [uniqueUids]
    );
    rosdoRes.rows.forEach(u => { userMap[u.uid] = u; });
  } catch (e) {}

  return userMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// [CONTACTS] GET /api/chat/contacts
// Looks up valid target chat contacts strictly from user_rosdo and user_schoolhead in poolUsers.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/api/chat/contacts', authMiddleware, async (req, res) => {
  const userUid = req.user?.uid || req.user?.id || req.user?.user_id;

  try {
    const self = (await findUserByUid(userUid)) || {
      uid: userUid,
      role: req.user?.role || 'School Head',
      division: req.user?.division || '',
      school_id: req.user?.school_id || ''
    };

    if (self.role === 'School Head' || self.role === 'school_head' || self.school_id) {
      const designationFilter = req.query.designation || 'Division SBM Coordinator';

      const sdoQuery = `
        SELECT uid, first_name, last_name, role, position, designation, division 
        FROM user_rosdo 
        WHERE (role ILIKE '%School Division Office%' OR role ILIKE '%RO/SDO%' OR role ILIKE '%sdo%' OR role ILIKE '%Division%')
          AND (disabled = false OR disabled IS NULL)
          AND ($1::text IS NULL OR $1::text = '' OR LOWER(TRIM(division)) = LOWER(TRIM($1)))
          AND ($2::text IS NULL OR $2::text = '' OR designation ILIKE '%' || $2 || '%' OR position ILIKE '%' || $2 || '%')
        ORDER BY 
          CASE WHEN LOWER(TRIM(COALESCE(division, ''))) = LOWER(TRIM(COALESCE($1, ''))) THEN 0 ELSE 1 END,
          last_name ASC, first_name ASC
      `;
      const adminQuery = `
        SELECT uid, first_name, last_name, role, position 
        FROM user_rosdo 
        WHERE (school_id = '999009' OR school_id = '999202' OR role ILIKE '%Admin%') AND (disabled = false OR disabled IS NULL)
        LIMIT 1
      `;

      let [sdoRes, adminRes] = await Promise.all([
        poolUsers.query(sdoQuery, [self.division || '', designationFilter]),
        poolUsers.query(adminQuery).catch(() => ({ rows: [] }))
      ]);

      // Fallback: If no coordinator with exact designation exists for the division, fetch general division SDO contacts
      if (sdoRes.rows.length === 0 && self.division) {
        const fallbackSdoQuery = `
          SELECT uid, first_name, last_name, role, position, designation, division 
          FROM user_rosdo 
          WHERE (role ILIKE '%School Division Office%' OR role ILIKE '%RO/SDO%' OR role ILIKE '%sdo%' OR role ILIKE '%Division%')
            AND (disabled = false OR disabled IS NULL)
            AND LOWER(TRIM(division)) = LOWER(TRIM($1))
          ORDER BY last_name ASC, first_name ASC
        `;
        sdoRes = await poolUsers.query(fallbackSdoQuery, [self.division]);
      }

      return res.json({
        success: true,
        contacts: {
          SDOs: sdoRes.rows,
          ADMIN: adminRes.rows[0] || null
        }
      });

    } else {
      const schoolHeadsQuery = `
        SELECT uid, first_name, last_name, school_id, role 
        FROM user_schoolhead 
        WHERE (role ILIKE '%School Head%') 
          AND LOWER(TRIM(division)) = LOWER(TRIM($1)) AND (disabled = false OR disabled IS NULL)
        ORDER BY last_name ASC
      `;
      const schoolHeadsRes = await poolUsers.query(schoolHeadsQuery, [self.division]);

      const adminQuery = `
        SELECT uid, first_name, last_name, role 
        FROM user_rosdo 
        WHERE (school_id = '999009' OR school_id = '999202' OR role ILIKE '%Admin%') AND (disabled = false OR disabled IS NULL)
        LIMIT 1
      `;
      const adminRes = await poolUsers.query(adminQuery).catch(() => ({ rows: [] }));

      return res.json({
        success: true,
        contacts: {
          schoolHeads: schoolHeadsRes.rows,
          ADMIN: adminRes.rows[0] || null
        }
      });
    }
  } catch (err) {
    console.error('[CHAT ROUTE] Contacts lookup failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [ROOMS] POST /api/chat/room
// Finds or creates a chat room between the logged-in user and a target user.
// Uses poolUsers (user_schoolhead & user_rosdo) for profiles and pool (poolChat) for room creation.
// Enforces Division Jurisdiction guard.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/api/chat/room', authMiddleware, async (req, res) => {
  const userUid = req.user?.uid || req.user?.id || req.user?.user_id;
  const { target_uid } = req.body;

  if (!target_uid) {
    return res.status(400).json({ success: false, error: 'target_uid is required.' });
  }

  if (userUid === target_uid) {
    return res.status(400).json({ success: false, error: 'Cannot chat with yourself.' });
  }

  try {
    const targetUser = await findUserByUid(target_uid);
    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found.' });
    }

    const selfUser = (await findUserByUid(userUid)) || {
      uid: userUid,
      first_name: req.user?.first_name || 'School Head',
      last_name: req.user?.last_name || '',
      role: req.user?.role || 'School Head',
      division: req.user?.division || '',
      region: req.user?.region || '',
      school_id: req.user?.school_id || ''
    };

    // Enforce Division Jurisdiction guard for non-admin chats
    const isTargetAdmin = targetUser.role && targetUser.role.toLowerCase().includes('admin');
    const isSelfAdmin = selfUser.role && selfUser.role.toLowerCase().includes('admin');

    if (!isTargetAdmin && !isSelfAdmin && selfUser.division) {
      const normDiv = (str) => (str || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      if (normDiv(selfUser.division) !== normDiv(targetUser.division)) {
        return res.status(403).json({
          success: false,
          error: `Jurisdiction Restriction: You can only communicate with users within your division (${selfUser.division}).`
        });
      }
    }

    const region = targetUser.region || selfUser.region || null;
    const division = targetUser.division || selfUser.division || null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

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
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[CHAT ROUTE] Create room error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [ROOMS] GET /api/chat/rooms
// Fetches all active chat rooms for logged-in user from poolChat,
// and merges participant metadata from poolUsers (user_schoolhead & user_rosdo).
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
      m.message_text AS last_message,
      m.sender_uid AS last_message_sender,
      m.created_at AS last_message_time,
      COALESCE(u_cnt.unread_count, 0)::int AS unread_count
    FROM chat_rooms r
    JOIN chat_room_participants self ON r.id = self.room_id AND self.user_uid = $1
    JOIN chat_room_participants p ON r.id = p.room_id AND p.user_uid != $1
    LEFT JOIN LATERAL (
      SELECT message_text, sender_uid, created_at 
      FROM chat_messages 
      WHERE room_id = r.id 
      ORDER BY created_at DESC 
      LIMIT 1
    ) m ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS unread_count
      FROM chat_messages
      WHERE room_id = r.id AND sender_uid::text != $1::text AND (is_read = false OR is_read IS NULL)
    ) u_cnt ON TRUE
    ORDER BY r.updated_at DESC
  `;

  try {
    const result = await pool.query(query, [userUid]);
    const rooms = result.rows;

    const participantUids = rooms.map(r => r.participant_uid);
    const userMap = await getUsersByUids(participantUids);

    const enrichedRooms = rooms.map(room => {
      const u = userMap[room.participant_uid] || {};
      return {
        ...room,
        first_name: u.first_name || 'User',
        last_name: u.last_name || '',
        email: u.email || '',
        school_id: u.school_id || ''
      };
    });

    res.json({ success: true, rooms: enrichedRooms });
  } catch (err) {
    console.error('[CHAT ROUTE] Fetch rooms error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MESSAGES] PUT /api/chat/rooms/:roomId/read
// Marks all unread incoming messages in a specific chat room as read.
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/chat/rooms/:roomId/read', authMiddleware, async (req, res) => {
  const userUid = req.user.uid;
  const { roomId } = req.params;

  try {
    const updateQuery = `
      UPDATE chat_messages
      SET is_read = true
      WHERE room_id = $1 AND sender_uid::text != $2::text AND (is_read = false OR is_read IS NULL)
    `;
    await pool.query(updateQuery, [roomId, userUid]);
    res.json({ success: true, message: 'Messages marked as read.' });
  } catch (err) {
    console.error('[CHAT ROUTE] Mark messages read error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MESSAGES] GET /api/chat/rooms/:roomId/messages
// Loads message history for a specific room from poolChat,
// and attaches sender details from poolUsers (user_schoolhead & user_rosdo).
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

    // Auto mark unread messages sent by others as read
    await pool.query(
      `UPDATE chat_messages SET is_read = true WHERE room_id = $1 AND sender_uid::text != $2::text AND (is_read = false OR is_read IS NULL)`,
      [roomId, userUid]
    );

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
        m.created_at
      FROM chat_messages m
      WHERE m.room_id = $1
      ORDER BY m.created_at ASC
    `;

    const messagesRes = await pool.query(messagesQuery, [roomId]);
    const messages = messagesRes.rows;

    const senderUids = messages.map(m => m.sender_uid);
    const userMap = await getUsersByUids(senderUids);

    const enrichedMessages = messages.map(m => {
      const u = userMap[m.sender_uid] || {};
      return {
        ...m,
        first_name: u.first_name || 'User',
        last_name: u.last_name || '',
        sender_role: u.role || 'User',
        sender_position: u.position || null
      };
    });

    res.json({ success: true, messages: enrichedMessages });
  } catch (err) {
    console.error('[CHAT ROUTE] Fetch messages error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// [MESSAGES] POST /api/chat/messages
// Sends a new message in a chat room (poolChat).
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
      INSERT INTO chat_messages (room_id, sender_uid, message_text, message_type, attachment_url, attachment_metadata, is_read) 
      VALUES ($1, $2, $3, $4, $5, $6, false) 
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

      await containerClient.createIfNotExists();

      const blockBlobClient = containerClient.getBlockBlobClient(fileName);
      await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
        blobHTTPHeaders: { blobContentType: req.file.mimetype }
      });

      const expiryTime = new Date();
      expiryTime.setFullYear(expiryTime.getFullYear() + 10);

      const fileUrl = await blockBlobClient.generateSasUrl({
        permissions: BlobSASPermissions.parse("r"),
        expiresOn: expiryTime
      });

      console.log('[CHAT UPLOAD] Azure upload success (SAS URL):', fileUrl.split('?')[0]);
      return res.json({ success: true, url: fileUrl });
    } catch (err) {
      console.warn('[CHAT UPLOAD] Azure upload failed, falling back to local storage:', err.message);
    }
  }

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
