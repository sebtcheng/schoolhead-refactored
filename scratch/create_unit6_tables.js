import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';

const ddl = `
CREATE TABLE IF NOT EXISTS unit6_school_resources (
    iern TEXT PRIMARY KEY REFERENCES ph_schools(iern) ON DELETE CASCADE,
    school_id TEXT UNIQUE REFERENCES ph_schools(school_id) ON DELETE CASCADE,
    iern_val TEXT,
    unit6_completed BOOLEAN DEFAULT FALSE,
    unit6_updated_at TIMESTAMPTZ,
    -- Furniture (General stats)
    has_general_rooms BOOLEAN DEFAULT FALSE,
    general_rooms_count INTEGER DEFAULT 0,
    armchair_wood_func INTEGER DEFAULT 0, armchair_wood_broken INTEGER DEFAULT 0,
    armchair_plastic_func INTEGER DEFAULT 0, armchair_plastic_broken INTEGER DEFAULT 0,
    armchair_plastic_steel_func INTEGER DEFAULT 0, armchair_plastic_steel_broken INTEGER DEFAULT 0,
    individual_table_chair_func INTEGER DEFAULT 0, individual_table_chair_broken INTEGER DEFAULT 0,
    two_seater_wood_func INTEGER DEFAULT 0, two_seater_wood_broken INTEGER DEFAULT 0,
    two_seater_wood_steel_func INTEGER DEFAULT 0, two_seater_wood_steel_broken INTEGER DEFAULT 0,
    wooden_chair_only_func INTEGER DEFAULT 0, wooden_chair_only_broken INTEGER DEFAULT 0,
    plastic_chair_only_func INTEGER DEFAULT 0, plastic_chair_only_broken INTEGER DEFAULT 0,
    has_teacher_desk BOOLEAN DEFAULT FALSE,
    -- ICT (Main stats)
    laptops_total INTEGER DEFAULT 0, laptops_func INTEGER DEFAULT 0, laptops_teaching INTEGER DEFAULT 0, laptops_working INTEGER DEFAULT 0,
    tablets_total INTEGER DEFAULT 0, tablets_func INTEGER DEFAULT 0, tablets_teaching INTEGER DEFAULT 0, tablets_working INTEGER DEFAULT 0,
    desktops_total INTEGER DEFAULT 0, desktops_func INTEGER DEFAULT 0, desktops_teaching INTEGER DEFAULT 0, desktops_working INTEGER DEFAULT 0,
    smart_tvs_total INTEGER DEFAULT 0, smart_tvs_func INTEGER DEFAULT 0, smart_tvs_cond TEXT,
    projectors_total INTEGER DEFAULT 0, projectors_func INTEGER DEFAULT 0, projectors_cond TEXT,
    printers_total INTEGER DEFAULT 0, printers_func INTEGER DEFAULT 0, printers_cond TEXT,
    unit7_has_ecart BOOLEAN DEFAULT FALSE,
    -- WASH (Toilet & sanitation stats)
    male_seats_total INTEGER DEFAULT 0, male_seats_func INTEGER DEFAULT 0, male_seats_cond TEXT,
    male_urinals_total INTEGER DEFAULT 0, male_urinals_func INTEGER DEFAULT 0,
    female_seats_total INTEGER DEFAULT 0, female_seats_func INTEGER DEFAULT 0, female_seats_cond TEXT,
    common_seats_total INTEGER DEFAULT 0, common_seats_func INTEGER DEFAULT 0, common_seats_cond TEXT,
    pwd_seats_total INTEGER DEFAULT 0, pwd_seats_func INTEGER DEFAULT 0, pwd_seats_cond TEXT,
    faucets_total INTEGER DEFAULT 0, faucets_func INTEGER DEFAULT 0, faucets_cond TEXT,
    water_source TEXT,
    confirm_no_piped BOOLEAN DEFAULT FALSE,
    confirm_no_piped_text TEXT,
    confirm_zero_wash_text TEXT,
    attached_cr_classrooms INTEGER DEFAULT 0,
    attached_cr_seats INTEGER DEFAULT 0,
    attached_cr_included_in_main BOOLEAN DEFAULT FALSE,
    -- Utilities
    utility_electricity TEXT,
    confirm_no_grid BOOLEAN DEFAULT FALSE,
    confirm_no_grid_text TEXT,
    has_solar_or_gen BOOLEAN DEFAULT FALSE,
    utility_internet_yesno TEXT,
    utility_internet_type TEXT,
    confirm_no_wired BOOLEAN DEFAULT FALSE,
    confirm_no_wired_text TEXT,
    utility_internet_funder TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unit6_furniture_grades (
    id SERIAL PRIMARY KEY,
    iern TEXT REFERENCES ph_schools(iern) ON DELETE CASCADE,
    grade_level TEXT NOT NULL,
    armchair_wood_func INTEGER DEFAULT 0, armchair_wood_broken INTEGER DEFAULT 0,
    armchair_plastic_func INTEGER DEFAULT 0, armchair_plastic_broken INTEGER DEFAULT 0,
    armchair_plastic_steel_func INTEGER DEFAULT 0, armchair_plastic_steel_broken INTEGER DEFAULT 0,
    individual_table_chair_func INTEGER DEFAULT 0, individual_table_chair_broken INTEGER DEFAULT 0,
    two_seater_wood_func INTEGER DEFAULT 0, two_seater_wood_broken INTEGER DEFAULT 0,
    two_seater_wood_steel_func INTEGER DEFAULT 0, two_seater_wood_steel_broken INTEGER DEFAULT 0,
    wooden_chair_only_func INTEGER DEFAULT 0, wooden_chair_only_broken INTEGER DEFAULT 0,
    plastic_chair_only_func INTEGER DEFAULT 0, plastic_chair_only_broken INTEGER DEFAULT 0,
    is_sharing BOOLEAN DEFAULT FALSE,
    shared_with TEXT,
    is_kinder_double_shift BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS unit6_ecart_batches (
    id SERIAL PRIMARY KEY,
    iern TEXT REFERENCES ph_schools(iern) ON DELETE CASCADE,
    batches_name TEXT,
    year_received INTEGER DEFAULT 0,
    sources_fund TEXT,
    ecart_laptops INTEGER DEFAULT 0,
    ecart_tablets INTEGER DEFAULT 0,
    ecart_tv INTEGER DEFAULT 0,
    charging_condition TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting directly to Azure PostgreSQL staging database...');
    await client.connect();
    console.log('🔌 Connected! Creating Unit 6 tables...');
    await client.query(ddl);
    console.log('✅ Unit 6 tables created successfully!');
  } catch (error) {
    console.error('❌ Error executing DDL:', error);
  } finally {
    await client.end();
  }
}

main();
