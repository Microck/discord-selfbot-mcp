import { z } from 'zod';
import type { TextChannel, ThreadChannel, MessageOptions } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatThread, formatMessage } from '../../core/formatting/index.js';
import { parseChannelInput, parseMessageInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError } from '../../core/errors/index.js';

const listThreadsTool = createTool(
  'list_threads',
  'List threads in a channel or guild',
  z.object({
    channel_id: z.string().optional().describe('Channel ID to list threads from'),
    guild_id: z.string().optional().describe('Guild ID to list all threads'),
    archived: z.boolean().optional().default(false).describe('Include archived threads'),
  }),
  async (ctx, input) => {
    if (input.guild_id) {
      const guild = ctx.client.guilds.cache.get(input.guild_id);
      if (!guild) {
        return failure(notFoundError('Guild', input.guild_id));
      }

      const active = await (guild.channels as unknown as { fetchActiveThreads: () => Promise<{ threads: Map<string, ThreadChannel> }> }).fetchActiveThreads();
      let threads = [...active.threads.values()];

      if (input.archived) {
        const textChannels = guild.channels.cache.filter((c) => c.type === 'GUILD_TEXT');
        for (const [, channel] of textChannels) {
          const archived = await (channel as TextChannel).threads.fetchArchived();
          threads = threads.concat([...archived.threads.values()]);
        }
      }

      return success({
        count: threads.length,
        threads: threads.map((t) => formatThread(t)),
      });
    }

    if (input.channel_id) {
      const channelId = parseChannelInput(input.channel_id);
      const channel = ctx.client.channels.cache.get(channelId);
      
      if (!channel || !('threads' in channel)) {
        return failure(notFoundError('Text channel', channelId));
      }

      const textChannel = channel as TextChannel;
      let threads = [...textChannel.threads.cache.values()];

      if (input.archived) {
        const archived = await textChannel.threads.fetchArchived();
        threads = threads.concat([...archived.threads.values()]);
      }

      return success({
        count: threads.length,
        threads: threads.map((t) => formatThread(t)),
      });
    }

    return failure(forbiddenError('Either channel_id or guild_id is required'));
  }
);

const createThreadTool = createTool(
  'create_thread',
  'Create a new thread in a channel',
  z.object({
    channel_id: z.string().describe('Channel ID to create thread in'),
    name: z.string().min(1).max(100).describe('Thread name'),
    message_id: z.string().optional().describe('Message ID to create thread from (optional)'),
    auto_archive_duration: z.enum(['60', '1440', '4320', '10080']).optional().default('1440').describe('Auto archive duration in minutes'),
    private: z.boolean().optional().default(false).describe('Create private thread'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !('threads' in channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    const textChannel = channel as TextChannel;
    const archiveDuration = parseInt(input.auto_archive_duration ?? '1440', 10) as 60 | 1440 | 4320 | 10080;

    let thread: ThreadChannel;

    if (input.message_id) {
      const messageId = parseMessageInput(input.message_id);
      const message = await textChannel.messages.fetch(messageId);
      if (!message) {
        return failure(notFoundError('Message', messageId));
      }
      thread = await message.startThread({
        name: input.name,
        autoArchiveDuration: archiveDuration,
      });
    } else {
      thread = await textChannel.threads.create({
        name: input.name,
        autoArchiveDuration: archiveDuration,
        type: input.private ? 'GUILD_PRIVATE_THREAD' : 'GUILD_PUBLIC_THREAD',
      });
    }

    return success(formatThread(thread));
  }
);

const joinThreadTool = createTool(
  'join_thread',
  'Join a thread',
  z.object({
    thread_id: z.string().describe('Thread ID to join'),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.thread_id);
    
    if (!channel || !channel.isThread()) {
      return failure(notFoundError('Thread', input.thread_id));
    }

    await channel.join();

    return success({
      threadId: input.thread_id,
      message: 'Joined thread',
    });
  }
);

const leaveThreadTool = createTool(
  'leave_thread',
  'Leave a thread',
  z.object({
    thread_id: z.string().describe('Thread ID to leave'),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.thread_id);
    
    if (!channel || !channel.isThread()) {
      return failure(notFoundError('Thread', input.thread_id));
    }

    await channel.leave();

    return success({
      threadId: input.thread_id,
      message: 'Left thread',
    });
  }
);

const archiveThreadTool = createTool(
  'archive_thread',
  'Archive or unarchive a thread',
  z.object({
    thread_id: z.string().describe('Thread ID'),
    archived: z.boolean().default(true).describe('Archive (true) or unarchive (false)'),
    locked: z.boolean().optional().describe('Lock thread (prevents unarchiving by non-moderators)'),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.thread_id);
    
    if (!channel || !channel.isThread()) {
      return failure(notFoundError('Thread', input.thread_id));
    }

    await channel.setArchived(input.archived);
    if (input.locked !== undefined) {
      await channel.setLocked(input.locked);
    }

    return success({
      threadId: input.thread_id,
      archived: input.archived,
      locked: input.locked ?? channel.locked,
      message: input.archived ? 'Thread archived' : 'Thread unarchived',
    });
  }
);

const readThreadTool = createTool(
  'read_thread',
  'Read messages from a thread',
  z.object({
    thread_id: z.string().describe('Thread ID'),
    limit: z.number().min(1).max(100).optional().default(50),
    before: z.string().optional(),
    after: z.string().optional(),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.thread_id);
    
    if (!channel || !channel.isThread()) {
      return failure(notFoundError('Thread', input.thread_id));
    }

    const options: { limit: number; before?: string; after?: string } = {
      limit: input.limit ?? 50,
    };
    if (input.before) options.before = input.before;
    if (input.after) options.after = input.after;

    const messages = await channel.messages.fetch(options);

    return success({
      thread: formatThread(channel),
      count: messages.size,
      messages: messages.map((m) => formatMessage(m)),
    });
  }
);

const sendToThreadTool = createTool(
  'send_to_thread',
  'Send a message to a thread',
  z.object({
    thread_id: z.string().describe('Thread ID'),
    content: z.string().min(1).max(2000).describe('Message content'),
  }),
  async (ctx, input) => {
    const channel = ctx.client.channels.cache.get(input.thread_id);
    
    if (!channel || !channel.isThread()) {
      return failure(notFoundError('Thread', input.thread_id));
    }

    const message = await channel.send({
      content: input.content,
    } as MessageOptions);

    return success(formatMessage(message));
  }
);

export const threadTools = {
  name: 'threads',
  tools: [
    listThreadsTool,
    createThreadTool,
    joinThreadTool,
    leaveThreadTool,
    archiveThreadTool,
    readThreadTool,
    sendToThreadTool,
  ],
};

registerToolGroup(threadTools);
