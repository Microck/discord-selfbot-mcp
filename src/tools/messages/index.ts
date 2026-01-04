import { z } from 'zod';
import type { TextChannel, DMChannel, Message, MessageOptions } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatMessage } from '../../core/formatting/index.js';
import { parseChannelInput, parseMessageInput, parseMessageLink } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError, validationError } from '../../core/errors/index.js';

type TextBasedChannel = TextChannel | DMChannel;

function isTextBasedChannel(channel: unknown): channel is TextBasedChannel {
  return channel !== null && typeof channel === 'object' && 'send' in channel && 'messages' in channel;
}

const readMessagesTool = createTool(
  'read_messages',
  'Read messages from a channel',
  z.object({
    channel_id: z.string().describe('Channel ID or link'),
    limit: z.number().min(1).max(100).optional().default(50),
    before: z.string().optional().describe('Get messages before this message ID'),
    after: z.string().optional().describe('Get messages after this message ID'),
    around: z.string().optional().describe('Get messages around this message ID'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const options: { limit: number; before?: string; after?: string; around?: string } = {
      limit: input.limit ?? 50,
    };
    if (input.before) options.before = input.before;
    if (input.after) options.after = input.after;
    if (input.around) options.around = input.around;

    const messages = await channel.messages.fetch(options);
    
    return success({
      count: messages.size,
      messages: messages.map((m) => formatMessage(m)),
    });
  }
);

const sendMessageTool = createTool(
  'send_message',
  'Send a message to a channel',
  z.object({
    channel_id: z.string().describe('Channel ID or link'),
    content: z.string().min(1).max(2000).describe('Message content'),
    tts: z.boolean().optional().default(false).describe('Text-to-speech'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const message = await channel.send({
      content: input.content,
      tts: input.tts,
    } as MessageOptions);

    return success(formatMessage(message));
  }
);

const replyMessageTool = createTool(
  'reply_message',
  'Reply to a specific message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to reply to'),
    content: z.string().min(1).max(2000).describe('Reply content'),
    mention: z.boolean().optional().default(true).describe('Mention the author'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const messageId = parseMessageInput(input.message_id);
    const targetMessage = await channel.messages.fetch(messageId);
    
    if (!targetMessage) {
      return failure(notFoundError('Message', messageId));
    }

    const reply = await targetMessage.reply({
      content: input.content,
      allowedMentions: { repliedUser: input.mention ?? true },
    });

    return success(formatMessage(reply));
  }
);

const editMessageTool = createTool(
  'edit_message',
  'Edit a message you sent',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to edit'),
    content: z.string().min(1).max(2000).describe('New message content'),
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

    if (message.author.id !== ctx.client.user?.id) {
      return failure(forbiddenError('Can only edit your own messages'));
    }

    const edited = await message.edit(input.content);
    return success(formatMessage(edited));
  }
);

const deleteMessageTool = createTool(
  'delete_message',
  'Delete a message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID to delete'),
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

    await message.delete();
    
    return success({
      messageId,
      channelId,
      message: 'Message deleted',
    });
  }
);

const searchMessagesTool = createTool(
  'search_messages',
  'Search messages in a guild or channel',
  z.object({
    guild_id: z.string().optional().describe('Guild ID to search in'),
    channel_id: z.string().optional().describe('Channel ID to search in'),
    content: z.string().optional().describe('Text content to search'),
    author_id: z.string().optional().describe('Author user ID'),
    mentions: z.string().optional().describe('User ID mentioned'),
    has: z.enum(['link', 'embed', 'file', 'video', 'image', 'sound', 'sticker']).optional(),
    limit: z.number().min(1).max(100).optional().default(25),
  }),
  async (ctx, input) => {
    if (!input.guild_id && !input.channel_id) {
      return failure(validationError('Either guild_id or channel_id is required'));
    }

    let searchable: { search: (options: Record<string, unknown>) => Promise<{ messages: Message[][] }> } | undefined;

    if (input.guild_id) {
      const guild = ctx.client.guilds.cache.get(input.guild_id);
      if (!guild) {
        return failure(notFoundError('Guild', input.guild_id));
      }
      searchable = guild as unknown as typeof searchable;
    } else if (input.channel_id) {
      const channelId = parseChannelInput(input.channel_id);
      const channel = ctx.client.channels.cache.get(channelId);
      if (!channel || !isTextBasedChannel(channel)) {
        return failure(notFoundError('Text channel', channelId));
      }
      searchable = channel as unknown as typeof searchable;
    }

    if (!searchable || !('search' in searchable)) {
      return failure(forbiddenError('Search not available'));
    }

    const searchOptions: Record<string, unknown> = { limit: input.limit };
    if (input.content) searchOptions.content = input.content;
    if (input.author_id) searchOptions.authorId = input.author_id;
    if (input.mentions) searchOptions.mentions = input.mentions;
    if (input.has) searchOptions.has = input.has;
    if (input.channel_id && input.guild_id) searchOptions.channelId = parseChannelInput(input.channel_id);

    const results = await searchable.search(searchOptions);
    const messages = results.messages.flat();

    return success({
      count: messages.length,
      messages: messages.map((m) => formatMessage(m)),
    });
  }
);

const getMessageTool = createTool(
  'get_message',
  'Get a specific message by ID or link',
  z.object({
    channel_id: z.string().optional().describe('Channel ID (not needed if using message link)'),
    message_id: z.string().describe('Message ID or full message link'),
  }),
  async (ctx, input) => {
    let channelId: string;
    let messageId: string;

    const linkParsed = parseMessageLink(input.message_id);
    if (linkParsed) {
      channelId = linkParsed.channelId;
      messageId = linkParsed.messageId;
    } else {
      if (!input.channel_id) {
        return failure(validationError('channel_id required when not using message link'));
      }
      channelId = parseChannelInput(input.channel_id);
      messageId = parseMessageInput(input.message_id);
    }

    const channel = ctx.client.channels.cache.get(channelId);
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const message = await channel.messages.fetch(messageId);
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }

    return success(formatMessage(message));
  }
);

const forwardMessageTool = createTool(
  'forward_message',
  'Forward a message to another channel',
  z.object({
    source_channel_id: z.string().describe('Source channel ID'),
    message_id: z.string().describe('Message ID to forward'),
    target_channel_id: z.string().describe('Target channel ID'),
    include_embeds: z.boolean().optional().default(true),
  }),
  async (ctx, input) => {
    const sourceChannelId = parseChannelInput(input.source_channel_id);
    const sourceChannel = ctx.client.channels.cache.get(sourceChannelId);
    
    if (!sourceChannel || !isTextBasedChannel(sourceChannel)) {
      return failure(notFoundError('Source channel', sourceChannelId));
    }

    const targetChannelId = parseChannelInput(input.target_channel_id);
    const targetChannel = ctx.client.channels.cache.get(targetChannelId);
    
    if (!targetChannel || !isTextBasedChannel(targetChannel)) {
      return failure(notFoundError('Target channel', targetChannelId));
    }

    const messageId = parseMessageInput(input.message_id);
    const message = await sourceChannel.messages.fetch(messageId);
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }

    const forwardContent = `**Forwarded from <#${sourceChannelId}>**\n${message.content}`;
    
    const forwarded = await targetChannel.send({
      content: forwardContent.slice(0, 2000),
      embeds: input.include_embeds ? message.embeds : [],
    } as MessageOptions);

    return success({
      originalMessage: formatMessage(message),
      forwardedMessage: formatMessage(forwarded),
    });
  }
);

export const messageTools = {
  name: 'messages',
  tools: [
    readMessagesTool,
    sendMessageTool,
    replyMessageTool,
    editMessageTool,
    deleteMessageTool,
    searchMessagesTool,
    getMessageTool,
    forwardMessageTool,
  ],
};

registerToolGroup(messageTools);
