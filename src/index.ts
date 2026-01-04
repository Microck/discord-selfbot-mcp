#!/usr/bin/env node
import { loadConfig } from './core/config.js';
import { initLogger, getLogger } from './core/logger.js';
import { initDiscordClient } from './discord/index.js';
import { createMcpServer, startMcpServer } from './mcp/index.js';

import './tools/system/index.js';
import './tools/guilds/index.js';
import './tools/channels/index.js';
import './tools/messages/index.js';
import './tools/messages/reactions.js';
import './tools/messages/pins.js';
import './tools/dms/index.js';
import './tools/threads/index.js';
import './tools/presence/index.js';
import './tools/voice/index.js';
import './tools/relationships/index.js';
import './tools/notifications/index.js';
import './tools/files/index.js';
import './tools/events/index.js';
import './tools/profile/index.js';
import './tools/interactions/index.js';
import './tools/invites/index.js';

async function main() {
  try {
    const config = loadConfig();
    const logger = initLogger(config.logLevel);
    
    logger.info('Starting Discord Selfbot MCP server...');
    
    await initDiscordClient(config);
    
    const server = createMcpServer();
    await startMcpServer(server);
    
    logger.info('MCP server ready');
    
    process.on('SIGINT', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      logger.info('Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
