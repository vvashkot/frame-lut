#!/usr/bin/env tsx
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testAssetAccess() {
  // Read the saved token
  const tokenPath = path.join(__dirname, '..', '.frameio-token');
  
  if (!fs.existsSync(tokenPath)) {
    console.error('❌ No saved token found. Please authenticate first.');
    process.exit(1);
  }

  const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
  const accessToken = tokenData.access_token;

  // Test asset ID from the webhook
  const assetId = '6ec50dbc-4427-4cfe-b444-7cffa7b03ecf';
  // Account ID from .custom-action-details
  const accountId = 'd64305f8-d98d-4958-8d72-45ce6f379415';

  console.log('🔍 Testing Frame.io asset access...');
  console.log(`Asset ID: ${assetId}`);
  console.log(`Account ID: ${accountId}`);
  console.log('');

  try {
    // Test 1: Try to get asset details with download URL
    console.log('📋 Test 1: Getting asset details with download URL...');
    const assetResponse = await axios.get(
      `https://api.frame.io/v4/accounts/${accountId}/files/${assetId}`,
      {
        params: { include: 'media_links.original' },
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true, // Don't throw on any status
      }
    );

    console.log(`Status: ${assetResponse.status}`);
    if (assetResponse.status === 200) {
      console.log('✅ Asset found!');
      console.log('Asset details:', JSON.stringify(assetResponse.data, null, 2));
    } else if (assetResponse.status === 404) {
      console.log('❌ Asset not found (404)');
      console.log('Response:', assetResponse.data);
      console.log('\nPossible reasons:');
      console.log('1. Asset has been deleted from Frame.io');
      console.log('2. Asset belongs to a different workspace/account');
      console.log('3. Token doesn\'t have access to this workspace');
    } else {
      console.log(`❌ Unexpected status: ${assetResponse.status}`);
      console.log('Response:', assetResponse.data);
    }

    // Test 2: List accessible workspaces
    console.log('\n📋 Test 2: Listing accessible workspaces...');
    const workspacesResponse = await axios.get(
      'https://api.frame.io/v4/workspaces',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    if (workspacesResponse.status === 200) {
      const workspaces = workspacesResponse.data;
      console.log(`✅ Found ${workspaces.length} workspace(s):`);
      workspaces.forEach((ws: any) => {
        console.log(`  - ${ws.name} (ID: ${ws.id})`);
      });
    } else {
      console.log(`❌ Failed to list workspaces: ${workspacesResponse.status}`);
      console.log('Response:', workspacesResponse.data);
    }

    // Test 3: Get user info
    console.log('\n📋 Test 3: Getting user info...');
    const meResponse = await axios.get(
      'https://api.frame.io/v4/me',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      }
    );

    if (meResponse.status === 200) {
      console.log('✅ User authenticated as:', meResponse.data.email);
      console.log('User ID:', meResponse.data.id);
    } else {
      console.log(`❌ Failed to get user info: ${meResponse.status}`);
      console.log('Response:', meResponse.data);
    }

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }

  console.log('\n💡 Next steps:');
  console.log('1. Upload a new video to your Frame.io workspace');
  console.log('2. Right-click the video and select "Apply LUT"');
  console.log('3. The webhook will provide a valid asset ID');
}

testAssetAccess().catch(console.error);