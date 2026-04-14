#!/usr/bin/env python3
"""
Script to detect missing school IDs in ph_schools but not in users table 
and create default accounts for them.
"""
import os
import sys
import uuid
import bcrypt
import psycopg2
import argparse
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

def main():
    parser = argparse.ArgumentParser(description="Create missing school user accounts.")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be done without making changes.")
    parser.add_argument("--limit", type=int, default=None, help="Limit the number of accounts to create.")
    args = parser.parse_args()

    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("ERROR: DATABASE_URL not found in .env", file=sys.stderr)
        sys.exit(1)

    print("--- Missing School Account Creator Initialized ---")
    if args.dry_run:
        print("[DRY RUN MODE] No changes will be saved to the database.")

    try:
        conn = psycopg2.connect(db_url)
        # Use RealDictCursor for easier access to columns by name
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # 1. Identify missing school IDs
        print("🔍 Scanning for missing school accounts...")
        query_missing = """
            SELECT p.school_id, p.iern, p.school_name, p.region, p.division, p.province, p.municipality, p.barangay
            FROM ph_schools p
            LEFT JOIN users u ON p.school_id = u.school_id
            WHERE u.school_id IS NULL
        """
        if args.limit:
            query_missing += f" LIMIT {args.limit}"
            
        cur.execute(query_missing)
        missing_schools = cur.fetchall()

        if not missing_schools:
            print("✅ No missing school accounts found. Everything is up to date.")
            return

        print(f"📌 Found {len(missing_schools)} missing school accounts.")

        # 2. Prepare default credentials
        default_password = "123456"
        default_passcode = "123456"
        
        print("🔐 Hashing default password (this may take a moment)...")
        password_hash = bcrypt.hashpw(default_password.encode('utf-8'), bcrypt.gensalt(10)).decode('utf-8')

        # 3. Create accounts
        created_count = 0
        for school in missing_schools:
            school_id = school['school_id']
            email = f"{school_id}@deped.gov.ph"
            uid = str(uuid.uuid4())
            
            print(f"🔧 Preparing account for: {school['school_name']} (ID: {school_id}, Email: {email})")
            
            if not args.dry_run:
                insert_query = """
                    INSERT INTO users (
                        uid, email, role, region, division, province, city, barangay, 
                        password_hash, hash_version, iern, school_id, passcode, 
                        registration_status, registrant_type, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """
                cur.execute(insert_query, (
                    uid,
                    email,
                    'School Head',
                    school['region'],
                    school['division'],
                    school['province'],
                    school['municipality'], # city mapping
                    school['barangay'],
                    password_hash,
                    'bcrypt',
                    school['iern'],
                    school_id,
                    default_passcode,
                    'Valid',
                    'School Head'
                ))
            
            created_count += 1
            if created_count % 10 == 0:
                print(f"⏳ Processed {created_count} schools...")

        if not args.dry_run:
            conn.commit()
            print(f"🚀 Successfully created {created_count} school accounts.")
        else:
            print(f"📝 Dry run complete. Would have created {created_count} school accounts.")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"💥 CRITICAL ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        if conn:
            cur.close()
            conn.close()

if __name__ == "__main__":
    main()
