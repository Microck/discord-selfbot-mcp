import { z } from 'zod';
import type { VoiceChannel, StageChannel } from 'discord.js-selfbot-v13';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatVoiceState } from '../../core/formatting/index.js';
import { parseChannelInput, parseGuildInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError, featureDisabledError } from '../../core/errors/index.js';

type VoiceBasedChannel = VoiceChannel | StageChannel;

function isVoiceChannel(channel: unknown): channel is VoiceBasedChannel {
  if (!channel || typeof channel !== 'object') return false;
  const type = (channel as { type: string }).type;
  return type === 'GUILD_VOICE' || type === 'GUILD_STAGE_VOICE';
}

const joinVoiceTool = createTool(
  'join_voice',
  'Join a voice channel',
  z.object({
    channel_id: z.string().describe('Voice channel ID to join'),
    self_mute: z.boolean().optional().default(false),
    self_deaf: z.boolean().optional().default(false),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowVoice) {
      return failure(featureDisabledError('Voice'));
    }

    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isVoiceChannel(channel)) {
      return failure(notFoundError('Voice channel', channelId));
    }

    await (channel as unknown as { join: (opts: { selfMute: boolean; selfDeaf: boolean }) => Promise<void> }).join({
      selfMute: input.self_mute ?? false,
      selfDeaf: input.self_deaf ?? false,
    });

    return success({
      channelId,
      channelName: channel.name,
      selfMute: input.self_mute,
      selfDeaf: input.self_deaf,
      message: `Joined voice channel: ${channel.name}`,
    });
  }
);

const leaveVoiceTool = createTool(
  'leave_voice',
  'Leave current voice channel in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID to leave voice in'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowVoice) {
      return failure(featureDisabledError('Voice'));
    }

    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const voiceState = guild.me?.voice;
    if (!voiceState?.channel) {
      return failure(forbiddenError('Not in a voice channel'));
    }

    await voiceState.disconnect();

    return success({
      guildId,
      message: 'Left voice channel',
    });
  }
);

const setVoiceStateTool = createTool(
  'set_voice_state',
  'Set your voice state (mute/deafen)',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    self_mute: z.boolean().optional().describe('Mute yourself'),
    self_deaf: z.boolean().optional().describe('Deafen yourself'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowVoice) {
      return failure(featureDisabledError('Voice'));
    }

    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const voiceState = guild.me?.voice;
    if (!voiceState?.channel) {
      return failure(forbiddenError('Not in a voice channel'));
    }

    if (input.self_mute !== undefined) {
      await voiceState.setMute(input.self_mute);
    }
    if (input.self_deaf !== undefined) {
      await voiceState.setDeaf(input.self_deaf);
    }

    return success({
      selfMute: voiceState.selfMute,
      selfDeaf: voiceState.selfDeaf,
      message: 'Voice state updated',
    });
  }
);

const getVoiceStateTool = createTool(
  'get_voice_state',
  'Get your current voice state in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowVoice) {
      return failure(featureDisabledError('Voice'));
    }

    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const voiceState = guild.me?.voice;
    if (!voiceState) {
      return success({
        inVoice: false,
        channelId: null,
      });
    }

    return success({
      inVoice: !!voiceState.channel,
      ...formatVoiceState(voiceState),
    });
  }
);

const listVoiceChannelMembersTool = createTool(
  'list_voice_channel_members',
  'List members in a voice channel',
  z.object({
    channel_id: z.string().describe('Voice channel ID'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowVoice) {
      return failure(featureDisabledError('Voice'));
    }

    const channelId = parseChannelInput(input.channel_id);
    const channel = ctx.client.channels.cache.get(channelId);
    
    if (!channel || !isVoiceChannel(channel)) {
      return failure(notFoundError('Voice channel', channelId));
    }

    const members = channel.members.map((m) => ({
      userId: m.user.id,
      username: m.user.username,
      displayName: m.displayName,
      voiceState: m.voice ? formatVoiceState(m.voice) : null,
    }));

    return success({
      channelId,
      channelName: channel.name,
      count: members.length,
      members,
    });
  }
);

export const voiceTools = {
  name: 'voice',
  tools: [
    joinVoiceTool,
    leaveVoiceTool,
    setVoiceStateTool,
    getVoiceStateTool,
    listVoiceChannelMembersTool,
  ],
};

registerToolGroup(voiceTools);
