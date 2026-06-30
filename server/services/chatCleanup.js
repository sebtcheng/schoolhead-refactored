import pg from 'pg';
import { BlobServiceClient } from '@azure/storage-blob';
import fs from 'fs';
import path from 'path';

export async function autoCleanOldChats() {
  const pool = new pg.Pool({
    connectionString: 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging',
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    console.log('[CHAT CLEANUP] Scanning for chat messages older than 1 month...');

    // 1. Find all messages older than 30 days
    const expiredMessagesRes = await client.query(`
      SELECT id, message_type, attachment_url 
      FROM chat_messages 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);

    const expiredMessages = expiredMessagesRes.rows;
    if (expiredMessages.length === 0) {
      console.log('[CHAT CLEANUP] No expired messages found.');
      client.release();
      return;
    }

    console.log(`[CHAT CLEANUP] Found ${expiredMessages.length} expired messages to delete.`);

    // Get connection string from process environment
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const isAzureConfigured = connectionString && 
      connectionString !== 'ReplaceWithYourAzureStorageConnectionString' &&
      !connectionString.includes('Replace');

    let containerClient = null;
    if (isAzureConfigured) {
      try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        containerClient = blobServiceClient.getContainerClient('chat-attachments');
      } catch (err) {
        console.error('[CHAT CLEANUP] Failed to initialize Azure client:', err.message);
      }
    }

    for (const msg of expiredMessages) {
      if (msg.message_type === 'image' && msg.attachment_url) {
        // If it's an Azure blob URL
        if (msg.attachment_url.includes('strideazureblobstorage') && containerClient) {
          try {
            const urlObj = new URL(msg.attachment_url);
            const pathParts = urlObj.pathname.split('/');
            const blobName = pathParts[pathParts.length - 1];
            
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            await blockBlobClient.deleteIfExists();
            console.log(`[CHAT CLEANUP] Deleted Azure blob: ${blobName}`);
          } catch (err) {
            console.error(`[CHAT CLEANUP] Error deleting Azure blob for message ${msg.id}:`, err.message);
          }
        } 
        // If it's a local filesystem fallback
        else if (msg.attachment_url.startsWith('/uploads/chat/')) {
          try {
            const fileName = msg.attachment_url.replace('/uploads/chat/', '');
            const localFilePath = path.join(process.cwd(), 'uploads', 'chat', fileName);
            if (fs.existsSync(localFilePath)) {
              fs.unlinkSync(localFilePath);
              console.log(`[CHAT CLEANUP] Deleted local file: ${fileName}`);
            }
          } catch (err) {
            console.error(`[CHAT CLEANUP] Error deleting local file for message ${msg.id}:`, err.message);
          }
        }
      }
    }

    // 3. Delete messages from database
    const deleteRes = await client.query(`
      DELETE FROM chat_messages 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    console.log(`[CHAT CLEANUP] Successfully deleted ${deleteRes.rowCount} database records.`);

    client.release();
  } catch (err) {
    console.error('[CHAT CLEANUP] Error running chat cleanup:', err);
  } finally {
    await pool.end();
  }
}
