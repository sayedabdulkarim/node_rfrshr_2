// ============================================
// REQUIRE DEMO - Synchronous Loading
// ============================================

console.log('🚀 START - Require Demo');

console.log('⏳ Step 1: Before require');

// REQUIRE is SYNCHRONOUS - line by line execute hota
const helper = require('./helper');

console.log('⏳ Step 2: After require');
console.log('📄 Data:', helper.data);

console.log('🏁 END - Require Demo');
