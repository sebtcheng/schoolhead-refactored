import os
import sys
import psycopg2
import re
from dotenv import load_dotenv
import argparse

def sanitize_filename(name):
    """
    Sanitize the string for use as a filename.
    Removes newlines, multiple spaces, and non-alphanumeric characters except dash and underscore.
    """
    if not name:
        return "UNKNOWN"
    # Remove newlines and excess whitespace
    name = re.sub(r'\s+', ' ', name).strip()
    # Remove characters that are not filename friendly
    name = re.sub(r'[^\w\s-]', '', name)
    # Replace spaces with underscores
    name = name.replace(' ', '_')
    return name

def get_extension(mime_type):
    """
    Map MIME types to file extensions.
    """
    mapping = {
        'image/webp': '.webp',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'application/pdf': '.pdf'
    }
    return mapping.get(mime_type, '.bin')

def main():
    parser = argparse.ArgumentParser(description='Extract Engineer Images from Database')
    default_output = os.path.join(os.path.expanduser("~"), "Desktop", "insighted_engr_photos")
    parser.add_argument('--limit', type=int, help='Limit number of images to extract')
    parser.add_argument('--ipc', type=str, help='Filter by IPC')
    parser.add_argument('--output', type=str, default=default_output, help='Output directory')
    args = parser.parse_args()

    load_dotenv()
    db_url = os.getenv('DATABASE_URL')

    if not db_url:
        print("ERROR: DATABASE_URL not found in .env")
        sys.exit(1)

    output_dir = args.output
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created directory: {output_dir}")

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        query = """
            SELECT 
                ei.id as image_id,
                ei.project_id,
                ef.ipc,
                ub.content,
                ub.mime_type
            FROM engineer_image ei
            JOIN engineer_form ef ON ei.project_id = ef.project_id
            JOIN unified_binaries ub ON ei.binary_id = ub.id
            WHERE 1=1
        """
        params = []
        if args.ipc:
            query += " AND ef.ipc ILIKE %s"
            params.append(f"%{args.ipc}%")
        
        query += " ORDER BY ei.created_at DESC"
        
        if args.limit:
            query += " LIMIT %s"
            params.append(args.limit)

        print("Executing query...")
        cur.execute(query, params)
        rows = cur.fetchall()
        print(f"Found {len(rows)} images to extract.")

        for i, row in enumerate(rows):
            image_id, project_id, ipc, content, mime_type = row
            
            clean_ipc = sanitize_filename(ipc)
            ext = get_extension(mime_type)
            filename = f"{clean_ipc}_{project_id}_{image_id}{ext}"
            filepath = os.path.join(output_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(content)
            
            # Progress Monitoring (Eye of Horus Protocol)
            count = i + 1
            total = len(rows)
            percent = (count / total) * 100
            bar_length = 30
            filled_length = int(bar_length * count // total)
            bar = '█' * filled_length + '-' * (bar_length - filled_length)
            
            sys.stdout.write(f"\r[{bar}] {percent:>.1f}% ({count}/{total}) | Latest: {filename[:40]}...")
            sys.stdout.flush()

        conn.close()
        print(f"\n\n✅ Extraction complete! Files saved to: {output_dir}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
