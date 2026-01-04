import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import type { TextChannel, DMChannel, MessageAttachment, MessageOptions } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatMessage, formatAttachment } from '../../core/formatting/index.js';
import { parseChannelInput, parseMessageInput } from '../../core/resolvers/index.js';
import { notFoundError, validationError } from '../../core/errors/index.js';

type TextBasedChannel = TextChannel | DMChannel;

function isTextBasedChannel(channel: unknown): channel is TextBasedChannel {
  return channel !== null && typeof channel === 'object' && 'send' in channel;
}

const uploadFileTool = createTool(
  'upload_file',
  'Upload a file to a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    file_path: z.string().describe('Local file path to upload'),
    content: z.string().max(2000).optional().describe('Message content to accompany the file'),
    spoiler: z.boolean().optional().default(false).describe('Mark as spoiler'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isTextBasedChannel(channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    if (!fs.existsSync(input.file_path)) {
      return failure(validationError(`File not found: ${input.file_path}`));
    }

    const stats = fs.statSync(input.file_path);
    const maxSize = 25 * 1024 * 1024;
    if (stats.size > maxSize) {
      return failure(validationError(`File too large. Max size is 25MB, got ${(stats.size / 1024 / 1024).toFixed(2)}MB`));
    }

    const fileName = path.basename(input.file_path);
    const attachment = {
      attachment: input.file_path,
      name: input.spoiler ? `SPOILER_${fileName}` : fileName,
    };

    const message = await channel.send({
      content: input.content,
      files: [attachment],
    } as MessageOptions);

    return success(formatMessage(message));
  }
);

const downloadAttachmentTool = createTool(
  'download_attachment',
  'Download an attachment from a message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
    attachment_index: z.number().min(0).optional().default(0).describe('Index of attachment (0 for first)'),
    save_path: z.string().describe('Local path to save the file'),
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

    const attachments = [...message.attachments.values()];
    const index = input.attachment_index ?? 0;
    
    if (index >= attachments.length) {
      return failure(validationError(`Attachment index ${index} out of range. Message has ${attachments.length} attachments.`));
    }

    const attachment = attachments[index];
    
    const response = await fetch(attachment.url);
    const buffer = Buffer.from(await response.arrayBuffer());
    
    const dir = path.dirname(input.save_path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(input.save_path, buffer);

    return success({
      savedTo: input.save_path,
      filename: attachment.name,
      size: attachment.size,
      contentType: attachment.contentType,
    });
  }
);

const listAttachmentsTool = createTool(
  'list_attachments',
  'List attachments in a message',
  z.object({
    channel_id: z.string().describe('Channel ID'),
    message_id: z.string().describe('Message ID'),
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

    const attachments = message.attachments.map((a, index) => ({
      index,
      ...formatAttachment(a),
    }));

    return success({
      count: attachments.length,
      attachments,
    });
  }
);

export const fileTools = {
  name: 'files',
  tools: [
    uploadFileTool,
    downloadAttachmentTool,
    listAttachmentsTool,
  ],
};

registerToolGroup(fileTools);
