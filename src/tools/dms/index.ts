import { z } from 'zod';
import type { DMChannel, MessageOptions } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatMessage, formatUser, formatChannel } from '../../core/formatting/index.js';
import { parseUserInput } from '../../core/resolvers/index.js';
import { notFoundError, featureDisabledError } from '../../core/errors/index.js';

const listDmsTool = createTool(
  'list_dms',
  'List all open DM channels',
  z.object({
    limit: z.number().min(1).max(100).optional().default(50),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowDMs) {
      return failure(featureDisabledError('DMs'));
    }

    const dmChannels = ctx.client.channels.cache
      .filter((c) => c.type === 'DM')
      .map((c) => {
        const dm = c as DMChannel;
        return {
          ...formatChannel(dm),
          recipient: dm.recipient ? formatUser(dm.recipient) : null,
          lastMessageId: dm.lastMessageId,
        };
      })
      .slice(0, input.limit);

    return success({
      count: dmChannels.length,
      channels: dmChannels,
    });
  }
);

const readDmTool = createTool(
  'read_dm',
  'Read messages from a DM channel with a user',
  z.object({
    user_id: z.string().describe('User ID to read DMs with'),
    limit: z.number().min(1).max(100).optional().default(50),
    before: z.string().optional(),
    after: z.string().optional(),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowDMs) {
      return failure(featureDisabledError('DMs'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    const dmChannel = await user.createDM();
    
    const options: { limit: number; before?: string; after?: string } = {
      limit: input.limit ?? 50,
    };
    if (input.before) options.before = input.before;
    if (input.after) options.after = input.after;

    const messages = await dmChannel.messages.fetch(options);

    return success({
      user: formatUser(user),
      count: messages.size,
      messages: messages.map((m) => formatMessage(m)),
    });
  }
);

const sendDmTool = createTool(
  'send_dm',
  'Send a direct message to a user',
  z.object({
    user_id: z.string().describe('User ID to send DM to'),
    content: z.string().min(1).max(2000).describe('Message content'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowDMs) {
      return failure(featureDisabledError('DMs'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    const message = await user.send({
      content: input.content,
    } as MessageOptions);

    return success({
      recipient: formatUser(user),
      message: formatMessage(message),
    });
  }
);

const createDmChannelTool = createTool(
  'create_dm_channel',
  'Open a DM channel with a user (without sending a message)',
  z.object({
    user_id: z.string().describe('User ID'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowDMs) {
      return failure(featureDisabledError('DMs'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    const dmChannel = await user.createDM();

    return success({
      channelId: dmChannel.id,
      recipient: formatUser(user),
    });
  }
);

const closeDmTool = createTool(
  'close_dm',
  'Close/hide a DM channel',
  z.object({
    channel_id: z.string().describe('DM channel ID to close'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowDMs) {
      return failure(featureDisabledError('DMs'));
    }

    const channel = ctx.client.channels.cache.get(input.channel_id);
    
    if (!channel || channel.type !== 'DM') {
      return failure(notFoundError('DM channel', input.channel_id));
    }

    await (channel as DMChannel).delete();

    return success({
      channelId: input.channel_id,
      message: 'DM channel closed',
    });
  }
);

export const dmTools = {
  name: 'dms',
  tools: [
    listDmsTool,
    readDmTool,
    sendDmTool,
    createDmChannelTool,
    closeDmTool,
  ],
};

registerToolGroup(dmTools);
