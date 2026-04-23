export PGPASSWORD='<REDACTED_PGB_PASS>'
DB_HOST='stride-posgre-prod-01.postgres.database.azure.com'
DB_USER='Administrator1'
DB_NAME='insightEd'

echo "1. Indexing School Relations..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_school_docs_binary_id ON school_documents(binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_school_own_docs_binary_id ON school_ownership_docs(binary_id);"

echo "2. Indexing LGU & Project Relations..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lgu_proj_binary_id ON lgu_projects(binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proj_docs_binary_id ON project_documents(binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lgu_image_binary_id ON lgu_image(binary_id);"

echo "3. Indexing Engineer Dashboard Relations (Mission Critical)..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_image_binary_id ON engineer_image(binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_binary_id ON engineer_documents(binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_pow_id ON engineer_documents(pow_binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_dupa_id ON engineer_documents(dupa_binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_contract_id ON engineer_documents(contract_binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_rta_id ON engineer_documents(rta_binary_id);"
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_eng_docs_moa_id ON engineer_documents(moa_binary_id);"

echo "Indexing complete."
