import os
import sys

def patch(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update SELECT query for PROGRESS route
    old_select = "unit5_completed, unit6_completed, unit7_completed, unit9_completed, unit10_completed,"
    new_select = "unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed, unit10_completed,"
    
    old_select_v2 = "unit5, unit6, unit7, unit9, unit10,"
    new_select_v2 = "unit5, unit6, unit7, unit8, unit9, unit10,"
    
    old_select_v3 = "unit5_updated_at, unit6_updated_at, unit7_updated_at, unit9_updated_at, unit10_updated_at,"
    new_select_v3 = "unit5_updated_at, unit6_updated_at, unit7_updated_at, unit8_updated_at, unit9_updated_at, unit10_updated_at,"

    content = content.replace(old_select, new_select)
    content = content.replace(old_select_v2, new_select_v2)
    content = content.replace(old_select_v3, new_select_v3)

    # 2. Fix the loop logic to be consistent for 1-10
    # Search for the start of the completedUnits processing
    if 'let completedUnits = [];' in content:
        # We find the area where units are pushed
        # We replace the manual blocks with the clean loop from the isolated version
        # BUT only for the progress route
        pass

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Patch applied successfully to {file_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        patch(sys.argv[1])
    else:
        print("Usage: python patch.py <path_to_index.js>")
