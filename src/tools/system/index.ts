import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatUser } from '../../core/formatting/index.js';
import { internalError } from '../../core/errors/index.js';

const healthTool = createTool(
  'health',
  'Check Discord client connection status and health',
  z.object({}),
  async (ctx) => {
    const client = ctx.client;
    
    return success({
      status: ctx.isReady ? 'connected' : 'disconnected',
      userId: client.user?.id ?? null,
      username: client.user?.username ?? null,
      guildsCount: client.guilds.cache.size,
      ping: client.ws.ping,
      uptime: client.uptime ?? 0,
      lastError: ctx.lastError,
    });
  }
);

const whoamiTool = createTool(
  'whoami',
  'Get information about the currently logged in Discord user',
  z.object({}),
  async (ctx) => {
    const user = ctx.client.user;
    if (!user) {
      return failure(internalError('User not available'));
    }

    return success({
      ...formatUser(user),
      email: (user as unknown as { email?: string }).email ?? null,
      verified: (user as unknown as { verified?: boolean }).verified ?? null,
      mfaEnabled: (user as unknown as { mfaEnabled?: boolean }).mfaEnabled ?? null,
      locale: (user as unknown as { locale?: string }).locale ?? null,
      premiumType: (user as unknown as { premiumType?: number }).premiumType ?? null,
    });
  }
);

const getConfigTool = createTool(
  'get_config',
  'Get current MCP configuration (without sensitive data)',
  z.object({}),
  async (ctx) => {
    const { discordToken: _, ...safeConfig } = ctx.config;
    return success(safeConfig);
  }
);

export const systemTools = {
  name: 'system',
  tools: [healthTool, whoamiTool, getConfigTool],
};

registerToolGroup(systemTools);
