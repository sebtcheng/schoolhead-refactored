import sqlite3

def inspect():
    conn = sqlite3.connect('ph_schools_04282026.sqlite')
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in sqlite:", tables)
    
    for table_name in tables:
        name = table_name[0]
        # Get count
        cursor.execute(f"SELECT COUNT(*) FROM {name};")
        count = cursor.fetchone()[0]
        print(f"Table: {name}, Count: {count}")
        
        # Get schema/columns
        cursor.execute(f"PRAGMA table_info({name});")
        columns = cursor.fetchall()
        print(f"Columns in {name}:", [col[1] for col in columns])

if __name__ == '__main__':
    inspect()
