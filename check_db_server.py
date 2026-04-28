import psycopg2
import json

def check():
    try:
        conn = psycopg2.connect("dbname='insighted_db' user='postgres' host='localhost'")
        cur = conn.cursor()
        cur.execute("SELECT unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10, unit1_completed, unit2_completed, unit3_completed, unit4_completed, unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed, unit10_completed FROM ph_schools WHERE school_id = '999009'")
        row = cur.fetchone()
        colnames = [desc[0] for desc in cur.description]
        if row:
            res = dict(zip(colnames, row))
            print(json.dumps(res, indent=2))
        else:
            print("School 999009 not found")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check()
