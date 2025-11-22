/**
 * Package script for Chrome Web Store distribution
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

// Files to include in the extension package
const FILES_TO_INCLUDE = [
  'manifest.json',
  'content.js',
  'popup.js',
  'popup.html'
];

// Optional files/directories
const OPTIONAL_INCLUDES = [
  'icons',
  'images'
];

function main() {
  console.log('Packaging extension for Chrome Web Store...\n');

  // Create dist directory
  if (!fs.existsSync(DIST)) {
    fs.mkdirSync(DIST, { recursive: true });
  }

  // Get version from manifest
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  const version = manifest.version;
  const zipName = `gcal-groups-v${version}.zip`;
  const zipPath = path.join(DIST, zipName);

  // Remove existing zip if present
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }

  // Verify required files exist
  const missingFiles = FILES_TO_INCLUDE.filter(f => !fs.existsSync(path.join(ROOT, f)));
  if (missingFiles.length > 0) {
    console.error('Missing required files:', missingFiles.join(', '));
    process.exit(1);
  }

  // Build file list
  const filesToZip = [...FILES_TO_INCLUDE];

  OPTIONAL_INCLUDES.forEach(item => {
    if (fs.existsSync(path.join(ROOT, item))) {
      filesToZip.push(item);
    }
  });

  // Create zip using system zip command
  const fileList = filesToZip.join(' ');
  execSync(`zip -r "${zipPath}" ${fileList}`, {
    cwd: ROOT,
    stdio: 'inherit'
  });

  console.log(`\nPackage created: ${zipPath}`);
  console.log(`Version: ${version}`);

  // Show package contents
  console.log('\nPackage contents:');
  execSync(`unzip -l "${zipPath}"`, { stdio: 'inherit' });
}

main();
