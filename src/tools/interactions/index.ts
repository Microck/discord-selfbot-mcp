import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { parseChannelInput, parseMessageInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError, validationError } from '../../core/errors/index.js';
import { getLogger } from '../../core/logger.js';

interface MessageWithComponents {
  id: string;
  content: string;
  components: Array<{
    type: string;
    components: Array<{
      type: string;
      customId?: string;
      label?: string;
      disabled?: boolean;
      style?: number;
      options?: Array<{ label: string; value: string; description?: string }>;
    }>;
  }>;
  clickButton: (buttonId: string) => Promise<unknown>;
  selectMenu: (menuId: string | number, values: string[]) => Promise<unknown>;
}

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

const clickButtonTool = createTool(
  'click_button',
  'Click a button on a message. Use custom_id or button index (row,col format like "0,0" for first button).',
  z.object({
    channel_id: z.string().describe('Channel ID where the message is'),
    message_id: z.string().describe('Message ID containing the button'),
    button_id: z.string().describe('Button custom_id or position as "row,col" (e.g. "0,0" for first button)'),
  }),
  async (ctx, input) => {
    const logger = getLogger();
    const channelId = parseChannelInput(input.channel_id);
    const messageId = parseMessageInput(input.message_id);
    
    const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !('messages' in channel)) {
      return failure(notFoundError('Text channel', channelId));
    }
    
    const textChannel = channel as import('discord.js-selfbot-v13').TextChannel;
    const message = await textChannel.messages.fetch(messageId).catch(() => null) as MessageWithComponents | null;
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }
    
    if (!message.components?.length) {
      return failure(validationError('Message has no components/buttons'));
    }
    
    let buttonId = input.button_id;
    
    if (/^\d+,\d+$/.test(input.button_id)) {
      const [row, col] = input.button_id.split(',').map(Number);
      const component = message.components[row]?.components[col];
      if (!component?.customId) {
        return failure(notFoundError('Button', `at position ${input.button_id}`));
      }
      buttonId = component.customId;
    }
    
    try {
      logger.debug(`Clicking button: ${buttonId}`, { messageId, channelId });
      const response = await message.clickButton(buttonId);
      
      if (response && typeof response === 'object') {
        const resp = response as { isMessage?: boolean; id?: string; content?: string; components?: unknown[] };
        
        if (resp.isMessage === false) {
          return success({
            status: 'modal',
            note: 'Button opened a modal. Use get_message to see updates or interact with modal.',
          });
        }
        
        return success({
          status: 'success',
          message_id: resp.id,
          content: resp.content,
          has_components: (resp.components?.length ?? 0) > 0,
        });
      }
      
      return success({ status: 'clicked', note: 'Button clicked. Check channel for response.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('BUTTON_NOT_FOUND')) {
        return failure(notFoundError('Button', buttonId));
      }
      if (message.includes('BUTTON_CANNOT_CLICK') || message.includes('disabled')) {
        return failure(forbiddenError('Button is disabled'));
      }
      
      return failure(forbiddenError(`Failed to click button: ${message}`));
    }
  }
);

const selectMenuTool = createTool(
  'select_menu',
  'Select options from a dropdown/select menu on a message.',
  z.object({
    channel_id: z.string().describe('Channel ID where the message is'),
    message_id: z.string().describe('Message ID containing the select menu'),
    menu_id: z.string().describe('Menu custom_id or index (0 for first menu)'),
    values: z.array(z.string()).describe('Values to select (use option values, not labels)'),
  }),
  async (ctx, input) => {
    const logger = getLogger();
    const channelId = parseChannelInput(input.channel_id);
    const messageId = parseMessageInput(input.message_id);
    
    const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !('messages' in channel)) {
      return failure(notFoundError('Text channel', channelId));
    }
    
    const textChannel = channel as import('discord.js-selfbot-v13').TextChannel;
    const message = await textChannel.messages.fetch(messageId).catch(() => null) as MessageWithComponents | null;
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }
    
    if (!message.components?.length) {
      return failure(validationError('Message has no components'));
    }
    
    const menuId = /^\d+$/.test(input.menu_id) ? parseInt(input.menu_id, 10) : input.menu_id;
    
    try {
      logger.debug(`Selecting menu options: ${input.values.join(', ')}`, { messageId, menuId });
      const response = await message.selectMenu(menuId, input.values);
      
      if (response && typeof response === 'object') {
        const resp = response as { isMessage?: boolean; id?: string; content?: string };
        
        if (resp.isMessage === false) {
          return success({
            status: 'modal',
            note: 'Selection opened a modal.',
          });
        }
        
        return success({
          status: 'success',
          message_id: resp.id,
          content: resp.content,
        });
      }
      
      return success({ status: 'selected', note: 'Menu selection made. Check channel for response.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failure(forbiddenError(`Failed to select menu: ${message}`));
    }
  }
);

const getComponentsTool = createTool(
  'get_components',
  'Get all buttons and select menus from a message. Useful for discovering button IDs before clicking.',
  z.object({
    channel_id: z.string().describe('Channel ID where the message is'),
    message_id: z.string().describe('Message ID to inspect'),
  }),
  async (ctx, input) => {
    const channelId = parseChannelInput(input.channel_id);
    const messageId = parseMessageInput(input.message_id);
    
    const channel = await ctx.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !('messages' in channel)) {
      return failure(notFoundError('Text channel', channelId));
    }
    
    const textChannel = channel as import('discord.js-selfbot-v13').TextChannel;
    const message = await textChannel.messages.fetch(messageId).catch(() => null) as MessageWithComponents | null;
    
    if (!message) {
      return failure(notFoundError('Message', messageId));
    }
    
    const components: Array<{
      row: number;
      type: string;
      components: Array<{
        col: number;
        type: string;
        custom_id?: string;
        label?: string;
        disabled?: boolean;
        style?: number;
        options?: Array<{ label: string; value: string; description?: string }>;
      }>;
    }> = [];
    
    message.components?.forEach((row, rowIndex) => {
      const rowData = {
        row: rowIndex,
        type: row.type,
        components: row.components.map((comp, colIndex) => ({
          col: colIndex,
          type: comp.type,
          custom_id: comp.customId,
          label: comp.label,
          disabled: comp.disabled,
          style: comp.style,
          options: comp.options,
        })),
      };
      components.push(rowData);
    });
    
    return success({
      message_id: messageId,
      content: message.content,
      components,
      total_buttons: components.flatMap(r => r.components).filter(c => c.type === 'BUTTON').length,
      total_menus: components.flatMap(r => r.components).filter(c => c.type?.includes('SELECT')).length,
    });
  }
);

export const interactionTools = {
  name: 'interactions',
  tools: [sendTypingTool, clickButtonTool, selectMenuTool, getComponentsTool],
};

registerToolGroup(interactionTools);
