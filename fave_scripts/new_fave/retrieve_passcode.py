
import os
import psycopg2
from dotenv import load_dotenv
import sys

# Load environment variables from .env file in the parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

def find_passcode(username):
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ Error: DATABASE_URL not found in .env file.")
        return

    try:
        # Connect to the database
        conn = psycopg2.connect(database_url, sslmode='require')
        cur = conn.cursor()

        # Query the users table
        query = "SELECT email, school_id, passcode FROM users WHERE email = %s OR school_id = %s OR uid = %s"
        cur.execute(query, (username, username, username))
        
        row = cur.fetchone()

        if not row:
            print(f"\n[!] No user found with ID/Email: \"{username}\"")
        else:
            email, school_id, passcode = row
            print(f"\n[+] User Found:")
            print(f"Email: {email}")
            print(f"School ID: {school_id if school_id else 'N/A'}")
            print(f"Passcode: {passcode if passcode else 'No passcode set'}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n[ERROR] Database Error: {str(e)}")

if __name__ == "__main__":
    # Check for command line argument
    if len(sys.argv) > 1:
        find_passcode(sys.argv[1])
    else:
        try:
            username = input("Enter the Username (Email or School ID): ").strip()
            if not username:
                print("Error: Username cannot be empty.")
            else:
                find_passcode(username)
        except KeyboardInterrupt:
            print("\nExiting...")
