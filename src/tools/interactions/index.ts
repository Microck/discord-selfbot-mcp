import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { parseChannelInput } from '../../core/resolvers/index.js';
import { notFoundError } from '../../core/errors/index.js';

const sendTypingTool = createTool(
  'trigger_typing',
  'Trigger the "typing..." indicator in a channel',
  z.object({
    channel_id: z.string().describe('Channel ID'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !('sendTyping' in channel)) {
      return failure(notFoundError('Text channel', channelId));
    }

    await (channel as unknown as { sendTyping: () => Promise<void> }).sendTyping();

    return success({
      channelId,
      message: 'Typing indicator triggered',
    });
  }
);

export const interactionTools = {
  name: 'interactions',
  tools: [sendTypingTool],
};

registerToolGroup(interactionTools);
