/**
 * Script to test Gemini API directly without retry logic
 * Run with: node scripts/test-gemini-api-direct.js
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../src/config/index.js';

async function testGeminiAPI() {
  try {
    console.log('Testing Gemini API directly...\n');
    console.log('API Key:', config.ai.geminiApiKey ? `${config.ai.geminiApiKey.substring(0, 10)}...` : 'NOT SET');
    console.log('Model:', config.ai.geminiModel);
    console.log('');

    if (!config.ai.geminiApiKey) {
      console.error('❌ GEMINI_API_KEY is not configured!');
      console.log('Please set GEMINI_API_KEY in your .env file');
      process.exit(1);
    }

    const genAI = new GoogleGenerativeAI(config.ai.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: config.ai.geminiModel });

    console.log('Sending test request to Gemini API...');
    const result = await model.generateContent('Say hello in one sentence.');
    const response = await result.response;
    const text = response.text();

    console.log('✅ Success! Gemini API is working.');
    console.log('Response:', text);
    console.log('');
    console.log('The AI chat should now work correctly.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gemini API test failed!');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.message.includes('API_KEY_INVALID')) {
      console.log('⚠️  The API key is invalid. Please check:');
      console.log('   1. The API key is correct in your .env file');
      console.log('   2. The API key is enabled at: https://makersuite.google.com/app/apikey');
    } else if (error.message.includes('429') || error.message.includes('quota')) {
      console.log('⚠️  Rate limit or quota exceeded. Please:');
      console.log('   1. Wait a few minutes and try again');
      console.log('   2. Check your quota at: https://makersuite.google.com/app/apikey');
      console.log('   3. Consider upgrading to a paid tier');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.log('⚠️  Permission denied. The API key may not have access to this model.');
      console.log('   Try using "gemini-1.5-flash" instead of "gemini-2.0-flash"');
    } else {
      console.log('Full error:', error);
    }
    
    process.exit(1);
  }
}

testGeminiAPI();
