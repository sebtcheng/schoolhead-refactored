// ─── Modified SIIF Utilization Route ──────────────────────────────────────────
// GET  /api/siif/modified-utilization/:schoolId
// GET  /api/siif/modified-utilization/:schoolId/history
// POST /api/siif/modified-utilization

import { Router } from 'express';
import { poolSiif as pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';
import { resolveSchoolId } from '../helpers/resolveSchoolId.js';

const router = Router();

const AUDIT_ACTIONS = ['save', 'remove'];

// Sum of a quarters map; a quarter is { amount } or a bare amount (legacy rows)
const spentOf = (quarters) =>
    Object.values(quarters || {}).reduce(
        (sum, q) => sum + (parseFloat(q?.amount !== undefined ? q.amount : q) || 0),
        0
    );

// Intervention ids from a stored selected_interventions array (objects or plain ids)
const idsOf = (items) =>
    (Array.isArray(items) ? items : [])
        .map(item => (typeof item === 'object' && item !== null ? item.id : item))
        .filter(Boolean);

// ─── GET /api/siif/modified-utilization/:schoolId ──────────────────────────────
router.get('/modified-utilization/:schoolId', authenticate, async (req, res) => {
    try {
        const { schoolId } = req.params;
        const fiscalYear = parseInt(req.query.fiscalYear, 10) || new Date().getFullYear();
        const finalSchoolId = await resolveSchoolId(schoolId, req.user);

        console.log(`\n🔎 [SIIF-API] GET Modified Utilization for School: ${finalSchoolId} | FY: ${fiscalYear}`);

        const client = await pool.connect();
        try {
            // 1. Fetch official allocation
            const allocRes = await client.query(
                `SELECT siif_allocation_id, school_id, school_name, region, division, district, 
                        allocation_amount, spent_amount, remarks, fiscal_year
                 FROM siif_allocations 
                 WHERE school_id = $1 AND fiscal_year = $2
                 LIMIT 1`,
                [finalSchoolId, fiscalYear]
            );

            const allocation = allocRes.rows[0] || {
                school_id: finalSchoolId,
                fiscal_year: fiscalYear,
                allocation_amount: 0,
                spent_amount: 0,
                remarks: ''
            };

            // 2. Fetch modified utilization record
            const utilRes = await client.query(
                `SELECT modi_siif_util_id, school_id, siif_allocation_id, fiscal_year, 
                        allocation_amount, selected_interventions, updated_at
                 FROM modified_siif_utilization
                 WHERE school_id = $1 AND fiscal_year = $2
                 LIMIT 1`,
                [finalSchoolId, fiscalYear]
            );

            const utilRow = utilRes.rows[0] || null;
            let rawSelected = utilRow?.selected_interventions || [];

            // Normalize: If rawSelected has objects, ensure utilizationData map matches
            let normalizedSelected = [];
            let normalizedUtilData = {};
            let selectedIds = [];

            if (Array.isArray(rawSelected)) {
                normalizedSelected = rawSelected;
                rawSelected.forEach(item => {
                    if (typeof item === 'object' && item !== null && item.id) {
                        selectedIds.push(item.id);
                        if (item.quarters) {
                            normalizedUtilData[item.id] = item.quarters;
                        }
                    } else if (typeof item === 'string') {
                        selectedIds.push(item);
                    }
                });
            }

            return res.json({
                success: true,
                schoolId: finalSchoolId,
                fiscalYear,
                allocation,
                selectedInterventions: normalizedSelected,
                selectedInterventionIds: selectedIds,
                utilizationData: normalizedUtilData,
                updatedAt: utilRow?.updated_at || null
            });
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('🔥 [SIIF-API] Error fetching modified utilization:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// ─── GET /api/siif/modified-utilization/:schoolId/history ──────────────────────
// Audit trail, newest first. Query: fiscalYear (default current), limit (≤200), offset.
router.get('/modified-utilization/:schoolId/history', authenticate, async (req, res) => {
    try {
        const finalSchoolId = await resolveSchoolId(req.params.schoolId, req.user);
        const fiscalYear = parseInt(req.query.fiscalYear, 10) || new Date().getFullYear();
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
        const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

        console.log(`\n📜 [SIIF-API] GET Utilization History for School: ${finalSchoolId} | FY: ${fiscalYear}`);

        const { rows } = await pool.query(
            `SELECT audit_id, action, added_ids, removed_ids,
                    before_interventions, after_interventions,
                    before_spent, after_spent,
                    changed_by_user_id, changed_by_email, changed_at,
                    COUNT(*) OVER() AS total_count
             FROM modified_siif_utilization_audit
             WHERE school_id = $1 AND fiscal_year = $2
             ORDER BY changed_at DESC, audit_id DESC
             LIMIT $3 OFFSET $4`,
            [finalSchoolId, fiscalYear, limit, offset]
        );

        return res.json({
            success: true,
            schoolId: finalSchoolId,
            fiscalYear,
            total: rows.length ? parseInt(rows[0].total_count, 10) : 0,
            limit,
            offset,
            // eslint-disable-next-line no-unused-vars
            history: rows.map(({ total_count, ...row }) => ({
                ...row,
                before_spent: row.before_spent === null ? null : parseFloat(row.before_spent),
                after_spent: parseFloat(row.after_spent),
            })),
        });
    } catch (err) {
        console.error('🔥 [SIIF-API] Error fetching utilization history:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// ─── POST /api/siif/modified-utilization ──────────────────────────────────────
router.post('/modified-utilization', authenticate, async (req, res) => {
    const { schoolId, selectedInterventions, utilizationData, fiscalYear: reqFy, action: reqAction } = req.body;
    const fiscalYear = parseInt(reqFy, 10) || new Date().getFullYear();
    const action = AUDIT_ACTIONS.includes(reqAction) ? reqAction : 'save';

    console.log(`\n💾 [SIIF-API] SAVE Modified Utilization Request for School: ${schoolId} | FY: ${fiscalYear}`);

    if (!schoolId) {
        return res.status(400).json({ error: 'Missing required field: schoolId' });
    }

    const finalSchoolId = await resolveSchoolId(schoolId, req.user);
    const inputSelected = Array.isArray(selectedInterventions) ? selectedInterventions : [];
    const inputUtilData = utilizationData && typeof utilizationData === 'object' ? utilizationData : {};

    // Standardize to unified array of objects for selected_interventions
    let unifiedSelected = [];
    let unifiedUtilData = { ...inputUtilData };
    let spentAmount = 0;

    inputSelected.forEach(item => {
        if (typeof item === 'object' && item !== null && item.id) {
            // Already an object with quarters
            const quarters = item.quarters || inputUtilData[item.id] || {};
            let intSpent = 0;
            Object.values(quarters).forEach(q => {
                const amt = parseFloat(q?.amount !== undefined ? q.amount : q) || 0;
                intSpent += amt;
            });

            spentAmount += intSpent;
            unifiedUtilData[item.id] = quarters;

            unifiedSelected.push({
                id: item.id,
                title: item.title || item.label || item.id,
                quarters,
                total_spent: intSpent
            });
        } else if (typeof item === 'string') {
            // String key, pull quarters from inputUtilData
            const quarters = inputUtilData[item] || {
                'July-September': { amount: '', status: 'Not Yet Started', justification: '' },
                'October-December': { amount: '', status: 'Not Yet Started', justification: '' },
                'January-March': { amount: '', status: 'Not Yet Started', justification: '' }
            };

            let intSpent = 0;
            Object.values(quarters).forEach(q => {
                const amt = parseFloat(q?.amount !== undefined ? q.amount : q) || 0;
                intSpent += amt;
            });

            spentAmount += intSpent;
            unifiedUtilData[item] = quarters;

            unifiedSelected.push({
                id: item,
                title: item,
                quarters,
                total_spent: intSpent
            });
        }
    });

    console.log(`📊 [SIIF-API] Calculated spent_amount: ₱${spentAmount} across ${unifiedSelected.length} active interventions`);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check allocation record
        const allocRes = await client.query(
            `SELECT siif_allocation_id, allocation_amount FROM siif_allocations 
             WHERE school_id = $1 AND fiscal_year = $2 LIMIT 1`,
            [finalSchoolId, fiscalYear]
        );

        const allocationId = allocRes.rows[0]?.siif_allocation_id || null;
        const allocAmount = parseFloat(allocRes.rows[0]?.allocation_amount) || 0.0;

        // 1b. Lock and read the current record so the audit "before" can't race another save
        const beforeRes = await client.query(
            `SELECT selected_interventions FROM modified_siif_utilization
             WHERE school_id = $1 AND fiscal_year = $2
             FOR UPDATE`,
            [finalSchoolId, fiscalYear]
        );
        const beforeSelected = beforeRes.rows[0]?.selected_interventions ?? null;

        // 2. Upsert into modified_siif_utilization with unified selected_interventions
        const upsertRes = await client.query(
            `INSERT INTO modified_siif_utilization 
                (school_id, siif_allocation_id, fiscal_year, allocation_amount, selected_interventions, updated_at)
             VALUES 
                ($1, $2, $3, $4, $5::jsonb, NOW())
             ON CONFLICT (school_id, fiscal_year)
             DO UPDATE SET 
                siif_allocation_id = COALESCE(EXCLUDED.siif_allocation_id, modified_siif_utilization.siif_allocation_id),
                allocation_amount = COALESCE(EXCLUDED.allocation_amount, modified_siif_utilization.allocation_amount),
                selected_interventions = EXCLUDED.selected_interventions,
                updated_at = NOW()
             RETURNING modi_siif_util_id, school_id, fiscal_year, updated_at`,
            [finalSchoolId, allocationId, fiscalYear, allocAmount, JSON.stringify(unifiedSelected)]
        );

        // 3. Synchronize spent_amount in siif_allocations table
        if (allocationId) {
            await client.query(
                `UPDATE siif_allocations
                 SET spent_amount = $1, updated_at = NOW()
                 WHERE school_id = $2 AND fiscal_year = $3`,
                [spentAmount, finalSchoolId, fiscalYear]
            );
            console.log(`✅ [SIIF-API] Synced siif_allocations.spent_amount to ₱${spentAmount}`);
        } else {
            console.warn(`⚠️ [SIIF-API] No siif_allocation record found for school ${finalSchoolId} to sync spent_amount.`);
        }

        // 4. Append to the audit trail (same transaction — no save without its log row)
        const beforeIds = idsOf(beforeSelected);
        const afterIds = unifiedSelected.map(item => item.id);
        const beforeSpent = beforeSelected === null
            ? null
            : (Array.isArray(beforeSelected) ? beforeSelected : [])
                .reduce((sum, item) => sum + spentOf(item?.quarters), 0);

        await client.query(
            `INSERT INTO modified_siif_utilization_audit
                (school_id, fiscal_year, action, added_ids, removed_ids,
                 before_interventions, after_interventions, before_spent, after_spent,
                 changed_by_user_id, changed_by_email)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11)`,
            [
                finalSchoolId,
                fiscalYear,
                action,
                afterIds.filter(id => !beforeIds.includes(id)),
                beforeIds.filter(id => !afterIds.includes(id)),
                beforeSelected === null ? null : JSON.stringify(beforeSelected),
                JSON.stringify(unifiedSelected),
                beforeSpent,
                spentAmount,
                String(req.user?.uid || req.user?.id || req.user?.sub || '') || null,
                req.user?.email || null,
            ]
        );

        await client.query('COMMIT');
        console.log(`✅ [SIIF-API] Modified utilization successfully saved for school ${finalSchoolId}`);

        return res.json({
            success: true,
            spentAmount,
            selectedInterventions: unifiedSelected,
            record: upsertRes.rows[0]
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('🔥 [SIIF-API] Save Modified Utilization Error:', err);
        return res.status(500).json({ error: 'Internal Server Error', details: err.message });
    } finally {
        client.release();
    }
});

export default router;
