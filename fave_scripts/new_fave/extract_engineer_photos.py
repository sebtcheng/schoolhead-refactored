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
    parser.add_argument('--limit', type=int, default=50, help='Limit number of images to extract (default: 50)')
    parser.add_argument('--ipc', type=str, help='Filter by IPC')
    parser.add_argument('--output', type=str, default=default_output, help='Output directory')
    parser.add_argument('--all', action='store_true', help='Extract ALL images (bypasses limit)')
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
        # Use a named cursor (server-side cursor) to avoid loading all results into memory
        cur = conn.cursor('image_extract_cursor')
        
        # Check total count first if no limit is specified or if requested
        count_cur = conn.cursor()

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
        
        # Apply limit unless --all is specified
        limit_to_use = args.limit
        if args.all:
            print("⚠️ WARNING: Extracting ALL images. This may stress the database.")
            limit_to_use = None
        
        if limit_to_use:
            query += " LIMIT %s"
            params.append(limit_to_use)

        print(f"Executing query (Limit: {limit_to_use if limit_to_use else 'NONE'})...")
        
        # Fetch count for progress bar
        count_query = f"SELECT COUNT(*) FROM ({query}) AS sub"
        count_cur.execute(count_query, params)
        total_rows = count_cur.fetchone()[0]
        count_cur.close()
        
        print(f"Found {total_rows} images to extract.")

        cur.execute(query, params)
        
        # Process rows one by one
        i = 0
        while True:
            row = cur.fetchone()
            if not row:
                break
            image_id, project_id, ipc, content, mime_type = row
            
            clean_ipc = sanitize_filename(ipc)
            ext = get_extension(mime_type)
            filename = f"{clean_ipc}_{project_id}_{image_id}{ext}"
            filepath = os.path.join(output_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(content)
            
            # Progress Monitoring (Eye of Horus Protocol)
            count = i + 1
            total = total_rows
            percent = (count / total) * 100 if total > 0 else 0
            bar_length = 30
            filled_length = int(bar_length * count // total) if total > 0 else 0
            bar = '█' * filled_length + '-' * (bar_length - filled_length)
            
            sys.stdout.write(f"\r[{bar}] {percent:>.1f}% ({count}/{total}) | Latest: {filename[:40]}...")
            sys.stdout.flush()
            i += 1

        conn.close()
        print(f"\n\n✅ Extraction complete! Files saved to: {output_dir}")

    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
