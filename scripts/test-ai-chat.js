/**
 * Script to test AI chat functionality
 * Run with: node scripts/test-ai-chat.js
 */

import geminiService from '../src/services/gemini.service.js';
import logger from '../src/utils/logger.js';

async function testAIChat() {
  try {
    console.log('Testing Gemini AI service...\n');

    // Test 1: Simple query selection
    console.log('Test 1: Query Selection (Pass 1)');
    console.log('=====================================');
    
    const availableQueries = [
      { id: 'my_appointments', description: 'Get user appointments' },
      { id: 'medicines_info', description: 'Get medicine information' },
    ];

    const userMessage = 'What are my upcoming appointments?';
    console.log(`User message: "${userMessage}"`);
    console.log('Available queries:', availableQueries.map(q => q.id).join(', '));
    
    try {
      const selectedQueries = await geminiService.selectQueries(
        userMessage,
        availableQueries,
        []
      );
      
      console.log('✓ Pass 1 successful!');
      console.log('Selected queries:', selectedQueries);
    } catch (error) {
      console.error('✗ Pass 1 failed:', error.message);
      if (error.message.includes('rate limit')) {
        console.log('\n⚠️  Rate limit error detected. This could mean:');
        console.log('   1. Gemini API key has exceeded its quota');
        console.log('   2. Too many requests in a short time');
        console.log('   3. API key is invalid or expired');
        console.log('\nCheck your API key at: https://makersuite.google.com/app/apikey');
      }
      throw error;
    }

    console.log('\n');

    // Test 2: Answer synthesis
    console.log('Test 2: Answer Synthesis (Pass 2)');
    console.log('=====================================');
    
    const queryResults = [
      {
        query_id: 'my_appointments',
        data: [
          { date: '2026-05-10', doctor: 'Dr. Smith', time: '10:00 AM' },
          { date: '2026-05-15', doctor: 'Dr. Jones', time: '2:00 PM' },
        ],
        row_count: 2,
        execution_time_ms: 45,
      },
    ];

    console.log('Query results:', JSON.stringify(queryResults, null, 2));
    
    try {
      const aiResponse = await geminiService.synthesizeAnswer(
        userMessage,
        queryResults,
        []
      );
      
      console.log('✓ Pass 2 successful!');
      console.log('AI Response:', aiResponse);
    } catch (error) {
      console.error('✗ Pass 2 failed:', error.message);
      throw error;
    }

    console.log('\n✅ All tests passed! AI chat is working correctly.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    logger.error('AI chat test failed', { error: error.message });
    process.exit(1);
  }
}

testAIChat();
