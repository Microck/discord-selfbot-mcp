import { z } from 'zod';
import type { TextChannel, DMChannel } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatMessage } from '../../core/formatting/index.js';
import { parseChannelInput, parseMessageInput } from '../../core/resolvers/index.js';
import { notFoundError } from '../../core/errors/index.js';

type TextBasedChannel = TextChannel | DMChannel;

function isTextBasedChannel(channel: unknown): channel is TextBasedChannel {
  return channel !== null && typeof channel === 'object' && 'messages' in channel;
}

const pinMessageTool = createTool(
  'pin_message',
  'Pin a message in a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to pin'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const messageId = parseMessageInput(input.message_id);
    const message = await channel.messages.fetch(messageId);
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }

    await message.pin();

    return success({
      messageId,
      channelId,
      message: 'Message pinned',
    });
  }
);

const unpinMessageTool = createTool(
  'unpin_message',
  'Unpin a message in a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to unpin'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const messageId = parseMessageInput(input.message_id);
    const message = await channel.messages.fetch(messageId);
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }

    await message.unpin();

    return success({
      messageId,
      channelId,
      message: 'Message unpinned',
    });
  }
);

const listPinnedMessagesTool = createTool(
  'list_pinned_messages',
  'List all pinned messages in a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const pinned = await channel.messages.fetchPinned();

    return success({
      count: pinned.size,
      messages: pinned.map((m) => formatMessage(m)),
    });
  }
);

export const pinTools = {
  name: 'pins',
  tools: [
    pinMessageTool,
    unpinMessageTool,
    listPinnedMessagesTool,
  ],
};

registerToolGroup(pinTools);
