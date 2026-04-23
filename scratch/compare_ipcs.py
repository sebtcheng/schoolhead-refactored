import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(os.path.join(os.getcwd(), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")

# Fallback in case .env loading fails or DATABASE_URL is missing
if not DATABASE_URL:
    DATABASE_URL = "postgres://Administrator1:<REDACTED_PGB_PASS>@20.24.58.49:6432/insightEd"

def compare_ipcs():
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        print("\n" + "="*60)
        print("      IPC COMPARISON: ENGINEER FORMS VS BEFF TABLES")
        print("="*60)

        # 1. Total IPCs in engineer_form
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_form WHERE ipc IS NOT NULL AND ipc != ''")
        ef_ipcs = cur.fetchone()[0]
        
        # 2. Total IPCs in engineer_imported_beff
        cur.execute("SELECT COUNT(DISTINCT ipc) FROM engineer_imported_beff WHERE ipc IS NOT NULL AND ipc != ''")
        beff_ipcs = cur.fetchone()[0]

        # 3. Common IPCs
        cur.execute("""
            SELECT COUNT(DISTINCT e.ipc)
            FROM engineer_form e
            JOIN engineer_imported_beff b ON e.ipc = b.ipc
            WHERE e.ipc IS NOT NULL AND e.ipc != ''
        """)
        common_ipcs = cur.fetchone()[0]

        print(f"\n[REPORT]")
        print(f"Total Unique IPCs in Engineer Forms      : {ef_ipcs}")
        print(f"Total Unique IPCs in Imported BEFF Tables : {beff_ipcs}")
        print(f"Common Unique IPCs                       : {common_ipcs}")
        
        if (ef_ipcs > 0):
            overlap_pct = (common_ipcs / ef_ipcs) * 100
            print(f"Overlap (Common / Engineer Forms)        : {overlap_pct:.2f}%")

        print("="*60 + "\n")

        cur.close()
    except Exception as e:
        print(f"\n[ERROR]: Failed to compare IPCs.")
        print(f"Details: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    compare_ipcs()
