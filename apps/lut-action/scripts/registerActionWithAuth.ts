#!/usr/bin/env tsx

import axios from 'axios';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../src/logger.js';

async function registerActionWithAuth() {
  try {
    // Fixed IDs for C2C Partnerships V4 / C2C Testing/Demos
    const accountId = 'd64305f8-d98d-4958-8d72-45ce6f379415';
    const workspaceId = '7bc9e4e0-8f06-41fd-88ef-942e3304d008';
    const webhookUrl = 'https://frame-lut-production.up.railway.app/webhooks/frameio/custom-action';
    
    console.log('\n🎯 Registering NEW custom action with proper auth handling:');
    console.log('   Account: C2C Partnerships V4');
    console.log('   Workspace: C2C Testing/Demos');
    console.log('   Webhook URL:', webhookUrl);
    
    // Get access token from stored file
    const tokenFile = '.frameio-token';
    if (!existsSync(tokenFile)) {
      console.error('\n❌ No access token found!');
      console.error('   Run "npm run frameio:info" first to authenticate');
      process.exit(1);
    }
    
    const stored = JSON.parse(await readFile(tokenFile, 'utf-8'));
    const accessToken = stored.access_token;
    
    console.log('\n📋 This custom action will:');
    console.log('   1. Show a LUT selection form when triggered');
    console.log('   2. Process the video with the selected LUT');
    console.log('   3. Upload the processed version back to Frame.io');
    console.log('   4. Create a version stack linking original and processed');
    
    // Create axios instance for Frame.io experimental API
    const frameioApi = axios.create({
      baseURL: 'https://api.frame.io/v4',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'api-version': 'experimental',
      },
    });
    
    // Custom action payload - Frame.io will handle authentication
    const customActionPayload = {
      data: {
        name: 'Apply LUT (Production)',
        description: 'Apply professional color grading LUTs to your video assets',
        event: 'lut.apply.production',
        url: webhookUrl,
      }
    };
    
    console.log('\n📡 Registering custom action with Frame.io...');
    const endpoint = `/accounts/${accountId}/workspaces/${workspaceId}/actions`;
    
    // Register the custom action
    const response = await frameioApi.post(endpoint, customActionPayload);
    
    console.log('\n✅ Custom action registered successfully!');
    console.log('=====================================');
    console.log('ID:', response.data.data.id);
    console.log('Name:', response.data.data.name);
    console.log('Event:', response.data.data.event);
    console.log('Webhook URL:', response.data.data.url);
    console.log('Created:', response.data.data.created_at);
    
    // CRITICAL: Save and display the webhook secret
    if (response.data.data.secret) {
      console.log('\n🔐 WEBHOOK SECRET (CRITICAL - SAVE THIS NOW):');
      console.log('================================================');
      console.log(response.data.data.secret);
      console.log('================================================');
      
      console.log('\n📝 REQUIRED RAILWAY ENVIRONMENT VARIABLES:');
      console.log('-------------------------------------------');
      console.log(`FRAMEIO_WEBHOOK_SECRET=${response.data.data.secret}`);
      console.log(`FRAMEIO_ACCESS_TOKEN=${accessToken}`);
      console.log(`PROCESSING_MODE=remote`);
      
      console.log('\n🚀 Next Steps:');
      console.log('1. Copy the environment variables above');
      console.log('2. Go to Railway dashboard');
      console.log('3. Update these environment variables:');
      console.log('   - FRAMEIO_WEBHOOK_SECRET (for webhook verification)');
      console.log('   - FRAMEIO_ACCESS_TOKEN (for API authentication)');
      console.log('4. Railway will automatically redeploy');
      console.log('5. Your custom action will be ready to use!');
      
      // Save action details
      const actionDetails = {
        id: response.data.data.id,
        account_id: accountId,
        workspace_id: workspaceId,
        name: response.data.data.name,
        event: response.data.data.event,
        webhook_url: response.data.data.url,
        created_at: response.data.data.created_at,
        auth_note: 'Using stored access token for API calls',
      };
      
      await import('fs/promises').then(fs => 
        fs.writeFile(
          '.custom-action-railway',
          JSON.stringify(actionDetails, null, 2),
          'utf-8'
        )
      );
      
      console.log('\n💾 Action details saved to .custom-action-railway');
    }
    
    console.log('\n🎉 Success! The "Apply LUT (Railway)" action is now available!');
    console.log('   Right-click on any video in the C2C Testing/Demos workspace');
    console.log('   and select "Apply LUT (Railway)" to process videos.');
    
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('\n❌ Failed to register custom action:');
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response?.status === 422) {
        console.error('\n⚠️  Validation error. The action might already exist.');
        console.error('   Try using a different name or delete the existing action first.');
      }
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Run it
registerActionWithAuth();