import express from 'express';
import { pool } from '@shared/db';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// [QUEST] UNIT 6: SCHOOL RESOURCES (Wash/ICT) - Decoupled Flat Tables
// ─────────────────────────────────────────────────────────────────────────────
router.put('/api/ph_schools/unit6/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const {
      iern,
      unit6_furniture,
      unit6_ict,
      unit6_has_ecart,
      unit6_ecarts,
      unit6_wash,
      unit6_utilities,
      unit6_completed
    } = req.body;

    // Parse structures
    const furnitureData = typeof unit6_furniture === 'string' ? JSON.parse(unit6_furniture) : (unit6_furniture || req.body.unit7_furniture || {});
    const general = furnitureData.general || {};
    const gradesList = furnitureData.grades || [];

    const ict = typeof unit6_ict === 'string' ? JSON.parse(unit6_ict) : (unit6_ict || req.body.unit7_ict || {});
    const ecartsList = typeof unit6_ecarts === 'string' ? JSON.parse(unit6_ecarts) : (unit6_ecarts || req.body.unit7_ecarts || []);
    const wash = typeof unit6_wash === 'string' ? JSON.parse(unit6_wash) : (unit6_wash || req.body.unit7_wash || {});
    const utilities = typeof unit6_utilities === 'string' ? JSON.parse(unit6_utilities) : (unit6_utilities || req.body.unit7_utilities || {});
    const hasEcart = unit6_has_ecart !== undefined ? unit6_has_ecart : req.body.unit7_has_ecart;

    const school_yr = req.body.school_yr || 'SY 26-27';

    await client.query('BEGIN');

    // 1. Upsert into unit6_school_resources
    await client.query(
      `INSERT INTO unit6_school_resources (
         iern, school_id, iern_val, unit6_completed, unit6_updated_at, school_yr,
         has_general_rooms, general_rooms_count,
         armchair_wood_func, armchair_wood_broken,
         armchair_plastic_func, armchair_plastic_broken,
         armchair_plastic_steel_func, armchair_plastic_steel_broken,
         individual_table_chair_func, individual_table_chair_broken,
         two_seater_wood_func, two_seater_wood_broken,
         two_seater_wood_steel_func, two_seater_wood_steel_broken,
         wooden_chair_only_func, wooden_chair_only_broken,
         plastic_chair_only_func, plastic_chair_only_broken,
         has_teacher_desk,
         laptops_total, laptops_func, laptops_teaching, laptops_working,
         tablets_total, tablets_func, tablets_teaching, tablets_working,
         desktops_total, desktops_func, desktops_teaching, desktops_working,
         smart_tvs_total, smart_tvs_func, smart_tvs_cond,
         projectors_total, projectors_func, projectors_cond,
         printers_total, printers_func, printers_cond,
         unit7_has_ecart,
         male_seats_total, male_seats_func, male_seats_cond,
         male_urinals_total, male_urinals_func,
         female_seats_total, female_seats_func, female_seats_cond,
         common_seats_total, common_seats_func, common_seats_cond,
         pwd_seats_total, pwd_seats_func, pwd_seats_cond,
         faucets_total, faucets_func, faucets_cond,
         water_source, confirm_no_piped, confirm_no_piped_text, confirm_zero_wash_text,
         attached_cr_classrooms, attached_cr_seats, attached_cr_included_in_main,
         utility_electricity, confirm_no_grid, confirm_no_grid_text, has_solar_or_gen,
         utility_internet_yesno, utility_internet_type, confirm_no_wired, confirm_no_wired_text, utility_internet_funder,
         laptops_students, tablets_students, desktops_students,
         updated_at
       )
       VALUES (
          $1, $2, $3, $4, CURRENT_TIMESTAMP, $5,
          $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24,
          $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46,
          $47, $48, $49, $50, $51, $52, $53, $54, $55, $56, $57, $58, $59, $60, $61, $62, $63, $64, $65, $66, $67, $68, $69, $70, $71, $72, $73, $74, $75, $76, $77, $78, $79,
          $80, $81, $82,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT (school_id, school_yr) DO UPDATE SET
          iern = EXCLUDED.iern, iern_val = EXCLUDED.iern,
          unit6_completed = EXCLUDED.unit6_completed, unit6_updated_at = CURRENT_TIMESTAMP,
          has_general_rooms = EXCLUDED.has_general_rooms, general_rooms_count = EXCLUDED.general_rooms_count,
          armchair_wood_func = EXCLUDED.armchair_wood_func, armchair_wood_broken = EXCLUDED.armchair_wood_broken,
          armchair_plastic_func = EXCLUDED.armchair_plastic_func, armchair_plastic_broken = EXCLUDED.armchair_plastic_broken,
          armchair_plastic_steel_func = EXCLUDED.armchair_plastic_steel_func, armchair_plastic_steel_broken = EXCLUDED.armchair_plastic_steel_broken,
          individual_table_chair_func = EXCLUDED.individual_table_chair_func, individual_table_chair_broken = EXCLUDED.individual_table_chair_broken,
          two_seater_wood_func = EXCLUDED.two_seater_wood_func, two_seater_wood_broken = EXCLUDED.two_seater_wood_broken,
          two_seater_wood_steel_func = EXCLUDED.two_seater_wood_steel_func, two_seater_wood_steel_broken = EXCLUDED.two_seater_wood_steel_broken,
          wooden_chair_only_func = EXCLUDED.wooden_chair_only_func, wooden_chair_only_broken = EXCLUDED.wooden_chair_only_broken,
          plastic_chair_only_func = EXCLUDED.plastic_chair_only_func, plastic_chair_only_broken = EXCLUDED.plastic_chair_only_broken,
          has_teacher_desk = EXCLUDED.has_teacher_desk,
          laptops_total = EXCLUDED.laptops_total, laptops_func = EXCLUDED.laptops_func, laptops_teaching = EXCLUDED.laptops_teaching, laptops_working = EXCLUDED.laptops_working,
          tablets_total = EXCLUDED.tablets_total, tablets_func = EXCLUDED.tablets_func, tablets_teaching = EXCLUDED.tablets_teaching, tablets_working = EXCLUDED.tablets_working,
          desktops_total = EXCLUDED.desktops_total, desktops_func = EXCLUDED.desktops_func, desktops_teaching = EXCLUDED.desktops_teaching, desktops_working = EXCLUDED.desktops_working,
          laptops_students = EXCLUDED.laptops_students, tablets_students = EXCLUDED.tablets_students, desktops_students = EXCLUDED.desktops_students,
          smart_tvs_total = EXCLUDED.smart_tvs_total, smart_tvs_func = EXCLUDED.smart_tvs_func, smart_tvs_cond = EXCLUDED.smart_tvs_cond,
          projectors_total = EXCLUDED.projectors_total, projectors_func = EXCLUDED.projectors_func, projectors_cond = EXCLUDED.projectors_cond,
          printers_total = EXCLUDED.printers_total, printers_func = EXCLUDED.printers_func, printers_cond = EXCLUDED.printers_cond,
          unit7_has_ecart = EXCLUDED.unit7_has_ecart,
          male_seats_total = EXCLUDED.male_seats_total, male_seats_func = EXCLUDED.male_seats_func, male_seats_cond = EXCLUDED.male_seats_cond,
          male_urinals_total = EXCLUDED.male_urinals_total, male_urinals_func = EXCLUDED.male_urinals_func,
          female_seats_total = EXCLUDED.female_seats_total, female_seats_func = EXCLUDED.female_seats_func, female_seats_cond = EXCLUDED.female_seats_cond,
          common_seats_total = EXCLUDED.common_seats_total, common_seats_func = EXCLUDED.common_seats_func, common_seats_cond = EXCLUDED.common_seats_cond,
          pwd_seats_total = EXCLUDED.pwd_seats_total, pwd_seats_func = EXCLUDED.pwd_seats_func, pwd_seats_cond = EXCLUDED.pwd_seats_cond,
          faucets_total = EXCLUDED.faucets_total, faucets_func = EXCLUDED.faucets_func, faucets_cond = EXCLUDED.faucets_cond,
          water_source = EXCLUDED.water_source, confirm_no_piped = EXCLUDED.confirm_no_piped, confirm_no_piped_text = EXCLUDED.confirm_no_piped_text, confirm_zero_wash_text = EXCLUDED.confirm_zero_wash_text,
          attached_cr_classrooms = EXCLUDED.attached_cr_classrooms, attached_cr_seats = EXCLUDED.attached_cr_seats, attached_cr_included_in_main = EXCLUDED.attached_cr_included_in_main,
          utility_electricity = EXCLUDED.utility_electricity, confirm_no_grid = EXCLUDED.confirm_no_grid, confirm_no_grid_text = EXCLUDED.confirm_no_grid_text, has_solar_or_gen = EXCLUDED.has_solar_or_gen,
          utility_internet_yesno = EXCLUDED.utility_internet_yesno, utility_internet_type = EXCLUDED.utility_internet_type, confirm_no_wired = EXCLUDED.confirm_no_wired, confirm_no_wired_text = EXCLUDED.confirm_no_wired_text, utility_internet_funder = EXCLUDED.utility_internet_funder,
          updated_at = CURRENT_TIMESTAMP`,
      [
        iern, // $1
        id, // $2
        iern, // $3 (for iern_val)
        unit6_completed, // $4
        school_yr, // $5
        general.has_general_rooms, // $6
        parseInt(general.general_rooms_count) || 0, // $7
        parseInt(general.armchair_wood_func) || 0, // $8
        parseInt(general.armchair_wood_broken) || 0, // $9
        parseInt(general.armchair_plastic_func) || 0, // $10
        parseInt(general.armchair_plastic_broken) || 0, // $11
        parseInt(general.armchair_plastic_steel_func) || 0, // $12
        parseInt(general.armchair_plastic_steel_broken) || 0, // $13
        parseInt(general.individual_table_chair_func) || 0, // $14
        parseInt(general.individual_table_chair_broken) || 0, // $15
        parseInt(general.two_seater_wood_func) || 0, // $16
        parseInt(general.two_seater_wood_broken) || 0, // $17
        parseInt(general.two_seater_wood_steel_func) || 0, // $18
        parseInt(general.two_seater_wood_steel_broken) || 0, // $19
        parseInt(general.wooden_chair_only_func) || 0, // $20
        parseInt(general.wooden_chair_only_broken) || 0, // $21
        parseInt(general.plastic_chair_only_func) || 0, // $22
        parseInt(general.plastic_chair_only_broken) || 0, // $23
        general.has_teacher_desk, // $24
        parseInt(ict.laptops_total) || 0, // $25
        parseInt(ict.laptops_func) || 0, // $26
        parseInt(ict.laptops_teaching) || 0, // $27
        parseInt(ict.laptops_working) || 0, // $28
        parseInt(ict.tablets_total) || 0, // $29
        parseInt(ict.tablets_func) || 0, // $30
        parseInt(ict.tablets_teaching) || 0, // $31
        parseInt(ict.tablets_working) || 0, // $32
        parseInt(ict.desktops_total) || 0, // $33
        parseInt(ict.desktops_func) || 0, // $34
        parseInt(ict.desktops_teaching) || 0, // $35
        parseInt(ict.desktops_working) || 0, // $36
        parseInt(ict.smart_tvs_total) || 0, // $37
        parseInt(ict.smart_tvs_func) || 0, // $38
        ict.smart_tvs_cond, // $39
        parseInt(ict.projectors_total) || 0, // $40
        parseInt(ict.projectors_func) || 0, // $41
        ict.projectors_cond, // $42
        parseInt(ict.printers_total) || 0, // $43
        parseInt(ict.printers_func) || 0, // $44
        ict.printers_cond, // $45
        hasEcart, // $46
        parseInt(wash.male_seats_total) || 0, // $47
        parseInt(wash.male_seats_func) || 0, // $48
        wash.male_seats_cond, // $49
        parseInt(wash.male_urinals_total) || 0, // $50
        parseInt(wash.male_urinals_func) || 0, // $51
        parseInt(wash.female_seats_total) || 0, // $52
        parseInt(wash.female_seats_func) || 0, // $53
        wash.female_seats_cond, // $54
        parseInt(wash.common_seats_total) || 0, // $55
        parseInt(wash.common_seats_func) || 0, // $56
        wash.common_seats_cond, // $57
        parseInt(wash.pwd_seats_total) || 0, // $58
        parseInt(wash.pwd_seats_func) || 0, // $59
        wash.pwd_seats_cond, // $60
        parseInt(wash.faucets_total) || 0, // $61
        parseInt(wash.faucets_func) || 0, // $62
        wash.faucets_cond, // $63
        wash.water_source, // $64
        wash.confirm_no_piped, // $65
        wash.confirm_no_piped_text, // $66
        wash.confirm_zero_wash_text, // $67
        parseInt(wash.attached_cr_classrooms) || 0, // $68
        parseInt(wash.attached_cr_seats) || 0, // $69
        wash.attached_cr_included_in_main, // $70
        utilities.utility_electricity, // $71
        utilities.confirm_no_grid, // $72
        utilities.confirm_no_grid_text, // $73
        utilities.has_solar_or_gen, // $74
        utilities.utility_internet_yesno, // $75
        utilities.utility_internet_type, // $76
        utilities.confirm_no_wired, // $77
        utilities.confirm_no_wired_text, // $78
        utilities.utility_internet_funder, // $79
        parseInt(ict.laptops_students) || 0, // $80
        parseInt(ict.tablets_students) || 0, // $81
        parseInt(ict.desktops_students) || 0 // $82
      ]
    );

    // 2. Refresh furniture grades tables
    await client.query('DELETE FROM unit6_furniture_grades WHERE iern = $1 AND school_yr = $2', [iern, school_yr]);
    if (gradesList && gradesList.length > 0) {
      for (const g of gradesList) {
        await client.query(
          `INSERT INTO unit6_furniture_grades (
             iern, grade_level, school_yr,
             armchair_wood_func, armchair_wood_broken,
             armchair_plastic_func, armchair_plastic_broken,
             armchair_plastic_steel_func, armchair_plastic_steel_broken,
             individual_table_chair_func, individual_table_chair_broken,
             two_seater_wood_func, two_seater_wood_broken,
             two_seater_wood_steel_func, two_seater_wood_steel_broken,
             wooden_chair_only_func, wooden_chair_only_broken,
             plastic_chair_only_func, plastic_chair_only_broken,
             is_sharing, shared_with, is_kinder_double_shift
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            iern, g.id, school_yr,
            parseInt(g.armchair_wood_func) || 0, parseInt(g.armchair_wood_broken) || 0,
            parseInt(g.armchair_plastic_func) || 0, parseInt(g.armchair_plastic_broken) || 0,
            parseInt(g.armchair_plastic_steel_func) || 0, parseInt(g.armchair_plastic_steel_broken) || 0,
            parseInt(g.individual_table_chair_func) || 0, parseInt(g.individual_table_chair_broken) || 0,
            parseInt(g.two_seater_wood_func) || 0, parseInt(g.two_seater_wood_broken) || 0,
            parseInt(g.two_seater_wood_steel_func) || 0, parseInt(g.two_seater_wood_steel_broken) || 0,
            parseInt(g.wooden_chair_only_func) || 0, parseInt(g.wooden_chair_only_broken) || 0,
            parseInt(g.plastic_chair_only_func) || 0, parseInt(g.plastic_chair_only_broken) || 0,
            g.is_sharing || false,
            Array.isArray(g.shared_with) ? g.shared_with.join(',') : '',
            g.is_kinder_double_shift || false
          ]
        );
      }
    }

    // 3. Refresh eCarts table
    await client.query('DELETE FROM unit6_ecart_batches WHERE iern = $1 AND school_yr = $2', [iern, school_yr]);
    if (hasEcart && ecartsList && ecartsList.length > 0) {
      for (const cart of ecartsList) {
        await client.query(
          `INSERT INTO unit6_ecart_batches (
             iern, batches_name, year_received, sources_fund, ecart_laptops, ecart_tablets, ecart_tv, charging_condition, remarks, school_yr
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            iern, cart.batches_name, parseInt(cart.year_received) || 0, cart.sources_fund,
            parseInt(cart.ecart_laptops) || 0, parseInt(cart.ecart_tablets) || 0, parseInt(cart.ecart_tv) || 0,
            cart.charging_condition, cart.remarks, school_yr
          ]
        );
      }
    }

    // 4. Update completion timestamp in the main resources table
    await client.query(
      `UPDATE unit6_school_resources SET
       unit6_completed = $1,
       unit6_updated_at = CURRENT_TIMESTAMP
       WHERE school_id = $2 AND school_yr = $3`,
      [unit6_completed, id, school_yr]
    );



    await client.query('COMMIT');
    res.json({ success: true, message: 'Unit 6 resources updated' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

export { router as unit6Router };
export default router;
