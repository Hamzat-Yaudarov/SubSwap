#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

console.log('🚀 Wormz Bot Setup Script\n');

// Check if .env exists
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env file from .env.example...');
  const exampleContent = fs.readFileSync(envExamplePath, 'utf8');
  fs.writeFileSync(envPath, exampleContent);
  console.log('✅ .env file created. Please update with your values:\n');
  console.log(exampleContent);
} else {
  console.log('✅ .env file already exists');
}

// Check required environment variables
const required = ['BOT_TOKEN', 'BOT_USERNAME', 'WEBAPP_URL'];
const envContent = fs.readFileSync(envPath, 'utf8');
const missing = required.filter(key => !envContent.includes(`${key}=`) || envContent.includes(`${key}=`));

if (missing.length > 0) {
  console.log('\n⚠️  Missing environment variables:');
  missing.forEach(key => console.log(`   - ${key}`));
  console.log('\nPlease update .env file with your values');
}

// Check node_modules
console.log('\n📦 Checking dependencies...');
if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
  console.log('⚠️  Dependencies not installed. Run: npm install');
} else {
  console.log('✅ Dependencies installed');
}

// Check database URL
if (!envContent.includes('DATABASE_URL=')) {
  console.log('\n⚠️  DATABASE_URL not set.');
  console.log('   For local development, use:');
  console.log('   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wormz');
  console.log('   Or set it to your Neon database URL');
}

console.log('\n✅ Setup complete!');
console.log('\nNext steps:');
console.log('1. Update .env file with your credentials');
console.log('2. Run: npm install');
console.log('3. Run: npm run dev');
console.log('\nFor production deployment, see: DEPLOYMENT.md');
