#!/usr/bin/env tsx

import axios from 'axios';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { logger } from '../src/logger.js';

async function registerC2CAction() {
  try {
    // Fixed IDs for C2C Partnerships V4 / C2C Testing/Demos
    const accountId = 'd64305f8-d98d-4958-8d72-45ce6f379415';
    const workspaceId = '7bc9e4e0-8f06-41fd-88ef-942e3304d008';
    const webhookUrl = 'https://gallant-connection.railway.app/webhooks/frameio/custom-action';
    
    console.log('\n🎯 Registering custom action for:');
    console.log('   Account: C2C Partnerships V4');
    console.log('   Workspace: C2C Testing/Demos');
    console.log('   Webhook URL:', webhookUrl);
    
    // Get access token
    const tokenFile = '.frameio-token';
    if (!existsSync(tokenFile)) {
      console.error('\n❌ No access token found!');
      console.error('   Run "npm run frameio:info" first to authenticate');
      process.exit(1);
    }
    
    const stored = JSON.parse(await readFile(tokenFile, 'utf-8'));
    const accessToken = stored.access_token;
    
    // Create axios instance for Frame.io experimental API
    const frameioApi = axios.create({
      baseURL: 'https://api.frame.io/v4',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'api-version': 'experimental', // Enable experimental API features
      },
    });
    
    // Custom action payload
    const customActionPayload = {
      data: {
        name: 'Apply LUT',
        description: 'Apply color grading LUT to video assets',
        event: 'lut.apply',
        url: webhookUrl,
      }
    };
    
    console.log('\n📡 Calling Frame.io API...');
    const endpoint = `/accounts/${accountId}/workspaces/${workspaceId}/actions`;
    console.log('   Endpoint:', endpoint);
    
    // Register the custom action
    const response = await frameioApi.post(endpoint, customActionPayload);
    
    console.log('\n✅ Custom action registered successfully!');
    console.log('=====================================');
    console.log('ID:', response.data.data.id);
    console.log('Name:', response.data.data.name);
    console.log('Event:', response.data.data.event);
    console.log('Webhook URL:', response.data.data.url);
    console.log('Created:', response.data.data.created_at);
    
    // IMPORTANT: Save the webhook secret
    if (response.data.data.secret) {
      console.log('\n⚠️  CRITICAL - SAVE THIS WEBHOOK SECRET:');
      console.log('=====================================');
      console.log(`FRAMEIO_WEBHOOK_SECRET=${response.data.data.secret}`);
      console.log('\nYou need to:');
      console.log('1. Copy the webhook secret above');
      console.log('2. Go to Railway dashboard');
      console.log('3. Update the FRAMEIO_WEBHOOK_SECRET environment variable');
      console.log('4. Railway will automatically redeploy with the new secret');
      
      // Save locally for reference
      const actionDetails = {
        id: response.data.data.id,
        account_id: accountId,
        workspace_id: workspaceId,
        name: response.data.data.name,
        event: response.data.data.event,
        webhook_url: response.data.data.url,
        created_at: response.data.data.created_at,
        secret_hint: '***' + response.data.data.secret.slice(-4),
      };
      
      await writeFile(
        '.custom-action-c2c',
        JSON.stringify(actionDetails, null, 2),
        'utf-8'
      );
      console.log('\n💾 Action details saved to .custom-action-c2c');
    }
    
    console.log('\n🎉 Success! The "Apply LUT" action is now available in Frame.io!');
    console.log('   You can now right-click on video assets in the C2C Testing/Demos workspace');
    console.log('   and select "Apply LUT" from the custom actions menu.');
    
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('\n❌ Failed to register custom action:');
      console.error('Status:', error.response?.status);
      console.error('Response:', JSON.stringify(error.response?.data, null, 2));
      
      if (error.response?.status === 404) {
        console.error('\n⚠️  The experimental API endpoint was not found.');
        console.error('   This could mean:');
        console.error('   1. The experimental API is not enabled for this account');
        console.error('   2. Custom Actions feature is not available yet');
      } else if (error.response?.status === 403) {
        console.error('\n⚠️  Access denied. Custom Actions may not be enabled for your account.');
        console.error('   Contact Frame.io support to enable this feature.');
      } else if (error.response?.status === 401) {
        console.error('\n⚠️  Authentication failed. Token may be expired.');
        console.error('   Run "npm run frameio:info" to get a new token.');
      }
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Run it
registerC2CAction();