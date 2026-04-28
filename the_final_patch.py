import os
import sys

FILE_PATH = "/var/www/html/InsightEd-Mobile-PWA/api/index.js"

def apply_final_fix():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    new_lines = []
    in_progress_route = False
    skip_mode = False
    
    for line in lines:
        if "app.get('/api/ph_schools/progress/:schoolId'" in line:
            in_progress_route = True
            new_lines.append(line)
            continue
            
        if in_progress_route:
            # 1. Update the SELECT query within the route
            if "const querySelect = `SELECT" in line:
                new_lines.append("    const querySelect = `SELECT \n")
                new_lines.append("        unit1_completed, unit2_completed, unit3_completed, unit4_completed, \n")
                new_lines.append("        unit5_completed, unit6_completed, unit7_completed, unit8_completed, \n")
                new_lines.append("        unit9_completed, unit10_completed, curricular_offering, \n")
                new_lines.append("        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10, \n")
                new_lines.append("        unit1_updated_at, unit2_updated_at, unit3_updated_at, unit4_updated_at, \n")
                new_lines.append("        unit5_updated_at, unit6_updated_at, unit7_updated_at, unit8_updated_at, \n")
                new_lines.append("        unit9_updated_at, unit10_updated_at, \n")
                new_lines.append("        school_name, total_enrollment \n")
                new_lines.append("       FROM ph_schools`;\n")
                skip_mode = True # Skip until end of SELECT
                continue
                
            if skip_mode and "FROM ph_schools" in line:
                skip_mode = False
                continue
            
            if skip_mode:
                continue

            # 2. Update the logic loop
            if "let completedUnits = [];" in line:
                new_lines.append(line)
                new_lines.append("    let incompleteUnits = [];\n")
                new_lines.append("    let xp = 0;\n")
                new_lines.append("    const unitsToTrack = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];\n")
                new_lines.append("    const timestamps = {};\n")
                new_lines.append("    for (const i of unitsToTrack) {\n")
                new_lines.append("      const isDone = row[`unit${i}_completed`] === true || row[`unit${i}`] == 1;\n")
                new_lines.append("      if (isDone) {\n")
                new_lines.append("        completedUnits.push(i);\n")
                new_lines.append("        xp += 500;\n")
                new_lines.append("      } else if (row[`unit${i}`] === 2) {\n")
                new_lines.append("        incompleteUnits.push(i);\n")
                new_lines.append("      }\n")
                new_lines.append("      if (row[`unit${i}_updated_at`]) {\n")
                new_lines.append("        timestamps[`unit${i}`] = row[`unit${i}_updated_at`];\n")
                new_lines.append("      }\n")
                new_lines.append("    }\n")
                skip_mode = "logic"
                continue
            
            if skip_mode == "logic" and "res.json" in line:
                skip_mode = False
                new_lines.append(line)
                in_progress_route = False # Done with route
                continue
                
            if skip_mode == "logic":
                continue
        
        new_lines.append(line)

    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("✅ ULTIMATE PATCH APPLIED!")

if __name__ == "__main__":
    apply_final_fix()
