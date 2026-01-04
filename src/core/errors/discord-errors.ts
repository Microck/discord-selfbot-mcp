import { DiscordAPIError } from 'discord.js-selfbot-v13';
import {
  McpError,
  authError,
  rateLimitError,
  forbiddenError,
  notFoundError,
  internalError,
} from './mcp-errors.js';

const DISCORD_ERROR_MAP: Record<number, (err: DiscordAPIError) => McpError> = {
  0: (err) => authError(err.message),
  10003: (err) => notFoundError('Channel', extractId(err)),
  10004: (err) => notFoundError('Guild', extractId(err)),
  10008: (err) => notFoundError('Message', extractId(err)),
  10013: (err) => notFoundError('User', extractId(err)),
  50001: () => forbiddenError('Missing access to this resource'),
  50013: () => forbiddenError('Missing permissions'),
  50035: (err) => ({ code: 'VALIDATION', message: err.message }),
};

function extractId(err: DiscordAPIError): string {
  const match = err.path?.match(/\d{17,19}/);
  return match?.[0] ?? 'unknown';
}

export function mapDiscordError(error: unknown): McpError {
  if (error instanceof DiscordAPIError) {
    if (error.httpStatus === 401) {
      return authError();
    }

    if (error.httpStatus === 429) {
      const retryAfter = (error as unknown as { retryAfter?: number }).retryAfter ?? 5000;
      return rateLimitError(retryAfter);
    }

    if (error.httpStatus === 403) {
      return forbiddenError(error.message);
    }

    if (error.httpStatus === 404) {
      return notFoundError('Resource', extractId(error));
    }

    const mapper = DISCORD_ERROR_MAP[error.code];
    if (mapper) {
      return mapper(error);
    }

    return internalError(`Discord API error: ${error.message}`, {
      code: error.code,
      httpStatus: error.httpStatus,
    });
  }

  if (error instanceof Error) {
    if (error.message.includes('TOKEN_INVALID') || error.message.includes('invalid token')) {
      return authError();
    }
    return internalError(error.message);
  }

  return internalError('Unknown error occurred');
}
