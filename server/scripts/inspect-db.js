import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function inspect() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/MindRush';
  console.log('Connecting to:', uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('\n--- Collections in Database: ' + db.databaseName + ' ---');
  if (collections.length === 0) {
    console.log('Database is currently empty (no collections created yet).');
  }
  for (const c of collections) {
    const count = await db.collection(c.name).countDocuments();
    console.log(`- Collection: "${c.name}" -> ${count} documents`);
    if (count > 0) {
      const sample = await db.collection(c.name).find({}).project({ passwordHash: 0 }).limit(3).toArray();
      console.log('  Sample entries (passwords omitted):');
      console.log(JSON.stringify(sample, null, 2));
    }
  }
  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error('Error connecting to MongoDB:', err.message);
  process.exit(1);
});
