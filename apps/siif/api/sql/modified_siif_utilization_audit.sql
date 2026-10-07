-- ─── modified_siif_utilization_audit ──────────────────────────────────────────
-- Database: siif_database_v2
-- Append-only history of every change to modified_siif_utilization.
-- One row per Save / Remove, written by POST /api/siif/modified-utilization in the
-- same transaction as the save (so the log can never disagree with the data).
--
-- The app only ever INSERTs and SELECTs here. Rows are not locked at the database
-- level; corrections or clean-up are left to developers / DB administrators.
--
-- Safe to re-run. Run this BEFORE deploying the API change, otherwise saves will
-- fail because the audit insert has no table to write to.

CREATE TABLE IF NOT EXISTS modified_siif_utilization_audit (
    audit_id              BIGSERIAL     PRIMARY KEY,
    school_id             TEXT          NOT NULL,
    fiscal_year           INTEGER       NOT NULL,
    action                VARCHAR(20)   NOT NULL CHECK (action IN ('save', 'remove')),
    added_ids             TEXT[]        NOT NULL DEFAULT '{}',
    removed_ids           TEXT[]        NOT NULL DEFAULT '{}',
    before_interventions  JSONB,                      -- NULL on the school's first save
    after_interventions   JSONB         NOT NULL,
    before_spent          NUMERIC(14,2),
    after_spent           NUMERIC(14,2) NOT NULL,
    changed_by_user_id    TEXT,
    changed_by_email      TEXT,
    changed_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE modified_siif_utilization_audit IS
    'Append-only change history for modified_siif_utilization, written by the SIIF API on every save/remove.';

CREATE INDEX IF NOT EXISTS idx_msu_audit_school_fy_time
    ON modified_siif_utilization_audit (school_id, fiscal_year, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_msu_audit_changed_at
    ON modified_siif_utilization_audit (changed_at);
