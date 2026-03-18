import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { Client } = pg;
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error('SUPABASE_DB_URL is required');
  process.exit(1);
}

const client = new Client({ connectionString });

async function run() {
  try {
    await client.connect();
    const sql = fs.readFileSync('supabase/migrations/20260318020000_create_store_documents_bucket.sql', 'utf8');
    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.end();
  }
}
run();
