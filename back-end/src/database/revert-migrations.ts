import { AppDataSource } from '../config/database.config';

async function revertMigration() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.undoLastMigration({ transaction: 'all' });
    console.log('Reverted last migration successfully.');
  } finally {
    await AppDataSource.destroy();
  }
}

revertMigration().catch((err) => {
  console.error('Migration revert failed:', err);
  process.exit(1);
});
