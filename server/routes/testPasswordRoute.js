const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Test route to demonstrate password hashing
router.post('/demo-password', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        console.log('\n========== PASSWORD DEMO ==========');
        console.log('1. Original Password:', password);

        // Generate salt
        const salt = await bcrypt.genSalt(10);
        console.log('2. Generated Salt:', salt);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, salt);
        console.log('3. Hashed Password:', hashedPassword);

        // Test comparisons
        const correctPasswordTest = await bcrypt.compare(password, hashedPassword);
        const wrongPasswordTest = await bcrypt.compare('wrongPassword', hashedPassword);

        console.log('\n4. Password Verification:');
        console.log('   Correct password matches?', correctPasswordTest);
        console.log('   Wrong password matches?', wrongPasswordTest);
        console.log('=====================================\n');

        res.json({
            message: 'Password hashing demo',
            original: password,
            hashed: hashedPassword,
            saltUsed: salt,
            hashLength: hashedPassword.length,
            verification: {
                correctPassword: correctPasswordTest,
                wrongPassword: wrongPasswordTest
            },
            explanation: {
                step1: 'Password received from user',
                step2: 'Salt generated (random data)',
                step3: 'Password + Salt = Hashed password',
                step4: 'Hashed password stored in database',
                step5: 'Original password is gone forever!'
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Compare multiple hashes for same password
router.post('/demo-multiple-hashes', async (req, res) => {
    try {
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'Password required' });
        }

        const hashes = [];

        // Generate 3 different hashes for same password
        for (let i = 1; i <= 3; i++) {
            const hash = await bcrypt.hash(password, 10);
            hashes.push(hash);
        }

        // Verify all hashes work with original password
        const verifications = await Promise.all(
            hashes.map(hash => bcrypt.compare(password, hash))
        );

        res.json({
            message: 'Same password, different hashes (due to random salt)',
            originalPassword: password,
            hashes: hashes,
            allHashesValid: verifications.every(v => v === true),
            explanation: 'Each hash has a different salt embedded, so they look different but all validate the same password'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;