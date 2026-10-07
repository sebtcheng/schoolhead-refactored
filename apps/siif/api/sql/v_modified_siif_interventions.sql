-- ─── v_modified_siif_interventions ────────────────────────────────────────────
-- Database: siif_database_v2
-- One row per school × fiscal year × selected intervention, with the three
-- quarters (July-September, October-December, January-March) as columns.
--
-- Source: modified_siif_utilization.selected_interventions (JSONB array), joined
-- to siif_allocations for school details. Standard (non-materialized) view, so it
-- always reflects the latest save — no refresh needed.
--
-- Safe to re-run: CREATE OR REPLACE only replaces the view definition. It does not
-- touch any table data.
--
-- Note: CREATE OR REPLACE VIEW cannot rename or drop existing columns. If a later
-- change does that, drop the view first (DROP VIEW v_modified_siif_interventions;).

CREATE OR REPLACE VIEW v_modified_siif_interventions AS
SELECT
    u.modi_siif_util_id,
    u.school_id,
    a.school_name,
    a.region,
    a.division,
    a.district,
    u.fiscal_year,
    COALESCE(a.allocation_amount, u.allocation_amount)   AS allocation_amount,

    e.ord::int                                           AS intervention_order,
    i.intervention_id,
    i.intervention_title,

    q1.amount          AS q1_jul_sep_amount,
    q1.status          AS q1_jul_sep_status,
    q1.justification   AS q1_jul_sep_justification,

    q2.amount          AS q2_oct_dec_amount,
    q2.status          AS q2_oct_dec_status,
    q2.justification   AS q2_oct_dec_justification,

    q3.amount          AS q3_jan_mar_amount,
    q3.status          AS q3_jan_mar_status,
    q3.justification   AS q3_jan_mar_justification,

    (q1.amount + q2.amount + q3.amount)                  AS total_spent,
    u.updated_at
FROM modified_siif_utilization u

-- Split the JSON array into one row per intervention (keeps the order they were picked in)
CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(u.selected_interventions) = 'array'
         THEN u.selected_interventions
         ELSE '[]'::jsonb
    END
) WITH ORDINALITY AS e(item, ord)

-- Items are normally objects ({id, title, quarters, total_spent}); older rows may be plain id strings
CROSS JOIN LATERAL (
    SELECT
        CASE WHEN jsonb_typeof(e.item) = 'object' THEN e.item->>'id'    ELSE e.item #>> '{}' END AS intervention_id,
        CASE WHEN jsonb_typeof(e.item) = 'object'
             THEN COALESCE(e.item->>'title', e.item->>'id')
             ELSE e.item #>> '{}'
        END                                                                                      AS intervention_title,
        CASE WHEN jsonb_typeof(e.item) = 'object' THEN e.item->'quarters' END                    AS quarters
) i

-- One block per quarter. A quarter is normally {amount, status, justification};
-- a bare number/string is treated as the amount (mirrors amountOf() in the web app).
-- Blank or non-numeric amounts count as 0.
CROSS JOIN LATERAL (
    SELECT
        CASE WHEN amt ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN amt::numeric ELSE 0 END AS amount,
        COALESCE(NULLIF(q->>'status', ''), 'Not Yet Started')                    AS status,
        NULLIF(q->>'justification', '')                                          AS justification
    FROM (SELECT i.quarters->'July-September' AS q) s
    CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(q) = 'object' THEN q->>'amount' ELSE q #>> '{}' END AS amt) x
) q1
CROSS JOIN LATERAL (
    SELECT
        CASE WHEN amt ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN amt::numeric ELSE 0 END AS amount,
        COALESCE(NULLIF(q->>'status', ''), 'Not Yet Started')                    AS status,
        NULLIF(q->>'justification', '')                                          AS justification
    FROM (SELECT i.quarters->'October-December' AS q) s
    CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(q) = 'object' THEN q->>'amount' ELSE q #>> '{}' END AS amt) x
) q2
CROSS JOIN LATERAL (
    SELECT
        CASE WHEN amt ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' THEN amt::numeric ELSE 0 END AS amount,
        COALESCE(NULLIF(q->>'status', ''), 'Not Yet Started')                    AS status,
        NULLIF(q->>'justification', '')                                          AS justification
    FROM (SELECT i.quarters->'January-March' AS q) s
    CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(q) = 'object' THEN q->>'amount' ELSE q #>> '{}' END AS amt) x
) q3

-- School details; LIMIT 1 matches how the API reads the allocation
LEFT JOIN LATERAL (
    SELECT sa.school_name, sa.region, sa.division, sa.district, sa.allocation_amount
    FROM siif_allocations sa
    WHERE sa.school_id = u.school_id
      AND sa.fiscal_year = u.fiscal_year
    LIMIT 1
) a ON true;

COMMENT ON VIEW v_modified_siif_interventions IS
    'One row per school, fiscal year and selected SIIF intervention, with Q1-Q3 amount/status/justification columns. Built from modified_siif_utilization.selected_interventions.';

-- ─── Example queries ──────────────────────────────────────────────────────────
-- All interventions of one school:
--   SELECT * FROM v_modified_siif_interventions WHERE school_id = '301234' ORDER BY intervention_order;
--
-- Total spent per intervention across a division:
--   SELECT intervention_title, COUNT(*) AS schools, SUM(total_spent) AS spent
--   FROM v_modified_siif_interventions
--   WHERE division = 'Batangas' AND fiscal_year = 2026
--   GROUP BY intervention_title ORDER BY spent DESC;
