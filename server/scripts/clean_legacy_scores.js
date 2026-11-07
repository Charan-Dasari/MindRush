import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;

  const targetScoreIds = [
    new ObjectId('6ae1dd2969ce6d3f1b3b0b2c'),
    new ObjectId('6ae1dd8b844dec32939519ba'),
    new ObjectId('6ae1ddc8bc5bc1b8a467a804')
  ];

  const scoreRes = await db.collection('scores').deleteMany({
    _id: { $in: targetScoreIds }
  });
  console.log('Deleted legacy test scores count:', scoreRes.deletedCount);

  const targetUserIds = [
    new ObjectId('6ae1dce0e59cebd12a773e55'),
    new ObjectId('6ae1dd2369ce6d3f1b3b0b2b'),
    new ObjectId('6ae1dd81844dec32939519b9')
  ];

  const userRes = await db.collection('users').deleteMany({
    _id: { $in: targetUserIds }
  });
  console.log('Deleted legacy test users count:', userRes.deletedCount);

  const remainingScores = await db.collection('scores').find({}).toArray();
  console.log('\n=== REMAINING LEGITIMATE SCORES IN ATLAS ===');
  console.log(JSON.stringify(remainingScores, null, 2));

  const remainingUsers = await db.collection('users').find({}).project({ passwordHash: 0 }).toArray();
  console.log('\n=== REMAINING LEGITIMATE USERS IN ATLAS ===');
  console.log(JSON.stringify(remainingUsers, null, 2));

  await mongoose.disconnect();
}

clean().catch(console.error);

