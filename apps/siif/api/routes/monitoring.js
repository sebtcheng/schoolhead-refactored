// ─── Monitoring Routes (RO/SDO) ───────────────────────────────────────────────
// GET /api/siif/metrics
// GET /api/siif/ro-monitoring
// GET /api/siif/sdo-monitoring

import { Router } from 'express';
import { poolSiif as pool } from '@shared/db';
import { authenticate } from '../middleware/authenticate.js';
import { mapRegionName } from '../helpers/mapRegionName.js';

const router = Router();

// GET /api/siif/metrics — Summary metrics for RO/SDO dashboard
router.get('/metrics', authenticate, async (req, res) => {
    try {
        const { role, region, division } = req.user;
        const dbRegion = mapRegionName(region);

        console.log(`📊 [SIIF-API] Metrics Request | Role: ${role} | Region: ${dbRegion} | Division: ${division}`);

        let whereClause = '';
        let params = [];

        if (role === 'Regional Division Office' || role === 'Regional Office') {
            whereClause = 'WHERE a.region = $1';
            params = [dbRegion];
        } else if (role === 'Division Office' || role === 'SDO') {
            whereClause = 'WHERE a.division = $1';
            params = [division];
        }

        const statsQuery = `
            SELECT 
                (SELECT COUNT(DISTINCT s.school_id) 
                 FROM siif_submissions s 
                 JOIN siif_allocations a ON s.school_id = a.school_id 
                 ${whereClause ? whereClause.replace('a.', 'a.') : ''} 
                 AND s.submitted_at IS NOT NULL) as recipient_schools,
                
                (SELECT SUM(allocation_amount) FROM siif_allocations a ${whereClause}) as total_allocation,
                
                (SELECT SUM(u.utilized_amount) 
                 FROM siif_utilization u
                 JOIN siif_interventions i ON u.siif_int_id = i.siif_int_id
                 JOIN siif_submissions s ON i.siif_sub_id = s.siif_sub_id
                 JOIN siif_allocations a ON s.school_id = a.school_id
                 ${whereClause}) as total_utilized,
                
                (SELECT COUNT(DISTINCT a.division) FROM siif_allocations a ${whereClause}) as total_sdos
        `;

        const result = await pool.query(statsQuery, params);
        const row = result.rows[0];

        const totalAllocation = parseFloat(row.total_allocation) || 0;
        const totalUtilized = parseFloat(row.total_utilized) || 0;
        const utilizationRate = totalAllocation > 0
            ? ((totalUtilized / totalAllocation) * 100).toFixed(1) + '%'
            : '0%';

        res.json({
            success: true,
            data: {
                recipientSchools: parseInt(row.recipient_schools) || 0,
                totalAllocation,
                totalUtilized,
                utilizationRate,
                totalSDOs: parseInt(row.total_sdos) || 0,
            },
        });
    } catch (err) {
        console.error('[SIIF-API] Error fetching metrics:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/siif/ro-monitoring — Division-level summary for RO
router.get('/ro-monitoring', authenticate, async (req, res) => {
    try {
        const { role, region } = req.user;
        const dbRegion = mapRegionName(region);

        let whereClause = '';
        let params = [];

        if (role === 'Regional Division Office' || role === 'Regional Office') {
            whereClause = 'WHERE a.region = $1';
            params = [dbRegion];
        }

        const query = `
            SELECT 
                a.division,
                COUNT(DISTINCT a.school_id) as school_count,
                SUM(a.allocation_amount) as allocation,
                COALESCE(SUM(u.utilized_amount), 0) as utilized
            FROM siif_allocations a
            LEFT JOIN siif_submissions s ON a.school_id = s.school_id
            LEFT JOIN siif_interventions i ON s.siif_sub_id = i.siif_sub_id
            LEFT JOIN siif_utilization u ON i.siif_int_id = u.siif_int_id
            ${whereClause}
            GROUP BY a.division
            ORDER BY a.division ASC
        `;
        const result = await pool.query(query, params);
        const data = result.rows.map(row => ({
            division: row.division,
            schoolCount: parseInt(row.school_count),
            allocation: parseFloat(row.allocation),
            utilized: parseFloat(row.utilized),
            rate: parseFloat(row.allocation) > 0
                ? ((parseFloat(row.utilized) / parseFloat(row.allocation)) * 100).toFixed(1) + '%'
                : '0%',
        }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('[SIIF-API] Error fetching RO monitoring:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/siif/sdo-monitoring — School-level detail for RO/SDO
router.get('/sdo-monitoring', authenticate, async (req, res) => {
    try {
        const { role, region, division } = req.user;
        const dbRegion = mapRegionName(region);

        let whereClause = '';
        let params = [];

        if (role === 'Regional Division Office' || role === 'Regional Office') {
            whereClause = 'WHERE a.region = $1';
            params = [dbRegion];
        } else if (role === 'Division Office' || role === 'SDO') {
            whereClause = 'WHERE a.division = $1';
            params = [division];
        }

        const query = `
            SELECT 
                a.school_id as id,
                a.school_name as name,
                a.division,
                a.allocation_amount as budget,
                s.status,
                COALESCE(SUM(u.utilized_amount), 0) as total_utilization,
                COALESCE(SUM(CASE WHEN u.quarter = 'July-September' THEN u.utilized_amount ELSE 0 END), 0) as phase1,
                COALESCE(SUM(CASE WHEN u.quarter = 'October-December' THEN u.utilized_amount ELSE 0 END), 0) as phase2,
                COALESCE(SUM(CASE WHEN u.quarter = 'January-March' THEN u.utilized_amount ELSE 0 END), 0) as phase3,
                COALESCE(SUM(CASE WHEN u.quarter = 'April-June' THEN u.utilized_amount ELSE 0 END), 0) as phase4
            FROM siif_allocations a
            LEFT JOIN siif_submissions s ON a.school_id = s.school_id
            LEFT JOIN siif_interventions i ON s.siif_sub_id = i.siif_sub_id
            LEFT JOIN siif_utilization u ON i.siif_int_id = u.siif_int_id
            ${whereClause}
            GROUP BY a.school_id, a.school_name, a.division, a.allocation_amount, s.status
            ORDER BY a.school_name ASC
        `;
        const result = await pool.query(query, params);
        const data = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            division: row.division,
            budget: parseFloat(row.budget),
            status: row.status || 'Not Started',
            utilization: {
                total: parseFloat(row.total_utilization),
                phase1: parseFloat(row.phase1),
                phase2: parseFloat(row.phase2),
                phase3: parseFloat(row.phase3),
                phase4: parseFloat(row.phase4),
            },
        }));
        res.json({ success: true, data });
    } catch (err) {
        console.error('[SIIF-API] Error fetching SDO monitoring:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
