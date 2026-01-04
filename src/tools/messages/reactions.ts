import { z } from 'zod';
import type { TextChannel, DMChannel } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { parseChannelInput, parseMessageInput } from '../../core/resolvers/index.js';
import { notFoundError } from '../../core/errors/index.js';

type TextBasedChannel = TextChannel | DMChannel;

function isTextBasedChannel(channel: unknown): channel is TextBasedChannel {
  return channel !== null && typeof channel === 'object' && 'messages' in channel;
}

const reactTool = createTool(
  'react',
  'Add a reaction to a message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    emoji: z.string().describe('Emoji to react with (Unicode emoji or custom emoji format)'),
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

    await message.react(input.emoji);

    return success({
      messageId,
      emoji: input.emoji,
      message: `Reacted with ${input.emoji}`,
    });
  }
);

const unreactTool = createTool(
  'unreact',
  'Remove your reaction from a message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    emoji: z.string().describe('Emoji to remove'),
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

    const reaction = message.reactions.cache.find(
      (r) => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji
    );

    if (reaction) {
      await reaction.users.remove(ctx.client.user!.id);
    }

    return success({
      messageId,
      emoji: input.emoji,
      message: `Removed reaction ${input.emoji}`,
    });
  }
);

const getReactionsTool = createTool(
  'get_reactions',
  'Get users who reacted to a message with a specific emoji',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    emoji: z.string().describe('Emoji to get reactions for'),
    limit: z.number().min(1).max(100).optional().default(50),
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

    const reaction = message.reactions.cache.find(
      (r) => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji
    );

    if (!reaction) {
      return success({
        emoji: input.emoji,
        count: 0,
        users: [],
      });
    }

    const users = await reaction.users.fetch({ limit: input.limit });

    return success({
      emoji: input.emoji,
      count: reaction.count,
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.globalName ?? null,
      })),
    });
  }
);

const removeAllReactionsTool = createTool(
  'remove_all_reactions',
  'Remove all reactions from a message (requires permission)',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    emoji: z.string().optional().describe('Specific emoji to remove all of (omit for all reactions)'),
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

    if (input.emoji) {
      await message.reactions.cache.find(
        (r) => r.emoji.name === input.emoji || r.emoji.toString() === input.emoji
      )?.remove();
      return success({ message: `Removed all ${input.emoji} reactions` });
    } else {
      await message.reactions.removeAll();
      return success({ message: 'Removed all reactions' });
    }
  }
);

export const reactionTools = {
  name: 'reactions',
  tools: [
    reactTool,
    unreactTool,
    getReactionsTool,
    removeAllReactionsTool,
  ],
};

registerToolGroup(reactionTools);
