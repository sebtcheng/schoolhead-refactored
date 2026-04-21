import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(os.getenv('DATABASE_URL'), sslmode='require')
cur = conn.cursor()
cur.execute("UPDATE esf7_link SET status='QUEUED'")
conn.commit()
print('Reset all links to QUEUED')
