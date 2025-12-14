import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const fixDatabase = async () => {
  try {
    await client.connect();
    console.log('Connected to database');

    // Добавляем колонку username, если её нет
    try {
      await client.query(`
        ALTER TABLE channels 
        ADD COLUMN IF NOT EXISTS username TEXT
      `);
      console.log('Column username added or already exists');
    } catch (error) {
      console.log('Error adding username column:', error.message);
    }

    // Убеждаемся, что username может быть NULL
    try {
      await client.query(`
        ALTER TABLE channels 
        ALTER COLUMN username DROP NOT NULL
      `);
      console.log('Username column can now be NULL');
    } catch (error) {
      // Игнорируем, если колонка уже nullable
      console.log('Username column is already nullable or error:', error.message);
    }

    console.log('Database fix completed successfully');
  } catch (error) {
    console.error('Fix error:', error);
    throw error;
  } finally {
    await client.end();
  }
};

fixDatabase();

