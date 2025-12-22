const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/../.env' });

// Connect to DB
mongoose.connect(process.env.MONGODB_URI);

// Simple User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  age: Number
});
const User = mongoose.model('DemoUser', UserSchema);

async function demo() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('         lean() vs Normal Query Demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Clear & Insert dummy data
  await User.deleteMany({});
  const users = Array.from({ length: 1000 }, (_, i) => ({
    name: `User ${i}`,
    email: `user${i}@test.com`,
    age: 20 + (i % 40)
  }));
  await User.insertMany(users);
  console.log('✅ Inserted 1000 users\n');

  // ❌ WITHOUT lean() - Returns Mongoose Documents
  console.log('❌ WITHOUT lean():');
  console.time('   Time taken');
  const normalResult = await User.find({});
  console.timeEnd('   Time taken');
  console.log('   Type:', normalResult[0].constructor.name);
  console.log('   Has .save() method?', typeof normalResult[0].save === 'function');
  console.log('   Memory heavy: YES (full Mongoose document)\n');

  // ✅ WITH lean() - Returns plain JS objects
  console.log('✅ WITH lean():');
  console.time('   Time taken');
  const leanResult = await User.find({}).lean();
  console.timeEnd('   Time taken');
  console.log('   Type:', leanResult[0].constructor.name);
  console.log('   Has .save() method?', typeof leanResult[0].save === 'function');
  console.log('   Memory heavy: NO (plain JS object)\n');

  // Show the actual difference
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DIFFERENCE:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\nNormal Query Result (Mongoose Doc):');
  console.log(Object.keys(normalResult[0]).slice(0, 5), '... + many internal props');

  console.log('\nlean() Query Result (Plain Object):');
  console.log(leanResult[0]);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`
  | Feature          | Normal Query      | lean() Query     |
  |------------------|-------------------|------------------|
  | Returns          | Mongoose Document | Plain JS Object  |
  | .save() works?   | ✅ Yes            | ❌ No            |
  | .populate()?     | ✅ Yes            | ❌ No            |
  | Speed            | Slower            | 3-5x Faster      |
  | Memory           | Heavy             | Light            |
  | Use when         | Need to modify    | Read-only (APIs) |
  `);

  // Cleanup
  await User.deleteMany({});
  mongoose.connection.close();
}

demo().catch(console.error);
