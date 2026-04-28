import os
import sys

def patch(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # PATCH 1: activity route
    content = content.replace("unit7, unit9, unit10,", "unit7, unit8, unit9, unit10,")
    content = content.replace("unit7_completed, unit9_completed, unit10_completed,", "unit7_completed, unit8_completed, unit9_completed, unit10_completed,")
    content = content.replace("const totalUnits = 9;", "const totalUnits = 10;")
    content = content.replace("const unitMapping = [1, 2, 3, 4, 5, 6, 7, 9, 10];", "const unitMapping = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];")

    # PATCH 2: progress route
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

    content = content.replace(target_p1, replace_p1)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"✅ Patch applied successfully to {file_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        patch(sys.argv[1])
    else:
        print("Usage: python patch.py <path_to_index.js>")
