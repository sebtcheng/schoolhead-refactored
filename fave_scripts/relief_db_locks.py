import os
import time
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

# Azure PostgreSQL Credentials (from environment or defaults)
DB_HOST = os.getenv("DATABASE_HOST", "stride-posgre-prod-01.postgres.database.azure.com")
DB_NAME = os.getenv("DATABASE_NAME", "insightEd")
DB_USER = os.getenv("DATABASE_USER", "Administrator1")
DB_PASS = os.getenv("DATABASE_PASS", "pRZTbQ2T1JD7")
DB_PORT = os.getenv("DATABASE_PORT", "5432")

def relief_db_locks():
    """
    Emergency DB Relief: Terminates long-running and blocking sessions.
    - Active queries > 5 minutes
    - Idle-in-transaction sessions > 5 minutes
    - Connections waiting on a lock
    """
    conn = None
    try:
        # Connect directly to Postgres (bypass PgBouncer if possible for admin tasks)
        print(f"📡 Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME}...")
        conn = psycopg2.connect(
            host=DB_HOST,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASS,
            port=DB_PORT,
            sslmode='require'
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()

        print("🔬 Auditing sessions for lock cascades and long-running anti-patterns...")

        # Step 1: Terminate 'Root Blockers' (Long-running active/idle-in-transaction)
        kill_blockers_query = """
        SELECT pg_terminate_backend(pid), pid, state, now() - query_start as duration, query
        FROM pg_stat_activity 
        WHERE datname = %s
          AND pid <> pg_backend_pid()
          AND (
            (state = 'active' AND now() - query_start > interval '5 minutes') OR
            (state = 'idle in transaction' AND now() - state_change > interval '5 minutes')
          )
        ORDER BY duration DESC;
        """
        cur.execute(kill_blockers_query, (DB_NAME,))
        terminated_blockers = cur.fetchall()
        
        if terminated_blockers:
            print(f"✅ Terminated {len(terminated_blockers)} long-running blockers:")
            for success, pid, state, duration, query in terminated_blockers:
                print(f"  - [PID {pid}] {state} for {duration}. Query: {query[:80]}...")
        else:
            print("✅ No long-running blockers (>5m) found.")

        # Step 2: Terminate 'Waiting' connections (Immediate relief for pool saturation)
        kill_waiters_query = """
        SELECT pg_terminate_backend(pid), pid, wait_event_type, query
        FROM pg_stat_activity
        WHERE datname = %s
          AND wait_event_type = 'Lock'
          AND pid <> pg_backend_pid();
        """
        cur.execute(kill_waiters_query, (DB_NAME,))
        terminated_waiters = cur.fetchall()

        if terminated_waiters:
            print(f"🔥 Terminated {len(terminated_waiters)} connections waiting on locks.")
        else:
            print("✅ No connections currently waiting on locks.")

        # Step 3: Current Status Summary
        cur.execute("SELECT count(*), state FROM pg_stat_activity WHERE datname = %s GROUP BY state", (DB_NAME,))
        stats = cur.fetchall()
        print("\n📊 Current Database Session Status:")
        for count, state in stats:
            print(f"  - {state or 'null'}: {count}")

        cur.close()
    except Exception as e:
        print(f"❌ Error during lock relief: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    print("🆘 PostgreSQL Emergency Lock Relief Script [v2.0]")
    print("-------------------------------------------------")
    relief_db_locks()
    print("-------------------------------------------------")
    print("Done. If site is still down, check PgBouncer logs or Azure metrics.")
