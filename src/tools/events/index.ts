import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { parseGuildInput } from '../../core/resolvers/index.js';
import { notFoundError, forbiddenError } from '../../core/errors/index.js';

const listEventsTool = createTool(
  'list_events',
  'List scheduled events in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    with_user_count: z.boolean().optional().default(false),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const events = await guild.scheduledEvents.fetch({ withUserCount: input.with_user_count });

    return success({
      count: events.size,
      events: events.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        scheduledStartTime: e.scheduledStartAt?.toISOString() ?? null,
        scheduledEndTime: e.scheduledEndAt?.toISOString() ?? null,
        status: e.status,
        entityType: e.entityType,
        channelId: e.channelId,
        creatorId: e.creatorId,
        userCount: e.userCount ?? null,
        location: e.entityMetadata?.location ?? null,
        coverImageUrl: e.coverImageURL() ?? null,
      })),
    });
  }
);

const getEventTool = createTool(
  'get_event',
  'Get details of a specific scheduled event',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    event_id: z.string().describe('Event ID'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const event = await guild.scheduledEvents.fetch(input.event_id);
    
    if (!event) {
      return failure(notFoundError('Event', input.event_id));
    }

    const subscribers = await event.fetchSubscribers({ limit: 100 });

    return success({
      id: event.id,
      name: event.name,
      description: event.description,
      scheduledStartTime: event.scheduledStartAt?.toISOString() ?? null,
      scheduledEndTime: event.scheduledEndAt?.toISOString() ?? null,
      status: event.status,
      entityType: event.entityType,
      channelId: event.channelId,
      creatorId: event.creatorId,
      location: event.entityMetadata?.location ?? null,
      coverImageUrl: event.coverImageURL() ?? null,
      subscribers: subscribers.map((s) => ({
        id: s.user.id,
        username: s.user.username,
      })),
    });
  }
);

const rsvpEventTool = createTool(
  'rsvp_event',
  'Mark yourself as interested in an event',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    event_id: z.string().describe('Event ID'),
    interested: z.boolean().default(true).describe('Set interested (true) or remove (false)'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    const event = await guild.scheduledEvents.fetch(input.event_id);
    
    if (!event) {
      return failure(notFoundError('Event', input.event_id));
    }

    if (input.interested) {
      await (event as unknown as { setInterested: () => Promise<void> }).setInterested();
    } else {
      await (event as unknown as { setUninterested: () => Promise<void> }).setUninterested();
    }

    return success({
      eventId: input.event_id,
      eventName: event.name,
      interested: input.interested,
      message: input.interested ? 'Marked as interested' : 'Removed interest',
    });
  }
);

const createEventTool = createTool(
  'create_event',
  'Create a scheduled event in a guild',
  z.object({
    guild_id: z.string().describe('Guild ID'),
    name: z.string().min(1).max(100).describe('Event name'),
    description: z.string().max(1000).optional(),
    scheduled_start_time: z.string().describe('ISO 8601 timestamp for start time'),
    scheduled_end_time: z.string().optional().describe('ISO 8601 timestamp for end time'),
    channel_id: z.string().optional().describe('Voice/Stage channel ID for voice events'),
    location: z.string().max(100).optional().describe('Location for external events'),
    entity_type: z.enum(['STAGE_INSTANCE', 'VOICE', 'EXTERNAL']).default('EXTERNAL'),
    cover_image: z.string().optional().describe('URL of cover image'),
  }),
  async (ctx, input) => {
    const guildId = parseGuildInput(input.guild_id);
    const guild = ctx.client.guilds.cache.get(guildId);
    
    if (!guild) {
      return failure(notFoundError('Guild', guildId));
    }

    if (input.entity_type === 'EXTERNAL' && !input.location) {
      return failure(forbiddenError('External events require a location'));
    }

    if ((input.entity_type === 'VOICE' || input.entity_type === 'STAGE_INSTANCE') && !input.channel_id) {
      return failure(forbiddenError('Voice/Stage events require a channel_id'));
    }

    const entityMetadata = input.entity_type === 'EXTERNAL' ? { location: input.location } : undefined;

    const event = await guild.scheduledEvents.create({
      name: input.name,
      description: input.description,
      scheduledStartTime: new Date(input.scheduled_start_time),
      scheduledEndTime: input.scheduled_end_time ? new Date(input.scheduled_end_time) : undefined,
      channel: input.channel_id,
      entityType: input.entity_type ?? 'EXTERNAL',
      entityMetadata,
      privacyLevel: 'GUILD_ONLY',
      image: input.cover_image,
    });

    return success({
      id: event.id,
      name: event.name,
      scheduledStartTime: event.scheduledStartAt?.toISOString() ?? null,
      message: `Event created: ${event.name}`,
    });
  }
);

export const eventTools = {
  name: 'events',
  tools: [
    listEventsTool,
    getEventTool,
    rsvpEventTool,
    createEventTool,
  ],
};

registerToolGroup(eventTools);
