const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // -----------------------------------------------------------------------
    // TABLE 1: engineer_imported_beff
    // Master registry — one row per imported BEFF project, immutable after insert.
    // IPC format: INF-B-YYYY-NNNNN
    // -----------------------------------------------------------------------
    console.log('Creating engineer_imported_beff...');
    await client.query(`
      CREATE TABLE engineer_imported_beff (

        -- PRIMARY KEY
        ipc TEXT PRIMARY KEY,  -- format: INF-B-YYYY-NNNNN

        -- ── IDENTITY & LOCATION ────────────────────────────────────────────
        project_name  TEXT NOT NULL,
        school_name   TEXT NOT NULL,
        school_id     TEXT NOT NULL,
        region        TEXT,
        division      TEXT,
        province      TEXT,
        city          TEXT,
        municipality  TEXT,
        leg_district  TEXT,
        latitude      TEXT,
        longitude     TEXT,

        -- ── ENGINEER / OWNERSHIP ───────────────────────────────────────────
        engineer_id                  TEXT,
        engineer_name                TEXT,
        uploader_type                TEXT,
        mode_of_project              TEXT,
        program_type                 TEXT DEFAULT 'BEFF',
        is_donated                   BOOLEAN DEFAULT FALSE,
        approval_status              TEXT DEFAULT 'Pending',
        assigned_engineer_id         TEXT,
        assigned_engineer_name       TEXT,
        date_assigned                TIMESTAMPTZ,
        implementing_agency          TEXT,
        implementing_agency_specific TEXT,
        uploader_id_moa_rta          TEXT,

        -- ── VALIDATION ─────────────────────────────────────────────────────
        validation_status  TEXT,
        validation_remarks TEXT,
        validated_by       TEXT,

        -- ── PROJECT CLASSIFICATION ─────────────────────────────────────────
        project_category    TEXT,
        project_category_id TEXT,
        scope_of_work       TEXT,
        number_of_classrooms INTEGER,
        number_of_sites      INTEGER,
        number_of_storeys    INTEGER,
        no_of_units          INTEGER DEFAULT 0,

        -- ── FUNDING & FINANCE ──────────────────────────────────────────────
        funding_year                 INTEGER,
        funding_year_justification   TEXT,
        approved_budget_for_contract NUMERIC,
        contract_amount              NUMERIC,
        batch_of_funds               TEXT,
        funds_utilized               NUMERIC(20, 2),
        savings                      NUMERIC(20, 2),

        -- ── STATUS & PROGRESS ──────────────────────────────────────────────
        status_of_construction_phase TEXT,
        accomplishment_percentage    INTEGER DEFAULT 0,
        status_as_of                 TIMESTAMPTZ,
        procurement_status           TEXT,
        actions                      TEXT,
        delay_reason                 TEXT,
        other_remarks                TEXT,
        checklist                    JSONB,
        triangulated_percentage      NUMERIC,

        -- ── TIMELINES ──────────────────────────────────────────────────────
        construction_start_date        TIMESTAMPTZ,
        target_completion_date         TIMESTAMPTZ,
        revised_target_completion_date TIMESTAMPTZ,
        actual_completion_date         TIMESTAMPTZ,
        notice_to_proceed              TIMESTAMPTZ,
        time_lapsed_days               INTEGER,
        time_lapsed_percentage         NUMERIC,

        -- ── PROCUREMENT MILESTONES ─────────────────────────────────────────
        issuance_of_invitation_to_bid  TIMESTAMPTZ,
        pre_bid_conference             TIMESTAMPTZ,
        opening_of_technical_proposal  TIMESTAMPTZ,
        opening_of_financial_proposal  TIMESTAMPTZ,
        request_for_quotation          TIMESTAMPTZ,
        negotiation                    TIMESTAMPTZ,
        opening_of_quotation           TIMESTAMPTZ,
        date_notice_of_award           TIMESTAMPTZ,
        bid_opening                    TIMESTAMPTZ,
        issuance_of_resolution_to_award TIMESTAMPTZ,
        contract_id                    TEXT,
        contractor_name                TEXT,

        -- ── MOA / LGU ──────────────────────────────────────────────────────
        mother_moa_id            TEXT,
        supplemental_moa_id      TEXT,
        sangguniang_resolution_id TEXT,

        -- ── DOCUMENTS ──────────────────────────────────────────────────────
        pow_pdf           TEXT,
        dupa_pdf          TEXT,
        contract_pdf      TEXT,
        pow_filename      TEXT,
        dupa_filename     TEXT,
        contract_filename TEXT,

        -- ── MEDIA ──────────────────────────────────────────────────────────
        internal_description TEXT,
        external_description TEXT,

        -- ── IMPORT AUDIT ───────────────────────────────────────────────────
        imported_by TEXT,
        imported_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✅ engineer_imported_beff created');

    // -----------------------------------------------------------------------
    // TABLE 2: engineer_imported_beff_updates
    // Append-only update ledger — full snapshot per save/update.
    // FK back to engineer_imported_beff(ipc).
    // -----------------------------------------------------------------------
    console.log('Creating engineer_imported_beff_updates...');
    await client.query(`
      CREATE TABLE engineer_imported_beff_updates (

        -- PRIMARY KEY
        update_id SERIAL PRIMARY KEY,

        -- FOREIGN KEY to master registry
        ipc TEXT NOT NULL REFERENCES engineer_imported_beff(ipc),

        -- ── IDENTITY & LOCATION ────────────────────────────────────────────
        project_name  TEXT,
        school_name   TEXT,
        school_id     TEXT,
        region        TEXT,
        division      TEXT,
        province      TEXT,
        city          TEXT,
        municipality  TEXT,
        leg_district  TEXT,
        latitude      TEXT,
        longitude     TEXT,

        -- ── ENGINEER / OWNERSHIP ───────────────────────────────────────────
        engineer_id                  TEXT,
        engineer_name                TEXT,
        uploader_type                TEXT,
        mode_of_project              TEXT,
        program_type                 TEXT,
        is_donated                   BOOLEAN DEFAULT FALSE,
        approval_status              TEXT,
        assigned_engineer_id         TEXT,
        assigned_engineer_name       TEXT,
        date_assigned                TIMESTAMPTZ,
        implementing_agency          TEXT,
        implementing_agency_specific TEXT,
        uploader_id_moa_rta          TEXT,

        -- ── VALIDATION ─────────────────────────────────────────────────────
        validation_status  TEXT,
        validation_remarks TEXT,
        validated_by       TEXT,

        -- ── PROJECT CLASSIFICATION ─────────────────────────────────────────
        project_category    TEXT,
        project_category_id TEXT,
        scope_of_work       TEXT,
        number_of_classrooms INTEGER,
        number_of_sites      INTEGER,
        number_of_storeys    INTEGER,
        no_of_units          INTEGER DEFAULT 0,

        -- ── FUNDING & FINANCE ──────────────────────────────────────────────
        funding_year                 INTEGER,
        funding_year_justification   TEXT,
        approved_budget_for_contract NUMERIC,
        contract_amount              NUMERIC,
        batch_of_funds               TEXT,
        funds_utilized               NUMERIC(20, 2),
        savings                      NUMERIC(20, 2),

        -- ── STATUS & PROGRESS ──────────────────────────────────────────────
        status_of_construction_phase TEXT,
        accomplishment_percentage    INTEGER DEFAULT 0,
        status_as_of                 TIMESTAMPTZ,
        procurement_status           TEXT,
        actions                      TEXT,
        delay_reason                 TEXT,
        other_remarks                TEXT,
        checklist                    JSONB,
        triangulated_percentage      NUMERIC,

        -- ── TIMELINES ──────────────────────────────────────────────────────
        construction_start_date        TIMESTAMPTZ,
        target_completion_date         TIMESTAMPTZ,
        revised_target_completion_date TIMESTAMPTZ,
        actual_completion_date         TIMESTAMPTZ,
        notice_to_proceed              TIMESTAMPTZ,
        time_lapsed_days               INTEGER,
        time_lapsed_percentage         NUMERIC,

        -- ── PROCUREMENT MILESTONES ─────────────────────────────────────────
        issuance_of_invitation_to_bid  TIMESTAMPTZ,
        pre_bid_conference             TIMESTAMPTZ,
        opening_of_technical_proposal  TIMESTAMPTZ,
        opening_of_financial_proposal  TIMESTAMPTZ,
        request_for_quotation          TIMESTAMPTZ,
        negotiation                    TIMESTAMPTZ,
        opening_of_quotation           TIMESTAMPTZ,
        date_notice_of_award           TIMESTAMPTZ,
        bid_opening                    TIMESTAMPTZ,
        issuance_of_resolution_to_award TIMESTAMPTZ,
        contract_id                    TEXT,
        contractor_name                TEXT,

        -- ── MOA / LGU ──────────────────────────────────────────────────────
        mother_moa_id            TEXT,
        supplemental_moa_id      TEXT,
        sangguniang_resolution_id TEXT,

        -- ── DOCUMENTS ──────────────────────────────────────────────────────
        pow_pdf           TEXT,
        dupa_pdf          TEXT,
        contract_pdf      TEXT,
        pow_filename      TEXT,
        dupa_filename     TEXT,
        contract_filename TEXT,

        -- ── MEDIA ──────────────────────────────────────────────────────────
        internal_description TEXT,
        external_description TEXT,

        -- ── UPDATE AUDIT ───────────────────────────────────────────────────
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✅ engineer_imported_beff_updates created');

    // -----------------------------------------------------------------------
    // INDICES
    // -----------------------------------------------------------------------
    console.log('Creating indices...');
    // Ledger: fast lookup of all updates per IPC
    await client.query(`CREATE INDEX idx_eib_upd_ipc ON engineer_imported_beff_updates(ipc);`);
    // Ledger: fast "latest update per IPC" (used by the view)
    await client.query(`CREATE INDEX idx_eib_upd_ipc_update_id ON engineer_imported_beff_updates(ipc, update_id DESC);`);
    // Registry: common filter patterns
    await client.query(`CREATE INDEX idx_eib_engineer_id ON engineer_imported_beff(engineer_id);`);
    await client.query(`CREATE INDEX idx_eib_funding_year ON engineer_imported_beff(funding_year);`);
    await client.query(`CREATE INDEX idx_eib_division ON engineer_imported_beff(division);`);
    await client.query(`CREATE INDEX idx_eib_school_id ON engineer_imported_beff(school_id);`);
    console.log('  ✅ Indices created');

    // -----------------------------------------------------------------------
    // VIEW: v_latest_beff_project_state
    // Returns the most recent update snapshot per IPC, enriched with
    // import metadata from the registry. Use this for all "current state" reads.
    // -----------------------------------------------------------------------
    console.log('Creating view v_latest_beff_project_state...');
    await client.query(`
      CREATE VIEW v_latest_beff_project_state AS
      SELECT DISTINCT ON (u.ipc)
        u.*,
        b.imported_at AS project_imported_at,
        b.imported_by AS project_imported_by
      FROM engineer_imported_beff_updates u
      JOIN engineer_imported_beff b ON b.ipc = u.ipc
      ORDER BY u.ipc, u.update_id DESC;
    `);
    console.log('  ✅ View v_latest_beff_project_state created');

    await client.query('COMMIT');
    console.log('\n✅ BEFF migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
