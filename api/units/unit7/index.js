import express from 'express';
import { pool, safeQuery, updateSchoolTotalCompletion } from '../../utils/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 7 MASTER REPAIR/INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

// 7. GET /api/ph_schools/unit7/:id/master
router.get('/api/ph_schools/unit7/:id/master', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch Inventory grouped by building_name
    const invRes = await safeQuery('SELECT * FROM ph_buildings_inventory WHERE school_id = $1', [id]);

    const buildingsMap = {};
    invRes.rows.forEach(room => {
      const bName = room.building_name || 'Unnamed Building';
      if (!buildingsMap[bName]) {
        buildingsMap[bName] = {
          building_name: bName,
          category: room.category,
          storey: room.storey,
          classroom: room.classroom,
          status: room.status,
          remarks: room.remarks,
          year_completed: room.year_completed,
          rooms: []
        };
      }
      buildingsMap[bName].rooms.push({
        id: room.id,
        room_name: room.room_name,
        grade_level: room.grade_level,
        advisory_teacher: room.advisory_teacher,
        room_length: room.room_length,
        room_width: room.room_width,
        seats: room.seats,
        is_in_use: room.is_in_use,
        dimension: room.dimension,
        status: room.status,
        condition: room.status // Backward compatibility
      });
    });

    const inventory = Object.values(buildingsMap);

    // Fetch Repairs
    const repairRes = await safeQuery(`
      SELECT r.*, i.less_than_7x9, i."7x9", i.above_7x9 
      FROM ph_buildings_repairs r
      LEFT JOIN (
          SELECT DISTINCT ON (school_id, building_name, room_name) 
                 school_id, building_name, room_name, less_than_7x9, "7x9", above_7x9
          FROM ph_buildings_inventory
          ORDER BY school_id, building_name, room_name, id DESC
      ) i ON r.school_id = i.school_id 
        AND r.building_name = i.building_name 
        AND r.room_name = i.room_name
      WHERE r.school_id = $1
    `, [id]);

    // Fetch Unit 7 flags
    const schoolRes = await safeQuery('SELECT unit7_completed, unit7_has_no_building FROM ph_schools WHERE school_id = $1', [id]);
    const school = schoolRes.rows[0] || {};

    res.json({
      success: true,
      data: {
        inventory: inventory,
        repairs: repairRes.rows,
        isCompleted: school.unit7_completed === true,
        has_no_building: school.unit7_has_no_building === true
      }
    });
  } catch (err) {
    console.error("Unit 7 Master Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 8.5. GET /api/ph_schools/unit7/:id/spaces (UNIT 7 BUILDABLE SPACES)
router.get('/api/ph_schools/unit7/:id/spaces', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery('SELECT * FROM public.ph_school_buildable_spaces WHERE school_id = $1', [id]);
    res.json({
      success: true,
      spaces: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.5.1. POST /api/ph_schools/unit7/:id/spaces
router.post('/api/ph_schools/unit7/:id/spaces', async (req, res) => {
  try {
    const { id } = req.params;
    const { space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, iern } = req.body;

    const result = await safeQuery(
      `INSERT INTO ph_school_buildable_spaces (
        school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
      ]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8.5.2. DELETE /api/ph_schools/unit7/spaces/:spaceId
router.delete('/api/ph_schools/unit7/spaces/:spaceId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { spaceId } = req.params;
    await client.query('BEGIN');
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
    await client.query('DELETE FROM ph_school_buildable_spaces WHERE id = $1', [spaceId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ [DELETE Space] Error deleting space ${req.params.spaceId}:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 8.6. GET /api/unit8/teachers/:id (UNIT 7 ADVISORY TEACHER LOOKUP)
router.get('/api/unit8/teachers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await safeQuery(
      'SELECT first_name, last_name, id FROM ph_teachers_list WHERE school_id = $1',
      [id]
    );
    res.json({ success: true, teachers: result.rows });
  } catch (err) {
    console.error(`❌ [Teacher Lookup] Error for school ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 17. POST /api/save-physical-facilities (UNIT 7 SAVE)
router.post('/api/save-physical-facilities', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      school_id: sid_snake, schoolId: sid_camel, iern, inventoryEntries, rooms, repairEntries, demolitionEntries,
      build_classrooms_total, build_classrooms_new, build_classrooms_good,
      build_classrooms_repair, build_classrooms_demolition, spaces, has_no_building,
      u7_confirm_no_space
    } = req.body;
    const school_id = sid_snake || sid_camel;

    console.log(`🏗️ [Unit 7 Master] Processing payload for school ${school_id}...`);

    await client.query('BEGIN');
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");

    await client.query(
      `UPDATE ph_schools SET
       unit7_data = $1, unit7_rooms = $2, unit7_repair = $3, unit7_demolition = $4,
       unit7_spaces = $5, has_no_building = $6,
       build_classrooms_total = $7, build_classrooms_new = $8, build_classrooms_good = $9,
       build_classrooms_repair = $10, build_classrooms_demolition = $11,
       u7_confirm_no_space = $12,
       unit7 = 100, unit7_completed = TRUE, unit7_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $13`,
      [
        JSON.stringify(inventoryEntries), JSON.stringify(rooms), JSON.stringify(repairEntries),
        JSON.stringify(demolitionEntries), JSON.stringify(spaces), has_no_building,
        build_classrooms_total, build_classrooms_new, build_classrooms_good,
        build_classrooms_repair, build_classrooms_demolition, u7_confirm_no_space === true,
        school_id
      ]
    );

    console.log(`🧹 [Unit 7 Master] Clearing old records for school ${school_id} (IERN: ${iern})...`);
    const clearQuery = (table) => `DELETE FROM ${table} WHERE school_id = $1 OR iern = $2`;
    await client.query(clearQuery('ph_buildings_inventory'), [school_id, iern]);
    await client.query(clearQuery('ph_buildings_repairs'), [school_id, iern]);
    await client.query(clearQuery('ph_buildings_demolition'), [school_id, iern]);
    await client.query(clearQuery('ph_school_buildable_spaces'), [school_id, iern]);

    if (Array.isArray(rooms) && rooms.length > 0) {
      console.log(`🏢 [Unit 7 Master] Inserting ${rooms.length} rooms into ph_buildings_inventory...`);
      for (const room of rooms) {
        try {
          const b = (inventoryEntries || []).find(inv => inv.id === room.building_local_id) || {};
          const storeyVal = parseInt(b.storey);
          const classroomVal = parseInt(b.classroom);

          await client.query(
            `INSERT INTO ph_buildings_inventory (
              school_id, iern, building_name, room_name, category, storey, classroom, 
              year_completed, remarks, status, is_in_use, seats, grade_level, advisory_teacher,
              less_than_7x9, "7x9", above_7x9, dimension
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              school_id, iern, room.building_name, room.room_name, b.category,
              isNaN(storeyVal) ? 1 : storeyVal,
              isNaN(classroomVal) ? 1 : classroomVal,
              b.year_completed, b.remarks, room.status, room.is_in_use !== false,
              ((room.grade_level || "").includes("Non-Instructional") ? null : room.seats),
              room.grade_level, room.teacher_id,
              (room.less_than_7x9 === 1 || (room.dimension || '').toLowerCase() === 'less than 7x9' ? 1 : 0),
              (room["7x9"] === 1 || (room.dimension || '').toLowerCase() === '7x9' ? 1 : 0),
              (room.above_7x9 === 1 || (room.dimension || '').toLowerCase() === 'above 7x9' ? 1 : 0),
              room.dimension
            ]
          );
        } catch (roomErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert room: ${room.room_name}`, roomErr.message);
          throw roomErr;
        }
      }
    }

    if (Array.isArray(repairEntries) && repairEntries.length > 0) {
      console.log(`🛠️ [Unit 7 Master] Inserting ${repairEntries.length} repair entries...`);
      for (const rep of repairEntries) {
        try {
          const damageVal = parseInt(rep.damage_ratio);
          await client.query(
            `INSERT INTO ph_buildings_repairs (
              school_id, iern, building_name, room_name, item_name, oms, 
              condition, damage_ratio, recommended_action, demo_justification, remarks
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              school_id, iern, rep.building_no, rep.room_no, rep.item_name, rep.oms,
              rep.condition, isNaN(damageVal) ? 0 : damageVal, rep.recommended_action,
              rep.demo_justification, rep.remarks
            ]
          );
        } catch (repErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert repair entry for building: ${rep.building_no}`, repErr.message);
          throw repErr;
        }
      }
    }

    if (Array.isArray(demolitionEntries) && demolitionEntries.length > 0) {
      console.log(`🏚️ [Unit 7 Master] Inserting ${demolitionEntries.length} demolition entries...`);
      for (const demo of demolitionEntries) {
        try {
          await client.query(
            `INSERT INTO ph_buildings_demolition (
              school_id, iern, building_name, room_name, age, safety, calamity, upgrade,
              less_than_7x9, "7x9", above_7x9
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              school_id, iern, demo.building_name, demo.room_name,
              demo.age === true || demo.age === 'true',
              demo.safety === true || demo.safety === 'true',
              demo.calamity === true || demo.calamity === 'true',
              demo.upgrade === true || demo.upgrade === 'true',
              parseInt(demo.less_than_7x9) || 0,
              parseInt(demo["7x9"]) || 0,
              parseInt(demo.above_7x9) || 0
            ]
          );
        } catch (demoErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert demolition entry: ${demo.building_name}`, demoErr.message);
          throw demoErr;
        }
      }
    }

    if (Array.isArray(spaces) && spaces.length > 0) {
      console.log(`📐 [Unit 7 Master] Inserting ${spaces.length} buildable spaces...`);
      for (const s of spaces) {
        try {
          const lat = parseFloat(s.center_lat);
          const lng = parseFloat(s.center_lng);
          const len = parseFloat(s.length_m);
          const wid = parseFloat(s.width_m);
          const rot = parseFloat(s.rotation_deg);
          const area = parseFloat(s.total_area_sqm);

          await client.query(
            `INSERT INTO ph_school_buildable_spaces (
              school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (iern, space_name) DO NOTHING`,
            [
              school_id, iern, s.space_name,
              isNaN(lat) ? 0 : lat, isNaN(lng) ? 0 : lng,
              isNaN(len) ? 0 : len, isNaN(wid) ? 0 : wid,
              isNaN(rot) ? 0 : rot, isNaN(area) ? 0 : area
            ]
          );
        } catch (spaceErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert space: ${s.space_name}`, spaceErr.message);
          throw spaceErr;
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ [Unit 7 Master] School ${school_id} finalized and normalized successfully.`);
    await updateSchoolTotalCompletion(iern).catch(() => { });
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ [Unit 7 Master] Error for school ${req.body.school_id}:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export { router as unit7Router };
export default router;
