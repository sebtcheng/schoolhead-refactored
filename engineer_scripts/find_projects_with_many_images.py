"""
find_projects_with_many_images.py
──────────────────────────────────────────────────────────────────────────────
Identifies engineer_form projects that have uploaded MORE THAN 5 images in
the engineer_image table.

Reports per project:
  - project_id
  - ipc
  - total image count
  - breakdown by category (Internal / External / NULL)

Usage:
    python engineer_scripts/find_projects_with_many_images.py

Optional: change THRESHOLD below to adjust the limit.
──────────────────────────────────────────────────────────────────────────────
"""

import psycopg2
import os
import re
import csv
from datetime import datetime

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False

THRESHOLD = 5  # flag projects with MORE THAN this many images


# ── helpers ──────────────────────────────────────────────────────────────────

def get_db_url():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if not os.path.exists(env_path):
        raise FileNotFoundError(f".env file not found at {env_path}")
    with open(env_path, 'r') as f:
        match = re.search(r'DATABASE_URL\s*=\s*(.*)', f.read())
        if match:
            return match.group(1).strip()
    return None


def parse_db_url(url):
    """Parse postgres://user:pass@host:port/db into psycopg2 kwargs."""
    pattern = r'postgres(?:ql)?://([^:]+):([^@]+)@([^:/]+):?(\d*)/(.+)'
    m = re.match(pattern, url)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {url}")
    user, password, host, port, dbname = m.groups()
    return {
        'host':     host,
        'port':     int(port) if port else 5432,
        'dbname':   dbname,
        'user':     user,
        'password': password,
        'sslmode':  'require',
    }


# ── main ─────────────────────────────────────────────────────────────────────

def find_projects_with_many_images():
    db_url = get_db_url()
    if not db_url:
        print("❌  DATABASE_URL not found in .env")
        return

    conn = psycopg2.connect(**parse_db_url(db_url))
    cur  = conn.cursor()

    # ── 1. Projects exceeding the threshold ──────────────────────────────────
    cur.execute("""
        SELECT
            ei.project_id,
            ei.ipc,
            COUNT(*)                                            AS total_images,
            COUNT(*) FILTER (WHERE ei.category = 'Internal')   AS internal_count,
            COUNT(*) FILTER (WHERE ei.category = 'External')   AS external_count,
            COUNT(*) FILTER (WHERE ei.category IS NULL
                              OR ei.category NOT IN ('Internal','External'))
                                                                AS other_count,
            ef.school_name,
            ef.project_name,
            ef.division,
            ef.region
        FROM engineer_image ei
        LEFT JOIN (
            SELECT DISTINCT ON (ipc) ipc, school_name, project_name, division, region
            FROM engineer_form
            ORDER BY ipc, project_id DESC
        ) ef ON ef.ipc = ei.ipc
        GROUP BY ei.project_id, ei.ipc, ef.school_name, ef.project_name, ef.division, ef.region
        HAVING COUNT(*) > %s
        ORDER BY total_images DESC
    """, (THRESHOLD,))

    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]

    cur.close()
    conn.close()

    # ── 2. Print report ───────────────────────────────────────────────────────
    print()
    print("=" * 90)
    print(f"  Projects with MORE THAN {THRESHOLD} images  (threshold = {THRESHOLD})")
    print("=" * 90)

    if not rows:
        print(f"\n  ✅  No projects found with more than {THRESHOLD} images.\n")
        return

    print(f"\n  Found {len(rows)} project(s):\n")

    table_data = []
    for i, row in enumerate(rows, 1):
        record = dict(zip(cols, row))
        table_data.append([
            i,
            record['project_id'],
            record['ipc'] or 'NO IPC',
            record['total_images'],
            record['internal_count'],
            record['external_count'],
            record['other_count'],
            (record.get('school_name') or 'N/A')[:40],
            (record.get('project_name') or 'N/A')[:40],
            (record.get('division') or '')[:25],
            (record.get('region') or '')[:20],
        ])

    headers = ['#', 'project_id', 'ipc', 'total', 'int', 'ext', 'other',
               'school_name', 'project_name', 'division', 'region']

    if HAS_TABULATE:
        print(tabulate(table_data, headers=headers, tablefmt='grid'))
    else:
        # fallback: plain aligned table
        col_widths = [max(len(str(h)), max((len(str(r[i])) for r in table_data), default=0))
                      for i, h in enumerate(headers)]
        sep = '+-' + '-+-'.join('-' * w for w in col_widths) + '-+'
        def fmt_row(r):
            return '| ' + ' | '.join(str(r[i]).ljust(col_widths[i]) for i in range(len(headers))) + ' |'
        print(sep)
        print(fmt_row(headers))
        print(sep)
        for r in table_data:
            print(fmt_row(r))
        print(sep)

    # ── 3. Summary ────────────────────────────────────────────────────────────
    total_images_flagged = sum(dict(zip(cols, r))['total_images'] for r in rows)
    print()
    print("-" * 90)
    print(f"  Total flagged projects : {len(rows)}")
    print(f"  Total images in these  : {total_images_flagged}")
    print(f"  Threshold used         : > {THRESHOLD} images per project")
    print("=" * 90)
    print()

    # ── 4. Export to CSV ──────────────────────────────────────────────────────
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    csv_filename = f"projects_many_images_{timestamp}.csv"
    csv_path = os.path.join(os.path.dirname(__file__), csv_filename)

    csv_headers = ['project_id', 'ipc', 'total_images', 'internal_count',
                   'external_count', 'other_count', 'school_name',
                   'project_name', 'division', 'region']

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(csv_headers)
        for row in rows:
            record = dict(zip(cols, row))
            writer.writerow([
                record['project_id'],
                record['ipc'] or '',
                record['total_images'],
                record['internal_count'],
                record['external_count'],
                record['other_count'],
                record.get('school_name') or '',
                record.get('project_name') or '',
                record.get('division') or '',
                record.get('region') or '',
            ])

    print(f"  CSV exported → {csv_path}\n")


if __name__ == '__main__':
    find_projects_with_many_images()
