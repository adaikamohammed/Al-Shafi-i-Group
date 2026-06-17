const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const apiDir = path.join(__dirname, '../src/app/api');
const tempApiDir = path.join(__dirname, '../src/app/_api_temp');

let apiMoved = false;

try {
  // 1. Temporarily move/rename the api directory if it exists
  if (fs.existsSync(apiDir)) {
    console.log('Temporarily moving API directory to avoid static export errors...');
    fs.renameSync(apiDir, tempApiDir);
    apiMoved = true;
  }

  // 2. Run next build with EXPORT_STATIC=true
  console.log('Running static export build...');
  execSync('npm run build', {
    env: { ...process.env, EXPORT_STATIC: 'true' },
    stdio: 'inherit'
  });

  console.log('Static build completed successfully!');
} catch (error) {
  console.error('Static build failed:', error);
  process.exitCode = 1;
} finally {
  // 3. Restore the api directory in all cases
  if (apiMoved && fs.existsSync(tempApiDir)) {
    console.log('Restoring API directory...');
    fs.renameSync(tempApiDir, apiDir);
  }
}
