import express from 'express';
import { pool, safeQuery } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 7 MASTER REPAIR/INVENTORY
// NEW TABLES: unit7_buildings_inventory, unit7_buildings_repairs,
//             unit7_buildings_demolition, unit7_school_buildable_spaces,
//             unit7_facilities
// ─────────────────────────────────────────────────────────────────────────────

// 7. GET /api/ph_schools/unit7/:id/master
router.get('/api/ph_schools/unit7/:id/master', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';

    // Fetch Inventory grouped by building_name
    const invRes = await safeQuery('SELECT * FROM unit7_buildings_inventory WHERE school_id = $1 AND school_yr = $2', [id, schoolYr]);

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
      FROM unit7_buildings_repairs r
      LEFT JOIN (
          SELECT DISTINCT ON (school_id, building_name, room_name) 
                 school_id, building_name, room_name, less_than_7x9, "7x9", above_7x9
          FROM unit7_buildings_inventory
          WHERE school_yr = $2
          ORDER BY school_id, building_name, room_name, id DESC
      ) i ON r.school_id = i.school_id 
        AND r.building_name = i.building_name 
        AND r.room_name = i.room_name
      WHERE r.school_id = $1 AND r.school_yr = $2
    `, [id, schoolYr]);

    // Fetch unit7_facilities summary (completion status + counters)
    const facilitiesRes = await safeQuery('SELECT * FROM unit7_facilities WHERE school_id = $1 AND school_yr = $2', [id, schoolYr]);
    const facilities = facilitiesRes.rows[0] || null;

    res.json({
      success: true,
      data: {
        inventory: inventory,
        repairs: repairRes.rows,
        isCompleted: facilities?.unit7_completed === true,
        has_no_building: facilities?.unit7_has_buildable_space === false,
        facilities: facilities
      }
    });
  } catch (err) {
    console.error("Unit 7 Master Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 7.1 GET /api/ph_schools/unit7/:id/facilities (READ MODE — unit7_facilities summary)
router.get('/api/ph_schools/unit7/:id/facilities', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';
    const result = await safeQuery(
      'SELECT * FROM unit7_facilities WHERE school_id = $1 AND school_yr = $2',
      [id, schoolYr]
    );
    res.json({
      success: true,
      facilities: result.rows[0] || null
    });
  } catch (err) {
    console.error(`❌ [Unit 7 Facilities Read] Error for school ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// 8.5. GET /api/ph_schools/unit7/:id/spaces (UNIT 7 BUILDABLE SPACES)
router.get('/api/ph_schools/unit7/:id/spaces', async (req, res) => {
  try {
    const { id } = req.params;
    const schoolYr = req.query.school_yr || 'SY 26-27';
    const result = await safeQuery('SELECT * FROM unit7_school_buildable_spaces WHERE school_id = $1 AND school_yr = $2', [id, schoolYr]);
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
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, iern, school_yr } = req.body;
    const schoolYr = school_yr || 'SY 26-27';

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO unit7_school_buildable_spaces (
        school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, school_yr
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (iern, space_name, school_yr) DO UPDATE SET
        center_lat = EXCLUDED.center_lat,
        center_lng = EXCLUDED.center_lng,
        length_m = EXCLUDED.length_m,
        width_m = EXCLUDED.width_m,
        rotation_deg = EXCLUDED.rotation_deg,
        total_area_sqm = EXCLUDED.total_area_sqm
      RETURNING id`,
      [id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, schoolYr]
    );
    await client.query('COMMIT');
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ [POST Space] Error for school ${req.params.id}:`, err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 8.5.2. DELETE /api/ph_schools/unit7/spaces/:spaceId
router.delete('/api/ph_schools/unit7/spaces/:spaceId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { spaceId } = req.params;
    await client.query('BEGIN');
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");
    await client.query('DELETE FROM unit7_school_buildable_spaces WHERE id = $1', [spaceId]);
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
      u7_confirm_no_space, school_yr
    } = req.body;
    const school_id = sid_snake || sid_camel;
    const schoolYr = school_yr || 'SY 26-27';

    console.log(`🏗️ [Unit 7 Master] Processing payload for school ${school_id}...`);

    await client.query('BEGIN');
    await client.query("SET LOCAL internal.authorized_app_deletion = 'true'");



    // ── Clear NEW unit7_ tables ───────────────────────────────────────────────
    console.log(`🧹 [Unit 7 Master] Clearing old records for school ${school_id} (IERN: ${iern}, school_yr: ${schoolYr})...`);
    const clearQuery = (table) => `DELETE FROM ${table} WHERE (school_id = $1 OR iern = $2) AND school_yr = $3`;
    await client.query(clearQuery('unit7_buildings_inventory'), [school_id, iern, schoolYr]);
    await client.query(clearQuery('unit7_buildings_repairs'), [school_id, iern, schoolYr]);
    await client.query(clearQuery('unit7_buildings_demolition'), [school_id, iern, schoolYr]);
    await client.query(clearQuery('unit7_school_buildable_spaces'), [school_id, iern, schoolYr]);

    // ── Insert into unit7_buildings_inventory ─────────────────────────────────
    if (Array.isArray(rooms) && rooms.length > 0) {
      console.log(`🏢 [Unit 7 Master] Inserting ${rooms.length} rooms into unit7_buildings_inventory...`);
      for (const room of rooms) {
        try {
          const b = (inventoryEntries || []).find(inv => inv.id === room.building_local_id) || {};
          const storeyVal = parseInt(b.storey);
          const classroomVal = parseInt(b.classroom);

          await client.query(
            `INSERT INTO unit7_buildings_inventory (
              school_id, iern, building_name, room_name, category, storey, classroom,
              year_completed, remarks, status, is_in_use, seats, grade_level,
              less_than_7x9, "7x9", above_7x9, dimension, school_yr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
            [
              school_id, iern, room.building_name, room.room_name, b.category,
              isNaN(storeyVal) ? 1 : storeyVal,
              isNaN(classroomVal) ? 1 : classroomVal,
              b.year_completed, b.remarks, room.status, room.is_in_use !== false,
              ((room.grade_level || "").includes("Non-Instructional") ? null : room.seats),
              room.grade_level,
              (room.less_than_7x9 === 1 || (room.dimension || '').toLowerCase() === 'less than 7x9' ? 1 : 0),
              (room["7x9"] === 1 || (room.dimension || '').toLowerCase() === '7x9' ? 1 : 0),
              (room.above_7x9 === 1 || (room.dimension || '').toLowerCase() === 'above 7x9' ? 1 : 0),
              room.dimension,
              schoolYr
            ]
          );
        } catch (roomErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert room: ${room.room_name}`, roomErr.message);
          throw roomErr;
        }
      }
    }

    // ── Insert into unit7_buildings_repairs ───────────────────────────────────
    if (Array.isArray(repairEntries) && repairEntries.length > 0) {
      console.log(`🛠️ [Unit 7 Master] Inserting ${repairEntries.length} repair entries...`);
      for (const rep of repairEntries) {
        try {
          const damageVal = parseInt(rep.damage_ratio);
          await client.query(
            `INSERT INTO unit7_buildings_repairs (
              school_id, iern, building_name, room_name, item_name, oms,
              condition, damage_ratio, recommended_action, demo_justification, remarks, school_yr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              school_id, iern, rep.building_no, rep.room_no, rep.item_name, rep.oms,
              rep.condition, isNaN(damageVal) ? 0 : damageVal, rep.recommended_action,
              rep.demo_justification, rep.remarks, schoolYr
            ]
          );
        } catch (repErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert repair: ${rep.building_no}`, repErr.message);
          throw repErr;
        }
      }
    }

    // ── Insert into unit7_buildings_demolition ────────────────────────────────
    if (Array.isArray(demolitionEntries) && demolitionEntries.length > 0) {
      console.log(`🏚️ [Unit 7 Master] Inserting ${demolitionEntries.length} demolition entries...`);
      for (const demo of demolitionEntries) {
        try {
          await client.query(
            `INSERT INTO unit7_buildings_demolition (
              school_id, iern, building_name, room_name, age, safety, calamity, upgrade,
              less_than_7x9, "7x9", above_7x9, school_yr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [
              school_id, iern, demo.building_name, demo.room_name,
              demo.age === true || demo.age === 'true',
              demo.safety === true || demo.safety === 'true',
              demo.calamity === true || demo.calamity === 'true',
              demo.upgrade === true || demo.upgrade === 'true',
              parseInt(demo.less_than_7x9) || 0,
              parseInt(demo["7x9"]) || 0,
              parseInt(demo.above_7x9) || 0,
              schoolYr
            ]
          );
        } catch (demoErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert demolition: ${demo.building_name}`, demoErr.message);
          throw demoErr;
        }
      }
    }

    // ── Insert into unit7_school_buildable_spaces ─────────────────────────────
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
            `INSERT INTO unit7_school_buildable_spaces (
              school_id, iern, space_name, center_lat, center_lng, length_m, width_m, rotation_deg, total_area_sqm, school_yr
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (iern, space_name, school_yr) DO NOTHING`,
            [
              school_id, iern, s.space_name,
              isNaN(lat) ? 0 : lat, isNaN(lng) ? 0 : lng,
              isNaN(len) ? 0 : len, isNaN(wid) ? 0 : wid,
              isNaN(rot) ? 0 : rot, isNaN(area) ? 0 : area,
              schoolYr
            ]
          );
        } catch (spaceErr) {
          console.error(`❌ [Unit 7 Master] Failed to insert space: ${s.space_name}`, spaceErr.message);
          throw spaceErr;
        }
      }
    }

    // ── Upsert unit7_facilities summary ───────────────────────────────────────
    const noBuildings = Array.isArray(inventoryEntries) ? inventoryEntries.length : 0;
    const noRooms = Array.isArray(rooms) ? rooms.length : 0;
    const noSpaces = Array.isArray(spaces) ? spaces.length : 0;

    // Count rooms where status indicates repair — reads from unit7_buildings_inventory.status
    const REPAIR_STATUSES = ['repair', 'for repair', 'for major repairs', 'for minor repairs'];
    const noRepairs = Array.isArray(rooms)
      ? rooms.filter(r => REPAIR_STATUSES.includes((r.status || '').toLowerCase().trim())).length
      : 0;

    const noDemolitions = Array.isArray(demolitionEntries) ? demolitionEntries.length : 0;
    const hasSpace = !u7_confirm_no_space;

    await client.query(`
      INSERT INTO unit7_facilities (
        iern, school_id, school_yr,
        unit7, unit7_completed, unit7_updated_at,
        unit7_no_buildings, unit7_no_rooms,
        unit7_has_buildable_space, unit7_no_buildable_space,
        unit7_no_repair_rooms, unit7_no_demolition,
        updated_at
      ) VALUES ($1, $2, $3, 100, TRUE, CURRENT_TIMESTAMP, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (iern, school_yr) DO UPDATE SET
        school_id = EXCLUDED.school_id,
        unit7 = 100,
        unit7_completed = TRUE,
        unit7_updated_at = CURRENT_TIMESTAMP,
        unit7_no_buildings = EXCLUDED.unit7_no_buildings,
        unit7_no_rooms = EXCLUDED.unit7_no_rooms,
        unit7_has_buildable_space = EXCLUDED.unit7_has_buildable_space,
        unit7_no_buildable_space = EXCLUDED.unit7_no_buildable_space,
        unit7_no_repair_rooms = EXCLUDED.unit7_no_repair_rooms,
        unit7_no_demolition = EXCLUDED.unit7_no_demolition,
        updated_at = CURRENT_TIMESTAMP
    `, [iern, school_id, schoolYr, noBuildings, noRooms, hasSpace, noSpaces, noRepairs, noDemolitions]);

    await client.query('COMMIT');
    console.log(`✅ [Unit 7 Master] School ${school_id} finalized and normalized successfully.`);

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
