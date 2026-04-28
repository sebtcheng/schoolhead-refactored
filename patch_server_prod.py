import os

FILE_PATH = "/var/www/html/InsightEd-Mobile-PWA/api/index.js"

def patch():
    if not os.path.exists(FILE_PATH):
        print(f"File not found: {FILE_PATH}")
        return

    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # PATCH 1: activity route (Update query and count)
    target_q1 = "`SELECT\n        school_id, school_name,\n        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit9, unit10,"
    replace_q1 = "`SELECT\n        school_id, school_name,\n        unit1, unit2, unit3, unit4, unit5, unit6, unit7, unit8, unit9, unit10,"
    
    target_q2 = "unit5_completed, unit6_completed, unit7_completed, unit9_completed, unit10_completed,"
    replace_q2 = "unit5_completed, unit6_completed, unit7_completed, unit8_completed, unit9_completed, unit10_completed,"
    
    target_q3 = "const totalUnits = 9;"
    replace_q3 = "const totalUnits = 10;"
    
    target_q4 = "const unitMapping = [1, 2, 3, 4, 5, 6, 7, 9, 10];"
    replace_q4 = "const unitMapping = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];"

    # PATCH 2: progress route (Mapping and pushing)
    # The production file has hardcoded pushes for 8 and 9 which map to Unit 9 and 10
    # I will replace the block from Unit 8 onwards with a more standard mapping
    target_p1 = """      // ── Unit 8: School Terrain (Old Unit 9) ─────────────────────────────
      let u9 = row.unit9_completed;
      if (!u9) {
        const ck = await pool.query(`SELECT COUNT(*) as cnt FROM school_location_profiles WHERE school_id = $1`, [schoolId]).catch(() => ({ rows: [{ cnt: 0 }] }));
        if (parseInt(ck.rows[0]?.cnt) > 0) { u9 = true; backfillClauses.push(`unit9_completed = TRUE, unit9 = 1`); }
      }
      if (u9) { completedUnits.push(8); xp += 500; } else if (row.unit9 === 2) { incompleteUnits.push(8); }

      // ── Unit 9: Verification (Old Unit 10) ──────────────────────────────
      if (row.unit10_completed) { completedUnits.push(9); xp += 500; } else if (row.unit10 === 2) { incompleteUnits.push(9); }"""

    replace_p1 = """      // ── Unit 8: School Resources (Unit 8) ────────────────────────────────
      if (row.unit8_completed || row.unit8 == 1) { completedUnits.push(8); xp += 400; } else if (row.unit8 === 2) { incompleteUnits.push(8); }

      // ── Unit 9: School Terrain (Unit 9) ─────────────────────────────
      let u9 = row.unit9_completed;
      if (!u9) {
        const ck = await pool.query(`SELECT COUNT(*) as cnt FROM school_location_profiles WHERE school_id = $1`, [schoolId]).catch(() => ({ rows: [{ cnt: 0 }] }));
        if (parseInt(ck.rows[0]?.cnt) > 0) { u9 = true; backfillClauses.push(`unit9_completed = TRUE, unit9 = 1`); }
      }
      if (u9) { completedUnits.push(9); xp += 500; } else if (row.unit9 === 2) { incompleteUnits.push(9); }

      // ── Unit 10: Verification (Unit 10) ──────────────────────────────
      if (row.unit10_completed || row.unit10 == 1) { completedUnits.push(10); xp += 500; } else if (row.unit10 === 2) { incompleteUnits.push(10); }"""

    # Apply Patches
    content = content.replace(target_q1, replace_q1)
    content = content.replace(target_q2, replace_q2)
    content = content.replace(target_q3, replace_q3)
    content = content.replace(target_q4, replace_q4)
    content = content.replace(target_p1, replace_p1)

    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Patch applied successfully!")

if __name__ == "__main__":
    patch()
