import os
import psycopg2
import csv
from urllib.parse import urlparse

def get_db_url():
    """Reads the DATABASE_URL from the .env file in the root directory."""
    # Look for .env in the parent directory of this script's location
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if line.startswith('DATABASE_URL='):
                    return line.split('=', 1)[1].strip()
    return None

def main():
    db_url = get_db_url()
    if not db_url:
        print("Error: DATABASE_URL not found in .env file.")
        return

    try:
        # Connect to the database
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Query for registered architects and division engineers
        # We want: first name, last name, email, contact number, and role
        query = """
            SELECT first_name, last_name, email, contact_number, role
            FROM users
            WHERE role IN ('Architect', 'Division Engineer')
            ORDER BY role, last_name, first_name;
        """
        
        cur.execute(query)
        rows = cur.fetchall()

        if not rows:
            print("No registered architects or division engineers found.")
            return

        # Prepare data for CSV and identifying counts
        data = []
        counts = {'Architect': 0, 'Division Engineer': 0}
        
        for row in rows:
            record = {
                'First Name': row[0],
                'Last Name': row[1],
                'Email': row[2],
                'Contact Number': row[3],
                'Role': row[4]
            }
            data.append(record)
            if record['Role'] in counts:
                counts[record['Role']] += 1

        # Print summary
        print("-" * 50)
        print("SUMMARY REPORT")
        print("-" * 50)
        print(f"Total Architects: {counts['Architect']}")
        print(f"Total Division Engineers: {counts['Division Engineer']}")
        print(f"Total Identified: {len(data)}")
        print("-" * 50)

        # Export to CSV
        csv_filename = os.path.join(os.path.dirname(__file__), 'registered_eng_architect.csv')
        keys = ['First Name', 'Last Name', 'Email', 'Contact Number', 'Role']
        
        with open(csv_filename, 'w', newline='') as output_file:
            dict_writer = csv.DictWriter(output_file, fieldnames=keys)
            dict_writer.writeheader()
            dict_writer.writerows(data)

        print(f"Data successfully exported to: {csv_filename}")
        print("-" * 50)

        # Close database connection
        cur.close()
        conn.close()

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    main()
