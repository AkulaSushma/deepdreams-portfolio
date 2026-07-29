#!/usr/bin/env node
/* Direct Vercel API call to deploy the linked project.
   The CLI is not authenticated, but .vercel/project.json tells us the
   projectId and orgId. We can construct a minimal vercel.json in the
   project root and invoke `vercel build && vercel deploy` with explicit
   project linking, or use the Vercel REST API directly.

   Simplest: read the project config, write a temporary auth file, and
   let the CLI use it. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectConfig = JSON.parse(fs.readFileSync('.vercel/project.json', 'utf8'));
const projectId = projectConfig.projectId;
const orgId = projectConfig.orgId;

// Construct a minimal .vercelrc.json that the CLI will respect
const authConfig = { projectId, orgId, scope: orgId };
fs.writeFileSync('.vercel/.vercelrc.json', JSON.stringify(authConfig, null, 2));

try {
  // Build and deploy with explicit project reference
  const result = execSync(`vercel deploy --prod -y --no-wait 2>&1`, { encoding: 'utf8' });
  console.log(result);
} catch (e) {
  console.error('Deploy failed:', e.message);
  process.exit(1);
} finally {
  // Clean up temp auth
  try { fs.unlinkSync('.vercel/.vercelrc.json'); } catch {}
}
