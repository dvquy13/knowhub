#!/usr/bin/env node
// Called by release-it after:bump to keep plugin.json version in sync with package.json
import fs from 'fs';

const version = process.argv[2];
if (!version) {
  console.error('Usage: sync-plugin-version.mjs <version>');
  process.exit(1);
}

const path = 'plugin/.claude-plugin/plugin.json';
const plugin = JSON.parse(fs.readFileSync(path, 'utf8'));
plugin.version = version;
fs.writeFileSync(path, JSON.stringify(plugin, null, 2) + '\n');
console.log(`Updated ${path} to version ${version}`);
