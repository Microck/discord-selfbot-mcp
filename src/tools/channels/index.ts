import { z } from 'zod';
import type { TextChannel, VoiceChannel, GuildChannel, Channel } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatChannel } from '../../core/formatting/index.js';
import { parseChannelInput, parseGuildInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError } from '../../core/errors/index.js';

const CHANNEL_TYPES = {
  GUILD_TEXT: 'GUILD_TEXT',
  GUILD_VOICE: 'GUILD_VOICE',
  GUILD_CATEGORY: 'GUILD_CATEGORY',
  GUILD_NEWS: 'GUILD_NEWS',
  GUILD_STAGE_VOICE: 'GUILD_STAGE_VOICE',
  GUILD_PUBLIC_THREAD: 'GUILD_PUBLIC_THREAD',
  GUILD_PRIVATE_THREAD: 'GUILD_PRIVATE_THREAD',
  GUILD_NEWS_THREAD: 'GUILD_NEWS_THREAD',
} as const;

const listChannelsTool = createTool(
  'list_channels',
  'List channels in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    type: z.enum(['text', 'voice', 'category', 'thread', 'all']).optional().default('all'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    let channels = [...guild.channels.cache.values()];

    const filterType = input.type ?? 'all';
    if (filterType !== 'all') {
      const typeMap: Record<string, string[]> = {
        text: [CHANNEL_TYPES.GUILD_TEXT, CHANNEL_TYPES.GUILD_NEWS],
        voice: [CHANNEL_TYPES.GUILD_VOICE, CHANNEL_TYPES.GUILD_STAGE_VOICE],
        category: [CHANNEL_TYPES.GUILD_CATEGORY],
        thread: [CHANNEL_TYPES.GUILD_PUBLIC_THREAD, CHANNEL_TYPES.GUILD_PRIVATE_THREAD, CHANNEL_TYPES.GUILD_NEWS_THREAD],
      };
      const types = typeMap[filterType] ?? [];
      channels = channels.filter((c) => types.includes(c.type));
    }

    return success({
      count: channels.length,
      channels: channels.map((c) => formatChannel(c)),
    });
  }
);

const getChannelInfoTool = createTool(
  'get_channel_info',
  'Get detailed information about a channel',
  z.object({
    channel_id: z.string().describe('Channel ID or link'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }

    if (channel.partial) {
      return failure(notFoundError('Channel', channelId));
    }

    const base = formatChannel(channel as Channel);
    const extra: Record<string, unknown> = {};

    if ('members' in channel) {
      extra.memberCount = (channel as VoiceChannel).members.size;
    }
    if ('lastMessageId' in channel) {
      extra.lastMessageId = (channel as TextChannel).lastMessageId;
    }
    if ('rateLimitPerUser' in channel) {
      extra.slowmode = (channel as TextChannel).rateLimitPerUser;
    }

    return success({ ...base, ...extra });
  }
);

const createChannelTool = createTool(
  'create_channel',
  'Create a new channel in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    name: z.string().min(1).max(100).describe('Channel name'),
    type: z.enum(['text', 'voice', 'category']).default('text'),
    topic: z.string().max(1024).optional().describe('Channel topic (text channels only)'),
    parent_id: z.string().optional().describe('Category ID to place channel under'),
    nsfw: z.boolean().optional().default(false),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const channelType = input.type ?? 'text';
    const typeMap: Record<string, string> = {
      text: 'GUILD_TEXT',
      voice: 'GUILD_VOICE',
      category: 'GUILD_CATEGORY',
    };

    const channel = await guild.channels.create(input.name, {
      type: typeMap[channelType] as 'GUILD_TEXT' | 'GUILD_VOICE' | 'GUILD_CATEGORY',
      topic: input.topic,
      parent: input.parent_id,
      nsfw: input.nsfw,
    });

    return success(formatChannel(channel));
  }
);

const deleteChannelTool = createTool(
  'delete_channel',
  'Delete a channel',
  z.object({
    channel_id: z.string().describe('Channel ID to delete'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }

    if (!('delete' in channel)) {
      return failure(forbiddenError('Cannot delete this channel type'));
    }

    const name = 'name' in channel ? (channel as GuildChannel).name : channelId;
    await (channel as unknown as { delete: () => Promise<unknown> }).delete();

    return success({
      channelId,
      name,
      message: `Channel deleted: ${name}`,
    });
  }
);

const editChannelTool = createTool(
  'edit_channel',
  'Edit channel settings',
  z.object({
    channel_id: z.string().describe('Channel ID to edit'),
    name: z.string().min(1).max(100).optional().describe('New channel name'),
    topic: z.string().max(1024).optional().describe('New topic'),
    nsfw: z.boolean().optional(),
    slowmode: z.number().min(0).max(21600).optional().describe('Slowmode in seconds'),
    parent_id: z.string().nullable().optional().describe('Category ID or null to remove'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }

    if (!('edit' in channel)) {
      return failure(forbiddenError('Cannot edit this channel type'));
    }

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.topic !== undefined) updates.topic = input.topic;
    if (input.nsfw !== undefined) updates.nsfw = input.nsfw;
    if (input.slowmode !== undefined) updates.rateLimitPerUser = input.slowmode;
    if (input.parent_id !== undefined) updates.parent = input.parent_id;

    await (channel as unknown as { edit: (data: Record<string, unknown>) => Promise<unknown> }).edit(updates);

    return success({
      channelId,
      message: 'Channel updated',
      updates,
    });
  }
);

export const channelTools = {
  name: 'channels',
  tools: [
    listChannelsTool,
    getChannelInfoTool,
    createChannelTool,
    deleteChannelTool,
    editChannelTool,
  ],
};

registerToolGroup(channelTools);
