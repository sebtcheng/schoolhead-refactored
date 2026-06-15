def find_unique_insert_targets():
    targets = set()
    with open('ph_schools_04282026.sqlite', 'r', encoding='utf-8', errors='ignore') as f:
        for line in f:
            if 'INSERT INTO' in line:
                # Find what table name it targets
                # e.g., INSERT INTO public.ph_schools
                # let's extract it using regex
                import re
                m = re.search(r'INSERT INTO\s+([^\s\(]+)', line)
                if m:
                    targets.add(m.group(1))
    print("Unique target tables being inserted into:", targets)

if __name__ == '__main__':
    find_unique_insert_targets()
