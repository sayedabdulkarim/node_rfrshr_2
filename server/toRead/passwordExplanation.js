const bcrypt = require('bcryptjs');

// ============================================
// PASSWORD STORAGE & RETRIEVAL EXPLAINED
// ============================================

/**
 * IMPORTANT CONCEPT:
 * Passwords are NEVER stored as plain text in database!
 * We store only the HASH of the password.
 * Hash is one-way - you can't reverse it to get original password.
 */

// 1. ============ REGISTRATION PROCESS ============

async function registerExample() {
    console.log('\n===== REGISTRATION PROCESS =====\n');

    // User ka input
    const userPassword = 'myPassword123';
    console.log('1. User enters password:', userPassword);

    // Step 1: Generate Salt (random data)
    // Salt ensures same password gets different hash each time
    const salt = await bcrypt.genSalt(10); // 10 is saltRounds (complexity)
    console.log('2. Generated Salt:', salt);

    // Step 2: Hash password with salt
    const hashedPassword = await bcrypt.hash(userPassword, salt);
    console.log('3. Hashed Password:', hashedPassword);
    console.log('   (This is what we store in database)');

    // Database mein ye store hota hai:
    const databaseEntry = {
        email: 'user@example.com',
        password: hashedPassword  // Hashed version, NOT original
    };
    console.log('\n4. Database Entry:', databaseEntry);

    return hashedPassword;
}

// 2. ============ LOGIN PROCESS ============

async function loginExample(storedHashedPassword) {
    console.log('\n===== LOGIN PROCESS =====\n');

    // User login attempt
    const loginAttempt1 = 'wrongPassword';
    const loginAttempt2 = 'myPassword123';

    console.log('Stored Hash in DB:', storedHashedPassword);

    // Wrong password check
    console.log('\n1. User tries wrong password:', loginAttempt1);
    const isMatch1 = await bcrypt.compare(loginAttempt1, storedHashedPassword);
    console.log('   Password matches?', isMatch1); // false

    // Correct password check
    console.log('\n2. User tries correct password:', loginAttempt2);
    const isMatch2 = await bcrypt.compare(loginAttempt2, storedHashedPassword);
    console.log('   Password matches?', isMatch2); // true
}

// 3. ============ BCRYPT INTERNALS ============

async function explainBcryptStructure() {
    console.log('\n===== BCRYPT HASH STRUCTURE =====\n');

    const password = 'test123';
    const hash = await bcrypt.hash(password, 10);

    console.log('Full Hash:', hash);
    console.log('\nHash Breakdown:');

    // Example: $2a$10$N9qo8uLOickgx2ZMRZoMye.IjQ.FVXTLqgB4XFZzLVJXxKZsPJCGe
    const parts = hash.split('$');
    console.log('$2a     - Algorithm version');
    console.log('$10     - Cost factor (saltRounds)');
    console.log('$...    - Salt (22 characters)');
    console.log('$...    - Hashed password (31 characters)');

    // Important: Salt is embedded in the hash itself!
}

// 4. ============ SECURITY DEMONSTRATION ============

async function securityDemo() {
    console.log('\n===== SECURITY FEATURES =====\n');

    const password = 'SecurePass123';

    // Generate 3 hashes for same password
    console.log('Same password, different hashes (due to random salt):');
    for (let i = 1; i <= 3; i++) {
        const hash = await bcrypt.hash(password, 10);
        console.log(`Hash ${i}:`, hash);
    }

    // All 3 different hashes will validate correctly
    console.log('\nAll hashes validate the same password!');
}

// 5. ============ MONGOOSE MODEL IMPLEMENTATION ============

function mongooseImplementation() {
    console.log('\n===== MONGOOSE IMPLEMENTATION =====\n');

    console.log(`
// In User Model (models/User.js):

userSchema.pre('save', async function(next) {
    // Only hash if password is new or modified
    if (!this.isModified('password')) {
        return next();
    }

    // Generate salt and hash
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Method to check password during login
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};
    `);
}

// 6. ============ COMMON MISTAKES TO AVOID ============

function commonMistakes() {
    console.log('\n===== COMMON MISTAKES =====\n');

    console.log('❌ NEVER DO THIS:');
    console.log('1. Store plain text passwords');
    console.log('2. Use weak hashing (MD5, SHA1)');
    console.log('3. Hash without salt');
    console.log('4. Use same salt for all passwords');
    console.log('5. Send hashed passwords to frontend');

    console.log('\n✅ ALWAYS DO THIS:');
    console.log('1. Use bcrypt with saltRounds >= 10');
    console.log('2. Use HTTPS for password transmission');
    console.log('3. Implement password complexity rules');
    console.log('4. Never log passwords (even hashed)');
    console.log('5. Use select: false in schema for password field');
}

// 7. ============ SALT ROUNDS EXPLAINED ============

async function saltRoundsExplained() {
    console.log('\n===== SALT ROUNDS (COST FACTOR) =====\n');

    const password = 'TestPass';

    console.log('Higher salt rounds = More secure but slower\n');

    for (const rounds of [5, 10, 12, 15]) {
        const start = Date.now();
        await bcrypt.hash(password, rounds);
        const time = Date.now() - start;
        console.log(`Salt Rounds: ${rounds} - Time: ${time}ms`);
    }

    console.log('\nRecommended: 10-12 for production');
}

// ============ RUN ALL EXAMPLES ============

async function runAllExamples() {
    console.log('=========================================');
    console.log('     PASSWORD STORAGE & RETRIEVAL');
    console.log('=========================================');

    // Run examples in sequence
    const hashedPassword = await registerExample();
    await loginExample(hashedPassword);
    await explainBcryptStructure();
    await securityDemo();
    mongooseImplementation();
    commonMistakes();
    await saltRoundsExplained();

    console.log('\n=========================================');
    console.log('     KEY TAKEAWAYS:');
    console.log('=========================================');
    console.log('1. Password → Salt → Hash → Store Hash');
    console.log('2. Login: Compare entered password with stored hash');
    console.log('3. Original password is NEVER retrievable');
    console.log('4. Each registration creates unique hash (random salt)');
    console.log('5. bcrypt.compare() handles salt extraction automatically');
    console.log('=========================================\n');
}

// Run if executed directly
if (require.main === module) {
    runAllExamples().catch(console.error);
}

module.exports = {
    registerExample,
    loginExample,
    explainBcryptStructure,
    securityDemo,
    saltRoundsExplained
};