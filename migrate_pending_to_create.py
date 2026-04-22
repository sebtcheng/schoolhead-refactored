import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
is_local = "20.24.58.49" in db_url or "localhost" in db_url or "127.0.0.1" in db_url

def migrate_projects():
    conn = None
    try:
        # Connect to the database
        conn = psycopg2.connect(db_url, sslmode='disable' if is_local else 'require')
        cur = conn.cursor()
        
        # 1. Get the list of projects to migrate
        cur.execute("SELECT project_id FROM engineer_form WHERE approval_status = 'Pending'")
        project_ids = [row[0] for row in cur.fetchall()]
        
        if not project_ids:
            print("No pending projects found to migrate.")
            return

        print(f"Migrating {len(project_ids)} projects...")

        # 2. Get all column names for engineer_form
        cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'engineer_form' AND table_schema = 'public'")
        columns = [row[0] for row in cur.fetchall()]
        col_string = ", ".join(columns)

        # 3. Perform the migration within a transaction
        # Copy to engineer_create
        insert_query = f"""
            INSERT INTO engineer_create ({col_string})
            SELECT {col_string} FROM engineer_form
            WHERE approval_status = 'Pending'
            ON CONFLICT (project_id) DO NOTHING;
        """
        cur.execute(insert_query)
        inserted_count = cur.rowcount
        print(f"Successfully inserted {inserted_count} projects into engineer_create.")

        # 4. Delete from engineer_form
        delete_query = "DELETE FROM engineer_form WHERE approval_status = 'Pending'"
        cur.execute(delete_query)
        deleted_count = cur.rowcount
        print(f"Successfully removed {deleted_count} projects from engineer_form.")

        # Commit the transaction
        conn.commit()
        print("Migration completed successfully.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error during migration: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate_projects()
