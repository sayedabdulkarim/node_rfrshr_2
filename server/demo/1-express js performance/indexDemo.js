const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

mongoose.connect(process.env.MONGODB_URI);

// Schema WITHOUT index
const WithoutIndexSchema = new mongoose.Schema({
  email: String,
  name: String,
  age: Number
});
const WithoutIndex = mongoose.model('WithoutIndex', WithoutIndexSchema);

// Schema WITH index on email
const WithIndexSchema = new mongoose.Schema({
  email: { type: String, index: true },  // 👈 INDEX added
  name: String,
  age: Number
});
const WithIndex = mongoose.model('WithIndex', WithIndexSchema);

async function demo() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('         MongoDB Index Demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Clear collections
  await WithoutIndex.deleteMany({});
  await WithIndex.deleteMany({});

  // Insert 10,000 documents in both
  const docs = Array.from({ length: 10000 }, (_, i) => ({
    email: `user${i}@test.com`,
    name: `User ${i}`,
    age: 20 + (i % 40)
  }));

  console.log('⏳ Inserting 10,000 documents...');
  await WithoutIndex.insertMany(docs);
  await WithIndex.insertMany(docs);
  console.log('✅ Done!\n');

  // Wait for index to build
  await new Promise(r => setTimeout(r, 1000));

  const searchEmail = 'user9999@test.com';

  // ❌ WITHOUT Index
  console.log('❌ WITHOUT Index (email field):');
  console.log(`   Searching for: ${searchEmail}`);
  console.time('   Time taken');
  const result1 = await WithoutIndex.findOne({ email: searchEmail });
  console.timeEnd('   Time taken');

  // Check query plan
  const explain1 = await WithoutIndex.findOne({ email: searchEmail }).explain('executionStats');
  console.log('   Scan type:', explain1.queryPlanner.winningPlan.stage);
  console.log('   Docs examined:', explain1.executionStats.totalDocsExamined);

  console.log('');

  // ✅ WITH Index
  console.log('✅ WITH Index (email field):');
  console.log(`   Searching for: ${searchEmail}`);
  console.time('   Time taken');
  const result2 = await WithIndex.findOne({ email: searchEmail });
  console.timeEnd('   Time taken');

  // Check query plan
  const explain2 = await WithIndex.findOne({ email: searchEmail }).explain('executionStats');
  console.log('   Scan type:', explain2.queryPlanner.winningPlan.inputStage?.stage || explain2.queryPlanner.winningPlan.stage);
  console.log('   Docs examined:', explain2.executionStats.totalDocsExamined);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`
  | Feature         | Without Index    | With Index      |
  |-----------------|------------------|-----------------|
  | Scan Type       | COLLSCAN (Full)  | IXSCAN (Index)  |
  | Docs Examined   | 10,000 (all!)    | 1 (direct!)     |
  | Speed           | Slow             | Fast            |

  COLLSCAN = Collection Scan (checks EVERY document) 🐢
  IXSCAN   = Index Scan (jumps directly to result) 🚀

  Real-world: 1 Million docs me COLLSCAN = 💀 Server hang
  `);

  // Cleanup
  await WithoutIndex.deleteMany({});
  await WithIndex.deleteMany({});
  mongoose.connection.close();
}

demo().catch(console.error);
