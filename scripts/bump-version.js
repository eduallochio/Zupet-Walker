#!/usr/bin/env node
/**
 * Bump de versão do Zupet Walker
 * Uso: node scripts/bump-version.js [patch|minor|major]
 * Exemplo: node scripts/bump-version.js patch   → 1.0.0 → 1.0.1
 */

const fs = require('fs');
const path = require('path');

const appJsonPath = path.join(__dirname, '..', 'app.json');
const packageJsonPath = path.join(__dirname, '..', 'package.json');

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const type = process.argv[2] || 'patch';
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Uso: node scripts/bump-version.js [patch|minor|major]');
  process.exit(1);
}

const [major, minor, patch] = appJson.expo.version.split('.').map(Number);
let newVersion;
if (type === 'major') newVersion = `${major + 1}.0.0`;
else if (type === 'minor') newVersion = `${major}.${minor + 1}.0`;
else newVersion = `${major}.${minor}.${patch + 1}`;

const oldVersionCode = appJson.expo.android.versionCode;
const newVersionCode = oldVersionCode + 1;

const oldBuildNumber = parseInt(appJson.expo.ios.buildNumber, 10);
const newBuildNumber = oldBuildNumber + 1;

appJson.expo.version = newVersion;
appJson.expo.android.versionCode = newVersionCode;
appJson.expo.ios.buildNumber = String(newBuildNumber);

packageJson.version = newVersion;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n');
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`✅ Versão bumped: ${major}.${minor}.${patch} → ${newVersion}`);
console.log(`   Android versionCode: ${oldVersionCode} → ${newVersionCode}`);
console.log(`   iOS buildNumber: ${oldBuildNumber} → ${newBuildNumber}`);
