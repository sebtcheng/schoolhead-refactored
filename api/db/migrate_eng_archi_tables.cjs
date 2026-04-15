const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('Creating eng_archi_created_projects...');
    await client.query(`
      CREATE TABLE eng_archi_created_projects (
        ipc TEXT PRIMARY KEY,

        project_name TEXT NOT NULL,
        school_name  TEXT NOT NULL,
        school_id    TEXT NOT NULL,
        region       TEXT,
        division     TEXT,
        province     TEXT,
        city         TEXT,
        municipality TEXT,
        latitude     TEXT,
        longitude    TEXT,

        engineer_id                  TEXT,
        engineer_name                TEXT,
        uploader_type                TEXT,
        mode_of_project              TEXT,
        implementing_agency          TEXT,
        implementing_agency_specific TEXT,
        is_donated                   BOOLEAN DEFAULT FALSE,
        program_type                 TEXT,
        approval_status              TEXT DEFAULT 'Pending',

        project_category    TEXT,
        project_category_id TEXT,
        scope_of_work       TEXT,
        number_of_classrooms INTEGER,
        number_of_sites      INTEGER,
        number_of_storeys    INTEGER,
        no_of_units          INTEGER DEFAULT 0,

        funding_year                 INTEGER,
        funding_year_justification   TEXT,
        approved_budget_for_contract NUMERIC,
        contract_amount              NUMERIC,
        batch_of_funds               TEXT,
        funds_utilized               NUMERIC(20, 2),
        savings                      NUMERIC(20, 2),

        status_of_construction_phase TEXT,
        accomplishment_percentage    INTEGER DEFAULT 0,
        status_as_of                 TIMESTAMPTZ,
        status_design_phase          TEXT,
        actions                      TEXT,
        delay_reason                 TEXT,
        other_remarks                TEXT,

        construction_start_date          TIMESTAMPTZ,
        target_completion_date           TIMESTAMPTZ,
        revised_target_completion_date   TIMESTAMPTZ,
        actual_completion_date           TIMESTAMPTZ,
        notice_to_proceed                TIMESTAMPTZ,
        time_lapsed_days                 INTEGER,
        time_lapsed_percentage           TEXT,

        issuance_of_invitation_to_bid  TIMESTAMPTZ,
        pre_bid_conference             TIMESTAMPTZ,
        opening_of_technical_proposal  TIMESTAMPTZ,
        opening_of_financial_proposal  TIMESTAMPTZ,
        request_for_quotation          TIMESTAMPTZ,
        negotiation                    TIMESTAMPTZ,
        opening_of_quotation           TIMESTAMPTZ,
        date_notice_of_award           TIMESTAMPTZ,
        contract_id                    TEXT,
        contractor_name                TEXT,

        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✅ eng_archi_created_projects created');

    console.log('Creating eng_archi_createdupdated_projects...');
    await client.query(`
      CREATE TABLE eng_archi_createdupdated_projects (
        update_id SERIAL PRIMARY KEY,
        ipc       TEXT NOT NULL REFERENCES eng_archi_created_projects(ipc),

        project_name TEXT,
        school_name  TEXT,
        school_id    TEXT,
        region       TEXT,
        division     TEXT,
        province     TEXT,
        city         TEXT,
        municipality TEXT,
        latitude     TEXT,
        longitude    TEXT,

        engineer_id                  TEXT,
        engineer_name                TEXT,
        uploader_type                TEXT,
        mode_of_project              TEXT,
        implementing_agency          TEXT,
        implementing_agency_specific TEXT,
        is_donated                   BOOLEAN DEFAULT FALSE,
        program_type                 TEXT,
        approval_status              TEXT,

        project_category    TEXT,
        project_category_id TEXT,
        scope_of_work       TEXT,
        number_of_classrooms INTEGER,
        number_of_sites      INTEGER,
        number_of_storeys    INTEGER,
        no_of_units          INTEGER DEFAULT 0,

        funding_year                 INTEGER,
        funding_year_justification   TEXT,
        approved_budget_for_contract NUMERIC,
        contract_amount              NUMERIC,
        batch_of_funds               TEXT,
        funds_utilized               NUMERIC(20, 2),
        savings                      NUMERIC(20, 2),

        status_of_construction_phase TEXT,
        accomplishment_percentage    INTEGER DEFAULT 0,
        status_as_of                 TIMESTAMPTZ,
        status_design_phase          TEXT,
        actions                      TEXT,
        delay_reason                 TEXT,
        other_remarks                TEXT,

        construction_start_date          TIMESTAMPTZ,
        target_completion_date           TIMESTAMPTZ,
        revised_target_completion_date   TIMESTAMPTZ,
        actual_completion_date           TIMESTAMPTZ,
        notice_to_proceed                TIMESTAMPTZ,
        time_lapsed_days                 INTEGER,
        time_lapsed_percentage           TEXT,

        issuance_of_invitation_to_bid  TIMESTAMPTZ,
        pre_bid_conference             TIMESTAMPTZ,
        opening_of_technical_proposal  TIMESTAMPTZ,
        opening_of_financial_proposal  TIMESTAMPTZ,
        request_for_quotation          TIMESTAMPTZ,
        negotiation                    TIMESTAMPTZ,
        opening_of_quotation           TIMESTAMPTZ,
        date_notice_of_award           TIMESTAMPTZ,
        contract_id                    TEXT,
        contractor_name                TEXT,

        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    console.log('  ✅ eng_archi_createdupdated_projects created');

    console.log('Creating indices...');
    await client.query(`CREATE INDEX idx_eaup_ipc ON eng_archi_createdupdated_projects(ipc);`);
    await client.query(`CREATE INDEX idx_eaup_ipc_update_id ON eng_archi_createdupdated_projects(ipc, update_id DESC);`);
    await client.query(`CREATE INDEX idx_eacp_engineer_id ON eng_archi_created_projects(engineer_id);`);
    await client.query(`CREATE INDEX idx_eacp_funding_year ON eng_archi_created_projects(funding_year);`);
    await client.query(`CREATE INDEX idx_eacp_division ON eng_archi_created_projects(division);`);
    console.log('  ✅ Indices created');

    console.log('Creating view v_latest_eng_project_state...');
    await client.query(`
      CREATE VIEW v_latest_eng_project_state AS
      SELECT DISTINCT ON (u.ipc)
        u.*,
        c.created_at AS project_created_at
      FROM eng_archi_createdupdated_projects u
      JOIN eng_archi_created_projects c ON c.ipc = u.ipc
      ORDER BY u.ipc, u.update_id DESC;
    `);
    console.log('  ✅ View created');

    await client.query('COMMIT');
    console.log('\n✅ Migration complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed — rolled back:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
