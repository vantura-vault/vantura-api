/**
 * Test script to verify S3 configuration
 * Usage: npx tsx scripts/testS3.ts
 */

import 'dotenv/config';
import { isS3Available, proxyImageToS3 } from '../src/services/imageStorage.js';

async function testS3() {
  console.log('🔍 Testing S3 Configuration...\n');

  console.log('Environment:');
  console.log(`  AWS_S3_BUCKET: ${process.env.AWS_S3_BUCKET || '(not set)'}`);
  console.log(`  AWS_REGION: ${process.env.AWS_REGION || '(not set)'}`);
  console.log(`  AWS_ACCESS_KEY_ID: ${process.env.AWS_ACCESS_KEY_ID ? '✓ set' : '✗ not set'}`);
  console.log(`  AWS_SECRET_ACCESS_KEY: ${process.env.AWS_SECRET_ACCESS_KEY ? '✓ set' : '✗ not set'}`);
  console.log('');

  const available = isS3Available();
  console.log(`S3 Available: ${available ? '✅ Yes' : '❌ No'}`);

  if (!available) {
    console.log('\n⚠️  S3 is not configured. Check your .env file.');
    process.exit(1);
  }

  // Test upload with a small public image
  console.log('\n📤 Testing upload with a sample image...');
  const testImageUrl = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

  try {
    const s3Url = await proxyImageToS3(testImageUrl, 'test-company-id', 'profile');

    if (s3Url) {
      console.log(`✅ Upload successful!`);
      console.log(`   S3 URL: ${s3Url}`);
      console.log('\n🎉 S3 is configured correctly!');
    } else {
      console.log('❌ Upload returned null');
    }
  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

testS3();
