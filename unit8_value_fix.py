import os

def fix(file_path):
    if not os.path.exists(file_path):
        print(f"ERR: {file_path}")
        return
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # The loop I previously added checks `row[`unit${i}_completed`] === true || row[`unit${i}`] == 1`
    # For unit8, the DB stores unit8 = 100 (not 1), so the `== 1` check fails.
    # Fix: change `== 1` to `>= 1` so that unit8=100 is treated as complete
    old = "const isDone = row[`unit${i}_completed`] === true || row[`unit${i}`] == 1;"
    new = "const isDone = row[`unit${i}_completed`] === true || parseInt(row[`unit${i}`] || 0) >= 1;"
    
    if old in content:
        content = content.replace(old, new)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ FIXED: {file_path}")
    else:
        # Fallback: the old logic used hardcoded unit8 check
        # Check if unit8_completed is the determining factor
        old2 = "if (row.unit8_completed || row.unit8 == 1) { completedUnits.push(8);"
        new2 = "if (row.unit8_completed || parseInt(row.unit8 || 0) >= 1) { completedUnits.push(8);"
        if old2 in content:
            content = content.replace(old2, new2)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ FIXED (fallback): {file_path}")
        else:
            print(f"⚠️  Pattern not found in {file_path}, trying aggressive approach...")
            # Also try fixing the activity route unitMapping logic  
            # In the activity route, unit8 uses `isDone = (intVal === 1 || boolVal)` which also fails for intVal=100
            old3 = "const isDone = (intVal === 1 || boolVal);"
            new3 = "const isDone = (intVal >= 1 || boolVal);"
            if old3 in content:
                content = content.replace(old3, new3)
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f"✅ FIXED activity route: {file_path}")
            else:
                print(f"❌ Could not patch: {file_path}")

if __name__ == "__main__":
    fix("/var/www/html/InsightEd-Mobile-PWA/insighted-schoolhead/api/index.js")
    fix("/var/www/html/InsightEd-Mobile-PWA/api/index.js")
