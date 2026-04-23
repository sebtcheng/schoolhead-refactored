#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
safe_backlog_prune.py
=====================
Safe Batch Deletion for activity_logs.
Use this to clear the 62M row backlog without locking the database.
"""

import paramiko, sys, io, time

SERVER_IP = "20.24.58.49"
SSH_USER  = "Administrator1"
SSH_PASS  = "<REDACTED_SSH_PASS>"

PGB_HOST  = "127.0.0.1"
PGB_PORT  = "6432"
PGB_USER  = "Administrator1"
PGB_PASS  = "<REDACTED_PGB_PASS>"
APP_DB    = "insightEd"

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def main():
    print(f"🧹 Starting Safe Backlog Prune for {SERVER_IP}...")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=SERVER_IP, port=22, username=SSH_USER, password=SSH_PASS)
    except Exception as e:
        print(f"❌ SSH Connection failed: {e}")
        return

    # SQL for batch deletion
    # We delete logs older than 90 days in batches of 50,000
    batch_sql = """
    DO $$
    DECLARE
        deleted_count int;
        total_deleted int := 0;
    BEGIN
        LOOP
            DELETE FROM activity_logs
            WHERE log_id IN (
                SELECT log_id
                FROM activity_logs
                WHERE timestamp < NOW() - INTERVAL '90 days'
                LIMIT 50000
            );
            
            GET DIAGNOSTICS deleted_count = ROW_COUNT;
            total_deleted := total_deleted + deleted_count;
            
            EXIT WHEN deleted_count = 0;
            
            RAISE NOTICE 'Deleted % rows... Total: %', deleted_count, total_deleted;
            COMMIT; -- Commit the batch to free up WAL and locks
        END LOOP;
    END $$;
    """

    print("🚀 Executing batch deletion (this may take 5-15 minutes for 60M rows)...")
    print("⚠️  You can stop this anytime with Ctrl+C; progress is saved per batch.")
    
    # We use a long timeout since this is a heavy operation
    cmd = f"PGPASSWORD='{PGB_PASS}' psql -h {PGB_HOST} -p {PGB_PORT} -U {PGB_USER} -d {APP_DB} -c \"{batch_sql}\""
    
    stdin, stdout, stderr = client.exec_command(cmd, timeout=3600)
    
    # Stream the output so the user sees progress
    for line in stdout:
        print(line.strip())
    
    print("\n✅ Backlog Pruning Complete!")
    client.close()

if __name__ == "__main__":
    main()
