import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { forbiddenError, notFoundError, validationError } from '../../core/errors/index.js';
import { parseChannelInput } from '../../core/resolvers/index.js';
import { getLogger } from '../../core/logger.js';

interface SlashResponse {
  id: string;
  content?: string;
  embeds?: Array<{ title?: string; description?: string; fields?: Array<{ name: string; value: string }> }>;
  components?: unknown[];
  flags?: { has: (flag: string) => boolean };
  isMessage?: boolean;
}

async function waitForBotResponse(
  client: import('discord.js-selfbot-v13').Client,
  initialResponse: SlashResponse,
  timeoutMs: number = 30000
): Promise<SlashResponse> {
  if (!initialResponse.flags?.has('LOADING')) {
    return initialResponse;
  }
  
  return new Promise((resolve, reject) => {
    let done = false;
    
    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        (client as unknown as { off: (event: string, fn: unknown) => void }).off('messageUpdate', onUpdate);
        reject(new Error('Bot response timeout'));
      }
    }, timeoutMs);
    
    function onUpdate(_oldMsg: unknown, newMsg: unknown) {
      const oldId = _oldMsg && typeof _oldMsg === 'object' && 'id' in _oldMsg ? (_oldMsg as { id: string }).id : null;
      if (oldId === initialResponse.id) {
        if (!done) {
          done = true;
          clearTimeout(timeout);
          (client as unknown as { off: (event: string, fn: unknown) => void }).off('messageUpdate', onUpdate);
          resolve(newMsg as SlashResponse);
        }
      }
    }
    
    (client as unknown as { on: (event: string, fn: unknown) => void }).on('messageUpdate', onUpdate);
  });
}

function formatEmbeds(embeds?: SlashResponse['embeds']): string | undefined {
  if (!embeds?.length) return undefined;
  
  return embeds.map(e => {
    const parts: string[] = [];
    if (e.title) parts.push(`**${e.title}**`);
    if (e.description) parts.push(e.description);
    if (e.fields?.length) {
      parts.push(e.fields.map(f => `${f.name}: ${f.value}`).join('\n'));
    }
    return parts.join('\n');
  }).join('\n---\n');
}

const sendSlashTool = createTool(
  'send_slash',
  'Execute a slash command from a bot. Waits for the bot response and returns it.',
  z.object({
    channel_id: z.string().describe('Channel ID or link where to execute the command'),
    bot_id: z.string().describe('The bot\'s user/application ID'),
    command: z.string().describe('Command name (can include subcommands separated by spaces, e.g. "task import")'),
    args: z.array(z.union([
      z.string(),
      z.number(),
      z.boolean(),
    ])).optional().describe('Command arguments in order'),
    wait_for_response: z.boolean().optional().default(true).describe('Wait for bot to respond (default: true, max 30s)'),
  }),
  async (ctx, input) => {
    const logger = getLogger();
    const channelId = parseChannelInput(input.channel_id);
    const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
    
    if (!channel) {
      return failure(notFoundError('Channel', channelId));
    }
    
    if (!('sendSlash' in channel)) {
      return failure(validationError('Channel does not support slash commands (must be a text channel)'));
    }
    
    const textChannel = channel as import('discord.js-selfbot-v13').TextChannel;
    
    try {
      logger.debug(`Executing slash command: /${input.command}`, { 
        botId: input.bot_id, 
        channelId,
        args: input.args 
      });
      
      const commandParts = input.command.split(' ');
      const args = input.args ?? [];
      
      const response = await (textChannel as unknown as { 
        sendSlash: (botId: string, ...args: (string | number | boolean | undefined)[]) => Promise<SlashResponse> 
      }).sendSlash(input.bot_id, ...commandParts, ...args);
      
      if (!response) {
        return success({ status: 'sent', note: 'Command executed. Check channel for response.' });
      }
      
      if (response.isMessage === false) {
        return success({
          status: 'modal',
          note: 'Command opened a modal. Check Discord to interact with it.',
        });
      }
      
      let finalResponse = response;
      
      if (input.wait_for_response !== false && response.flags?.has('LOADING')) {
        logger.debug('Bot is thinking, waiting for response...');
        try {
          finalResponse = await waitForBotResponse(ctx.client, response, 30000);
        } catch {
          return success({
            status: 'pending',
            message_id: response.id,
            note: 'Bot is still processing. Use get_message to check for response.',
          });
        }
      }
      
      return success({
        status: 'success',
        message_id: finalResponse.id,
        content: finalResponse.content || undefined,
        embeds: formatEmbeds(finalResponse.embeds),
        has_components: (finalResponse.components?.length ?? 0) > 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Slash command failed: ${message}`);
      
      if (message.includes('Unknown application command') || message.includes('APPLICATION_COMMAND_FAILED')) {
        return failure(notFoundError('Slash command', input.command));
      }
      
      if (message.includes('Missing Access') || message.includes('Missing Permissions')) {
        return failure(forbiddenError(`Cannot execute command in this channel: ${message}`));
      }
      
      return failure(forbiddenError(`Failed to execute slash command: ${message}`));
    }
  }
);

export const slashTools = {
  name: 'slash',
  tools: [sendSlashTool],
};

registerToolGroup(slashTools);
