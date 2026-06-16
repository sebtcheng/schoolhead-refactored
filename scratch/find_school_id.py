def find_id(search_str):
    with open('ph_schools_04282026.sqlite', 'r', encoding='utf-8', errors='ignore') as f:
        for i, line in enumerate(f):
            if search_str in line:
                print(f"Line {i+1}: {line[:300]} ... [len={len(line)}]")

if __name__ == '__main__':
    find_id('301781')
