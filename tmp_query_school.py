import psycopg2
from urllib.parse import urlparse

url = 'postgres://Administrator1:pRZTbQ2T1JD7@20.24.58.49:6432/insightEd'
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute("""
    SELECT 
        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10, 
        unit1_completed, unit2_completed, unit3_completed, unit4_completed, 
        unit5_completed, unit6_completed, unit7_completed, unit8_completed, 
        unit9_completed, unit10_completed 
    FROM ph_schools 
    WHERE school_id::text = '999009'
""")
row = cur.fetchone()
if row:
    cols = [desc[0] for desc in cur.description]
    res = dict(zip(cols, row))
    for k, v in res.items():
        print(f"{k}: {v}")
else:
    print("School not found")
conn.close()
