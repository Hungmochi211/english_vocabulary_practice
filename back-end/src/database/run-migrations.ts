import { AppDataSource } from '../config/database.config';

async function runMigrations() {
  await AppDataSource.initialize();
  try {
    const executed = await AppDataSource.runMigrations({ transaction: 'all' });
    console.log(`Executed ${executed.length} migration(s) successfully.`);
  } finally {
    await AppDataSource.destroy();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
