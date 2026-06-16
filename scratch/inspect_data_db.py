import sqlite3

def inspect_db(path):
    print(f"Inspecting {path}...")
    try:
        conn = sqlite3.connect(path)
        cursor = conn.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Tables:", tables)
        for t in tables:
            t_name = t[0]
            cursor.execute(f"PRAGMA table_info({t_name});")
            cols = cursor.fetchall()
            print(f"Columns for {t_name}:", [c[1] for c in cols])
    except Exception as e:
        print("Error:", e)

if __name__ == '__main__':
    inspect_db('data/db/extracted_data.db')
    inspect_db('data/db/extracted_data_flattened.db')
