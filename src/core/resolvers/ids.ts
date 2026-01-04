import { validationError, type McpError } from '../errors/index.js';

const SNOWFLAKE_REGEX = /^\d{17,19}$/;
const CHANNEL_LINK_REGEX = /discord\.com\/channels\/(\d{17,19}|@me)\/(\d{17,19})(?:\/(\d{17,19}))?/;
const MESSAGE_LINK_REGEX = /discord\.com\/channels\/(\d{17,19}|@me)\/(\d{17,19})\/(\d{17,19})/;
const USER_MENTION_REGEX = /<@!?(\d{17,19})>/;
const CHANNEL_MENTION_REGEX = /<#(\d{17,19})>/;

export interface ParsedChannelLink {
  guildId: string | null;
  channelId: string;
  messageId?: string;
}

export interface ParsedMessageLink {
  guildId: string | null;
  channelId: string;
  messageId: string;
}

export function isValidSnowflake(id: string): boolean {
  return SNOWFLAKE_REGEX.test(id);
}

export function parseSnowflake(input: string, resourceType: string): string {
  if (isValidSnowflake(input)) {
    return input;
  }
  throw validationError(`Invalid ${resourceType} ID: ${input}`);
}

export function parseChannelInput(input: string): string {
  if (isValidSnowflake(input)) {
    return input;
  }

  const mentionMatch = input.match(CHANNEL_MENTION_REGEX);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  const linkMatch = input.match(CHANNEL_LINK_REGEX);
  if (linkMatch) {
    return linkMatch[2];
  }

  throw validationError(`Invalid channel identifier: ${input}. Provide ID, mention, or link.`);
}

export function parseGuildInput(input: string): string {
  if (isValidSnowflake(input)) {
    return input;
  }

  const linkMatch = input.match(CHANNEL_LINK_REGEX);
  if (linkMatch && linkMatch[1] !== '@me') {
    return linkMatch[1];
  }

  throw validationError(`Invalid guild identifier: ${input}. Provide ID or channel link.`);
}

export function parseUserInput(input: string): string {
  if (isValidSnowflake(input)) {
    return input;
  }

  const mentionMatch = input.match(USER_MENTION_REGEX);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  throw validationError(`Invalid user identifier: ${input}. Provide ID or mention.`);
}

export function parseMessageInput(input: string): string {
  if (isValidSnowflake(input)) {
    return input;
  }

  const linkMatch = input.match(MESSAGE_LINK_REGEX);
  if (linkMatch) {
    return linkMatch[3];
  }

  throw validationError(`Invalid message identifier: ${input}. Provide ID or link.`);
}

export function parseChannelLink(input: string): ParsedChannelLink | null {
  const match = input.match(CHANNEL_LINK_REGEX);
  if (!match) return null;

  return {
    guildId: match[1] === '@me' ? null : match[1],
    channelId: match[2],
    messageId: match[3],
  };
}

export function parseMessageLink(input: string): ParsedMessageLink | null {
  const match = input.match(MESSAGE_LINK_REGEX);
  if (!match) return null;

  return {
    guildId: match[1] === '@me' ? null : match[1],
    channelId: match[2],
    messageId: match[3],
  };
}

export function extractAllIds(input: string): {
  channels: string[];
  users: string[];
  messages: string[];
} {
  const channels = [...input.matchAll(/<#(\d{17,19})>/g)].map((m) => m[1]);
  const users = [...input.matchAll(/<@!?(\d{17,19})>/g)].map((m) => m[1]);
  const messages: string[] = [];

  const linkMatches = input.matchAll(/discord\.com\/channels\/(?:\d{17,19}|@me)\/\d{17,19}\/(\d{17,19})/g);
  for (const match of linkMatches) {
    messages.push(match[1]);
  }

  return { channels, users, messages };
}
