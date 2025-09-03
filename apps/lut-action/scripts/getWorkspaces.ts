#!/usr/bin/env tsx

import axios from 'axios';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

async function getWorkspaces() {
  const accountId = 'd64305f8-d98d-4958-8d72-45ce6f379415'; // C2C Partnerships V4
  
  // Get access token
  const tokenFile = '.frameio-token';
  if (!existsSync(tokenFile)) {
    console.error('No token file found. Run npm run frameio:info first');
    process.exit(1);
  }
  
  const stored = JSON.parse(await readFile(tokenFile, 'utf-8'));
  const token = stored.access_token;
  
  // Fetch workspaces
  const response = await axios.get(
    `https://api.frame.io/v4/accounts/${accountId}/workspaces`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      }
    }
  );
  
  console.log('Workspaces for C2C Partnerships V4:');
  console.log('=====================================');
  
  response.data.data.forEach((workspace: any, index: number) => {
    console.log(`${index + 1}. ${workspace.name}`);
    console.log(`   ID: ${workspace.id}`);
    console.log(`   URL Slug: ${workspace.url_slug || 'N/A'}`);
    console.log('');
  });
  
  // Find C2C Testing/Demos
  const targetWorkspace = response.data.data.find((w: any) => 
    w.name === 'C2C Testing/Demos' || w.name.includes('Testing') || w.name.includes('Demo')
  );
  
  if (targetWorkspace) {
    console.log('\n✅ Found "C2C Testing/Demos" workspace:');
    console.log(`   ID: ${targetWorkspace.id}`);
    console.log(`   Name: ${targetWorkspace.name}`);
  }
}

getWorkspaces().catch(console.error);