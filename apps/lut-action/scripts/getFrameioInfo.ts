#!/usr/bin/env tsx

import axios from 'axios';
import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as readline from 'readline/promises';

/**
 * Get access token from stored file or prompt
 */
async function getAccessToken(): Promise<string> {
  const tokenFile = '.frameio-token';
  
  if (existsSync(tokenFile)) {
    try {
      const stored = JSON.parse(await readFile(tokenFile, 'utf-8'));
      if (stored.access_token && stored.expires_at > Date.now()) {
        console.log('✅ Using stored access token');
        return stored.access_token;
      }
    } catch (error) {
      console.warn('⚠️  Stored token expired or invalid');
    }
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\n📝 No valid access token found.');
  console.log('   To get one:');
  console.log('   1. Make sure the service is running: npm run dev');
  console.log('   2. Navigate to: https://6005e80af886.ngrok.app/auth/authorize');
  console.log('   3. Complete the OAuth flow');
  console.log('   4. The token will be saved automatically!');
  console.log('\n   Or paste an existing token below:\n');
  
  const token = await rl.question('Enter your Frame.io access token: ');
  rl.close();

  // Save the token for future use
  await writeFile(tokenFile, JSON.stringify({
    access_token: token.trim(),
    expires_at: Date.now() + 24 * 60 * 60 * 1000, // Assume 24 hours
  }), 'utf-8');
  console.log('✅ Token saved for future use\n');

  return token.trim();
}

/**
 * Prompt user to select from a list of options
 */
async function promptSelection(items: any[], displayField: string, message: string): Promise<any> {
  if (items.length === 0) {
    return null;
  }

  if (items.length === 1) {
    const displayValue = items[0][displayField] || items[0].display_name || items[0].name || 'Unknown';
    console.log(`\n✅ Only one ${message.toLowerCase()} found, using: ${displayValue}`);
    return items[0];
  }

  console.log(`\n${message}:`);
  items.forEach((item, index) => {
    const displayValue = item[displayField] || item.display_name || item.name || 'Unknown';
    console.log(`  ${index + 1}. ${displayValue}`);
    if (item.id) {
      console.log(`     ID: ${item.id}`);
    }
    if (item.roles && item.roles.length > 0) {
      console.log(`     Role: ${item.roles.join(', ')}`);
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let selection: number;
  do {
    const input = await rl.question(`\nSelect ${message.toLowerCase()} (1-${items.length}): `);
    selection = parseInt(input);
  } while (isNaN(selection) || selection < 1 || selection > items.length);

  rl.close();
  return items[selection - 1];
}

/**
 * Get Frame.io account and workspace information with user selection
 */
async function getFrameioInfo() {
  try {
    const accessToken = await getAccessToken();
    
    const api = axios.create({
      baseURL: 'https://api.frame.io/v4',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    // Get current user info
    console.log('🔍 Fetching user information...');
    const meResponse = await api.get('/me');
    const userData = meResponse.data.data;
    const userName = userData.name;
    const userEmail = userData.email;
    
    console.log('\n👤 User Information:');
    console.log(`   Name: ${userName}`);
    console.log(`   Email: ${userEmail}`);

    // Get all accounts
    console.log('\n🔍 Fetching accounts...');
    const accountsResponse = await api.get('/accounts');
    const accounts = accountsResponse.data.data;
    
    if (accounts.length === 0) {
      console.error('❌ No accounts found for this user');
      process.exit(1);
    }

    // Let user select an account
    const selectedAccount = await promptSelection(
      accounts,
      'display_name',
      '📋 Select an Account'
    );

    if (!selectedAccount) {
      console.error('❌ No account selected');
      process.exit(1);
    }

    console.log(`\n✅ Selected Account: ${selectedAccount.display_name || selectedAccount.name}`);
    console.log(`   ID: ${selectedAccount.id}`);

    // Get workspaces for selected account
    console.log(`\n🔍 Fetching workspaces for account "${selectedAccount.display_name || selectedAccount.name}"...`);
    
    let workspaces = [];
    try {
      const workspacesResponse = await api.get(`/accounts/${selectedAccount.id}/workspaces`);
      workspaces = workspacesResponse.data.data;
    } catch (error: any) {
      console.error(`❌ Could not fetch workspaces: ${error.response?.data?.errors?.[0]?.detail || error.message}`);
      console.error('\n⚠️  This account may not have access to workspaces or Custom Actions.');
      console.error('   Please select a different account or contact Frame.io support.');
      process.exit(1);
    }

    if (workspaces.length === 0) {
      console.error('❌ No workspaces found in this account');
      console.error('   Custom Actions require a workspace. Please create one in Frame.io first.');
      process.exit(1);
    }

    // Let user select a workspace
    const selectedWorkspace = await promptSelection(
      workspaces,
      'name',
      '📁 Select a Workspace'
    );

    if (!selectedWorkspace) {
      console.error('❌ No workspace selected');
      process.exit(1);
    }

    console.log(`\n✅ Selected Workspace: ${selectedWorkspace.name}`);
    console.log(`   ID: ${selectedWorkspace.id}`);

    // Save the configuration
    const frameioConfig = {
      account_id: selectedAccount.id,
      account_name: selectedAccount.display_name || selectedAccount.name,
      workspace_id: selectedWorkspace.id,
      workspace_name: selectedWorkspace.name,
      user_name: userName,
      user_email: userEmail,
      selected_at: new Date().toISOString(),
    };

    await writeFile('.frameio-config', JSON.stringify(frameioConfig, null, 2));
    
    console.log('\n💾 Configuration saved to .frameio-config');
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log(`Account: ${selectedAccount.display_name || selectedAccount.name}`);
    console.log(`Account ID: ${selectedAccount.id}`);
    console.log(`Workspace: ${selectedWorkspace.name}`);
    console.log(`Workspace ID: ${selectedWorkspace.id}`);
    console.log('\n✨ You can now run "npm run register:action" to create your custom action!');

  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error('\n❌ Error fetching Frame.io information:');
      console.error('Status:', error.response?.status);
      console.error('Response:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.error('\n⚠️  Authentication failed. Please get a fresh token and try again.');
        // Remove invalid token
        try {
          await import('fs/promises').then(fs => fs.unlink('.frameio-token'));
          console.log('   Removed invalid token. Please run the command again.');
        } catch {}
      }
    } else {
      console.error('Unexpected error:', error);
    }
    process.exit(1);
  }
}

// Run the script
getFrameioInfo().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});