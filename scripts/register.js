#!/usr/bin/env node

/**
 * Megumi Discord Bot - Slash Command Registration Script
 *
 * Registers the `/megumi` command with the Discord API.
 * Supports both Server/Guild Install (GUILD_INSTALL) and User Account Install (USER_INSTALL).
 *
 * Usage:
 *   npm run register
 *   or:
 *   node scripts/register.js [--app-id <id>] [--token <token>] [--guild <guild_id>]
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// 1. Simple .env parser to avoid external dependencies
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

// Load .env and .dev.vars if present
const rootDir = process.cwd();
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.dev.vars'));

// 2. Parse CLI flags
const args = process.argv.slice(2);
let cliAppId = null;
let cliToken = null;
let cliGuildId = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log(`
Megumi Bot - Command Registration Tool

Usage:
  npm run register
  node scripts/register.js [options]

Options:
  --app-id, -a <id>       Discord Application ID
  --token, -t <token>     Discord Bot Token
  --guild, -g <guild_id>  Optional Guild ID (registers instantly to a test server)
  --help, -h              Show this help message

Configuration can also be provided in a .env file:
  DISCORD_APPLICATION_ID=123456789012345678
  DISCORD_BOT_TOKEN=your_bot_token_here
  DISCORD_GUILD_ID=123456789012345678 (optional)
`);
    process.exit(0);
  } else if (arg === '--app-id' || arg === '-a') {
    cliAppId = args[++i];
  } else if (arg === '--token' || arg === '-t') {
    cliToken = args[++i];
  } else if (arg === '--guild' || arg === '-g' || arg === '--guild-id') {
    cliGuildId = args[++i];
  }
}

const applicationId =
  cliAppId ||
  process.env.DISCORD_APPLICATION_ID ||
  process.env.APPLICATION_ID ||
  process.env.APP_ID;

const botToken =
  cliToken ||
  process.env.DISCORD_BOT_TOKEN ||
  process.env.BOT_TOKEN ||
  process.env.TOKEN;

const guildId =
  cliGuildId ||
  process.env.DISCORD_GUILD_ID ||
  process.env.GUILD_ID ||
  null;

// 3. Validate credentials
if (!applicationId || !botToken) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: Missing Discord credentials!');
  console.error('\nPlease provide them either in your .env file:');
  console.error('  DISCORD_APPLICATION_ID=your_application_id');
  console.error('  DISCORD_BOT_TOKEN=your_bot_token');
  console.error('\nOr pass them via command-line arguments:');
  console.error('  node scripts/register.js --app-id <id> --token <token>');
  console.error('\nYou can get these from the Discord Developer Portal:');
  console.error('  https://discord.com/developers/applications\n');
  process.exit(1);
}

// 4. Command definition
// Application Command Option Types:
// 3 = STRING, 4 = INTEGER, 5 = BOOLEAN
const megumiCommand = {
  name: 'megumi',
  description: 'Did somebody say POTENTIAL? (Generate a Megumi image with custom text)',
  options: [
    {
      name: 'text',
      description: 'The text to overlay on the image (use \\n or Shift+Enter for multiple lines)',
      type: 3, // STRING
      required: true,
    },
    {
      name: 'size',
      description: 'Base font size percentage (default: 11, min: 4, max: 24)',
      type: 4, // INTEGER
      required: false,
      min_value: 4,
      max_value: 24,
    },
    {
      name: 'wrap',
      description: 'Whether to wrap text to fit within the image (default: true)',
      type: 5, // BOOLEAN
      required: false,
    },
    {
      name: 'uppercase',
      description: 'Whether to convert text to uppercase (default: true)',
      type: 5, // BOOLEAN
      required: false,
    },
    {
      name: 'colour',
      description: 'Hex colour code for the text (default: #73B5FF)',
      type: 3, // STRING
      required: false,
    },
    {
      name: 'glow_intensity',
      description: 'Glow intensity percentage (default: 100, min: 0, max: 200)',
      type: 4, // INTEGER
      required: false,
      min_value: 0,
      max_value: 200,
    },
    {
      name: 'glow_colour',
      description: 'Hex colour code for the neon glow (default: #0033FF)',
      type: 3, // STRING
      required: false,
    },
  ],
};

// Installation types:
// 0 = GUILD_INSTALL (can be installed to servers)
// 1 = USER_INSTALL  (can be installed to user accounts)
// Contexts:
// 0 = GUILD (can be used in servers)
// 1 = BOT_DM (can be used in DMs with the bot)
// 2 = PRIVATE_CHANNEL (can be used in Group DMs and other users' DMs)
if (guildId) {
  // Guild commands can only be installed to guilds and executed in guild contexts
  megumiCommand.integration_types = [0];
  megumiCommand.contexts = [0];
} else {
  // Global commands can support both guild and user account installation across all contexts
  megumiCommand.integration_types = [0, 1];
  megumiCommand.contexts = [0, 1, 2];
}

const commands = [megumiCommand];

// 5. Register with Discord API
async function registerCommands() {
  const isGuild = Boolean(guildId);
  const endpoint = isGuild
    ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${applicationId}/commands`;

  console.log(`\x1b[36m%s\x1b[0m`, `Registering commands for Application ID: ${applicationId}`);
  if (isGuild) {
    console.log(`Target: Guild ${guildId} (Instant update)`);
  } else {
    console.log(`Target: Global (User + Server install enabled across all channels & DMs)`);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('\x1b[31m%s\x1b[0m', `Failed to register commands! HTTP Status: ${response.status}`);
      try {
        console.error(JSON.stringify(JSON.parse(errorData), null, 2));
      } catch {
        console.error(errorData);
      }
      process.exit(1);
    }

    const data = await response.json();
    console.log('\x1b[32m%s\x1b[0m', 'Successfully registered slash commands!');
    console.log('Registered commands:');
    for (const cmd of data) {
      console.log(`  - /${cmd.name} (ID: ${cmd.id})`);
    }

    if (!isGuild) {
      console.log('\n\x1b[33m%s\x1b[0m', 'Note: Global command updates may take a few moments to propagate across Discord.');
      console.log('You can now use /megumi in servers where the bot is invited, or in your account DMs if installed to your user!');
    }
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', 'Network or unexpected error while registering commands:');
    console.error(err);
    process.exit(1);
  }
}

registerCommands();
