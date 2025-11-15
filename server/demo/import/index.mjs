// ============================================
// IMPORT DEMO - Modern ES Modules
// ============================================

console.log('🚀 START - Import Demo');

console.log('⏳ Step 1: Before import');

// IMPORT is parsed before execution (hoisted)
import { data } from './helper.mjs';

console.log('⏳ Step 2: After import');
console.log('📄 Data:', data);

console.log('🏁 END - Import Demo');
