import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatMessage } from '../../core/formatting/index.js';
import { parseChannelInput, parseGuildInput } from '../../core/resolvers/index.js';
import { notFoundError } from '../../core/errors/index.js';

const getMentionsTool = createTool(
  'get_mentions',
  'Get recent messages that mention you',
  z.object({
    guild_id: z.string().optional().describe('Guild ID to filter mentions'),
    limit: z.number().min(1).max(100).optional().default(25),
    roles: z.boolean().optional().default(true).describe('Include role mentions'),
    everyone: z.boolean().optional().default(true).describe('Include @everyone/@here'),
  }),
  async (ctx, input) => {
    const userId = ctx.client.user?.id;
    if (!userId) {
      return failure(notFoundError('User', 'self'));
    }

    let guilds = [...ctx.client.guilds.cache.values()];
    if (input.guild_id) {
      const guild = ctx.client.guilds.cache.get(input.guild_id);
      if (!guild) {
        return failure(notFoundError('Guild', input.guild_id));
      }
      guilds = [guild];
    }

    const mentions: ReturnType<typeof formatMessage>[] = [];

    for (const guild of guilds) {
      if (mentions.length >= (input.limit ?? 25)) break;

      const textChannels = guild.channels.cache.filter(
        (c) => c.type === 'GUILD_TEXT' || c.type === 'GUILD_NEWS'
      );

      for (const [, channel] of textChannels) {
        if (mentions.length >= (input.limit ?? 25)) break;

        try {
          const messages = await (channel as { messages: { fetch: (opts: { limit: number }) => Promise<Map<string, { mentions: { users: Map<string, unknown>; roles: Map<string, unknown>; everyone: boolean }; content: string }>> } }).messages.fetch({ limit: 50 });
          
          for (const [, message] of messages) {
            if (mentions.length >= (input.limit ?? 25)) break;

            const isMentioned = message.mentions.users.has(userId);
            const roleMentioned = input.roles && message.mentions.roles.size > 0;
            const everyoneMentioned = input.everyone && message.mentions.everyone;

            if (isMentioned || roleMentioned || everyoneMentioned) {
              mentions.push(formatMessage(message as Parameters<typeof formatMessage>[0]));
            }
          }
        } catch {
          continue;
        }
      }
    }

    return success({
      count: mentions.length,
      mentions,
    });
  }
);

const markAsReadTool = createTool(
  'mark_as_read',
  'Mark a channel as read',
  z.object({
    channel_id: z.string().describe('Channel ID to mark as read'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }

    if ('acknowledge' in channel) {
      await (channel as unknown as { acknowledge: () => Promise<void> }).acknowledge();
    }

    return success({
      channelId,
      message: 'Channel marked as read',
    });
  }
);

const markGuildAsReadTool = createTool(
  'mark_guild_as_read',
  'Mark all channels in a guild as read',
  z.object({
    guild_id: z.string().describe('Guild ID'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    if ('acknowledge' in guild) {
      await (guild as unknown as { acknowledge: () => Promise<void> }).acknowledge();
    }

    return success({
      guildId,
      message: 'Guild marked as read',
    });
  }
);

const muteChannelTool = createTool(
  'mute_channel',
  'Mute or unmute a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    muted: z.boolean().default(true).describe('Mute (true) or unmute (false)'),
    duration: z.enum(['forever', '15m', '1h', '8h', '24h']).optional().default('forever'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }

    const durationMap: Record<string, number | null> = {
      forever: null,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    if ('setMuted' in channel) {
      const duration = input.duration ?? 'forever';
      await (channel as unknown as { setMuted: (muted: boolean, duration?: number | null) => Promise<void> }).setMuted(
        input.muted ?? true,
        durationMap[duration]
      );
    }

    return success({
      channelId,
      muted: input.muted,
      duration: input.duration,
      message: input.muted ? 'Channel muted' : 'Channel unmuted',
    });
  }
);

const muteGuildTool = createTool(
  'mute_guild',
  'Mute or unmute a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    muted: z.boolean().default(true).describe('Mute (true) or unmute (false)'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    if ('setMuted' in guild) {
      await (guild as unknown as { setMuted: (muted: boolean) => Promise<void> }).setMuted(input.muted ?? true);
    }

    return success({
      guildId,
      muted: input.muted,
      message: input.muted ? 'Guild muted' : 'Guild unmuted',
    });
  }
);

export const notificationTools = {
  name: 'notifications',
  tools: [
    getMentionsTool,
    markAsReadTool,
    markGuildAsReadTool,
    muteChannelTool,
    muteGuildTool,
  ],
};

registerToolGroup(notificationTools);
