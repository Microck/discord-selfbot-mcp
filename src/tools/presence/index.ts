import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatUser } from '../../core/formatting/index.js';
import { parseUserInput } from '../../core/resolvers/index.js';
import { notFoundError, internalError } from '../../core/errors/index.js';

const setStatusTool = createTool(
  'set_status',
  'Set your online status',
  z.object({
    status: z.enum(['online', 'idle', 'dnd', 'invisible']).describe('Status to set'),
  }),
  async (ctx, input) => {
    const client = ctx.client;
    if (!client.user) {
      return failure(internalError('Client user not available'));
    }

    await client.user.setStatus(input.status);

    return success({
      status: input.status,
      message: `Status set to ${input.status}`,
    });
  }
);

const setCustomStatusTool = createTool(
  'set_custom_status',
  'Set a custom status message',
  z.object({
    text: z.string().max(128).optional().describe('Custom status text'),
    emoji: z.string().optional().describe('Emoji for custom status'),
    clear: z.boolean().optional().default(false).describe('Clear custom status'),
  }),
  async (ctx, input) => {
    const client = ctx.client;
    if (!client.user) {
      return failure(internalError('Client user not available'));
    }

    if (input.clear) {
      await client.user.setActivity(null as unknown as undefined);
      return success({ message: 'Custom status cleared' });
    }

    await (client.user.setActivity as (opts: unknown) => void)({
      name: input.text ?? 'Custom Status',
      type: 'CUSTOM',
      state: input.text,
    });

    return success({
      text: input.text,
      emoji: input.emoji,
      message: 'Custom status set',
    });
  }
);

const setActivityTool = createTool(
  'set_activity',
  'Set your activity (Playing, Watching, Listening, etc.)',
  z.object({
    type: z.enum(['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING']).describe('Activity type'),
    name: z.string().max(128).describe('Activity name'),
    url: z.string().url().optional().describe('Streaming URL (only for STREAMING type)'),
  }),
  async (ctx, input) => {
    const client = ctx.client;
    if (!client.user) {
      return failure(internalError('Client user not available'));
    }

    await client.user.setActivity({
      name: input.name,
      type: input.type,
      url: input.url,
    });

    return success({
      type: input.type,
      name: input.name,
      url: input.url,
      message: `Activity set to ${input.type} ${input.name}`,
    });
  }
);

const clearActivityTool = createTool(
  'clear_activity',
  'Clear your current activity',
  z.object({}),
  async (ctx) => {
    const client = ctx.client;
    if (!client.user) {
      return failure(internalError('Client user not available'));
    }

    await client.user.setActivity(null as unknown as undefined);

    return success({ message: 'Activity cleared' });
  }
);

const getUserPresenceTool = createTool(
  'get_user_presence',
  'Get presence/status of a user (if available in cache)',
  z.object({
    user_id: z.string().describe('User ID'),
    guild_id: z.string().optional().describe('Guild ID to check presence in'),
  }),
  async (ctx, input) => {
    const userId = parseUserInput(input.user_id);
    
    if (input.guild_id) {
      const guild = ctx.client.guilds.cache.get(input.guild_id);
      if (!guild) {
        return failure(notFoundError('Guild', input.guild_id));
      }

      const member = guild.members.cache.get(userId);
      if (!member) {
        return failure(notFoundError('Member', userId));
      }

      const presence = member.presence;
      return success({
        user: formatUser(member.user),
        status: presence?.status ?? 'offline',
        activities: presence?.activities?.map((a) => ({
          name: a.name,
          type: a.type,
          state: a.state,
          details: a.details,
          url: a.url,
        })) ?? [],
        clientStatus: presence?.clientStatus ?? null,
      });
    }

    const user = await ctx.client.users.fetch(userId);
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    return success({
      user: formatUser(user),
      status: 'unknown',
      note: 'Use guild_id parameter to get presence from a specific guild',
    });
  }
);

export const presenceTools = {
  name: 'presence',
  tools: [
    setStatusTool,
    setCustomStatusTool,
    setActivityTool,
    clearActivityTool,
    getUserPresenceTool,
  ],
};

registerToolGroup(presenceTools);
