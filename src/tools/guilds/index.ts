import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatGuild, formatChannel, formatRole } from '../../core/formatting/index.js';
import { parseGuildInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError } from '../../core/errors/index.js';

const listGuildsTool = createTool(
  'list_guilds',
  'List all Discord servers/guilds the user is a member of',
  z.object({
    limit: z.number().min(1).max(200).optional().default(100),
  }),
  async (ctx, input) => {
    const guilds = ctx.client.guilds.cache
      .map((g) => formatGuild(g))
      .slice(0, input.limit);
    
    return success({
      count: guilds.length,
      total: ctx.client.guilds.cache.size,
      guilds,
    });
  }
);

const getGuildInfoTool = createTool(
  'get_guild_info',
  'Get detailed information about a specific Discord server/guild',
  z.object({
    guild_id: z.string().describe('Guild ID or channel link containing guild'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const channels = guild.channels.cache.map((c) => formatChannel(c));
    const roles = guild.roles.cache.map((r) => formatRole(r));

    return success({
      ...formatGuild(guild),
      channels: channels.slice(0, 100),
      roles: roles.slice(0, 100),
      emojis: guild.emojis.cache.map((e) => ({
        id: e.id,
        name: e.name,
        animated: e.animated,
        url: e.url,
      })).slice(0, 100),
    });
  }
);

const getGuildMembersTool = createTool(
  'get_guild_members',
  'Get members of a guild (fetches from cache, may be incomplete)',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    limit: z.number().min(1).max(100).optional().default(50),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const members = guild.members.cache
      .map((m) => ({
        userId: m.user.id,
        username: m.user.username,
        displayName: m.displayName,
        nickname: m.nickname,
        joinedAt: m.joinedAt?.toISOString() ?? null,
        roles: m.roles.cache.map((r) => r.id),
      }))
      .slice(0, input.limit);

    return success({
      count: members.length,
      total: guild.members.cache.size,
      members,
    });
  }
);

const changeNicknameTool = createTool(
  'change_nickname',
  'Change your nickname in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    nickname: z.string().max(32).nullable().describe('New nickname, or null to reset'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const me = guild.members.me;
    if (!me) {
      return failure(forbiddenError('Not a member of this guild'));
    }

    await me.setNickname(input.nickname);

    return success({
      guildId,
      nickname: input.nickname,
      message: input.nickname ? `Nickname changed to: ${input.nickname}` : 'Nickname reset',
    });
  }
);

const leaveGuildTool = createTool(
  'leave_guild',
  'Leave a Discord server/guild',
  z.object({
    guild_id: z.string().describe('Guild ID to leave'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    await guild.leave();

    return success({
      guildId,
      guildName: guild.name,
      message: `Left guild: ${guild.name}`,
    });
  }
);

const createInviteTool = createTool(
  'create_invite',
  'Create an invite link for a channel in a guild',
  z.object({
    channel_id: z.string().describe('Channel ID to create invite for'),
    max_age: z.number().min(0).max(604800).optional().default(86400).describe('Invite expiry in seconds (0 = never, max 7 days)'),
    max_uses: z.number().min(0).max(100).optional().default(0).describe('Max uses (0 = unlimited)'),
    temporary: z.boolean().optional().default(false).describe('Grant temporary membership'),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.channel_id);
    
    if (!channel) {
      return failure(notFoundError('Channel', input.channel_id));
    }

    if (!('createInvite' in channel)) {
      return failure(forbiddenError('Cannot create invite for this channel type'));
    }

    const invite = await (channel as { createInvite: (opts: object) => Promise<{ code: string; url: string; expiresAt: Date | null; maxUses: number }> }).createInvite({
      maxAge: input.max_age,
      maxUses: input.max_uses,
      temporary: input.temporary,
    });

    return success({
      code: invite.code,
      url: invite.url,
      expiresAt: invite.expiresAt?.toISOString() ?? null,
      maxUses: invite.maxUses,
    });
  }
);

const createGuildTool = createTool(
  'create_guild',
  'Create a new Discord server/guild',
  z.object({
    name: z.string().min(2).max(100).describe('Name of the new guild'),
    icon: z.string().optional().describe('URL or base64 data URI for guild icon'),
  }),
  async (ctx, input) => {
    try {
      const guild = await ctx.client.guilds.create(input.name, {
        icon: input.icon,
      });

      return success(formatGuild(guild));
    } catch (error) {
      return failure(forbiddenError(`Failed to create guild: ${error}`));
    }
  }
);

const deleteGuildTool = createTool(
  'delete_guild',
  'Delete a guild you own',
  z.object({
    guild_id: z.string().describe('Guild ID to delete'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    if (guild.ownerId !== ctx.client.user?.id) {
      return failure(forbiddenError('You do not own this guild'));
    }

    await guild.delete();

    return success({
      guildId,
      name: guild.name,
      message: `Deleted guild: ${guild.name}`,
    });
  }
);

export const guildTools = {
  name: 'guilds',
  tools: [
    listGuildsTool,
    getGuildInfoTool,
    getGuildMembersTool,
    changeNicknameTool,
    leaveGuildTool,
    createInviteTool,
    createGuildTool,
    deleteGuildTool,
  ],
};

registerToolGroup(guildTools);
