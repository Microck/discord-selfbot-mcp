import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatUser } from '../../core/formatting/index.js';
import { parseUserInput } from '../../core/resolvers/index.js';
import { notFoundError, featureDisabledError, forbiddenError } from '../../core/errors/index.js';

const listFriendsTool = createTool(
  'list_friends',
  'List all friends',
  z.object({}),
  async (ctx) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    const relationships = ctx.client.relationships;
    const friends = relationships.friendCache.map((user) => formatUser(user));

    return success({
      count: friends.length,
      friends,
    });
  }
);

const listBlockedTool = createTool(
  'list_blocked',
  'List all blocked users',
  z.object({}),
  async (ctx) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    const relationships = ctx.client.relationships;
    const blocked = relationships.blockedCache.map((user) => formatUser(user));

    return success({
      count: blocked.length,
      blocked,
    });
  }
);

const listPendingRequestsTool = createTool(
  'list_pending_requests',
  'List pending friend requests (incoming and outgoing)',
  z.object({}),
  async (ctx) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    const relationships = ctx.client.relationships;
    const incoming = relationships.incomingCache.map((user) => formatUser(user));
    const outgoing = relationships.outgoingCache.map((user) => formatUser(user));

    return success({
      incoming: { count: incoming.length, users: incoming },
      outgoing: { count: outgoing.length, users: outgoing },
    });
  }
);

const sendFriendRequestTool = createTool(
  'send_friend_request',
  'Send a friend request to a user',
  z.object({
    user_id: z.string().describe('User ID to send request to'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    if (!ctx.config.dangerMode) {
      return failure(forbiddenError('Friend requests require DANGER_MODE=true'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    await ctx.client.relationships.sendFriendRequest(user);

    return success({
      userId,
      username: user.username,
      message: `Friend request sent to ${user.username}`,
    });
  }
);

const removeFriendTool = createTool(
  'remove_friend',
  'Remove a friend',
  z.object({
    user_id: z.string().describe('User ID to remove'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    if (!ctx.config.dangerMode) {
      return failure(forbiddenError('Removing friends requires DANGER_MODE=true'));
    }

    const userId = parseUserInput(input.user_id);
    await (ctx.client.relationships as unknown as { deleteFriend: (id: string) => Promise<void> }).deleteFriend(userId);

    return success({
      userId,
      message: 'Friend removed',
    });
  }
);

const blockUserTool = createTool(
  'block_user',
  'Block a user',
  z.object({
    user_id: z.string().describe('User ID to block'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    if (!ctx.config.dangerMode) {
      return failure(forbiddenError('Blocking users requires DANGER_MODE=true'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    await ctx.client.relationships.addBlocked(user);

    return success({
      userId,
      username: user.username,
      message: `Blocked ${user.username}`,
    });
  }
);

const unblockUserTool = createTool(
  'unblock_user',
  'Unblock a user',
  z.object({
    user_id: z.string().describe('User ID to unblock'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    if (!ctx.config.dangerMode) {
      return failure(forbiddenError('Unblocking users requires DANGER_MODE=true'));
    }

    const userId = parseUserInput(input.user_id);
    await (ctx.client.relationships as unknown as { deleteBlocked: (id: string) => Promise<void> }).deleteBlocked(userId);

    return success({
      userId,
      message: 'User unblocked',
    });
  }
);

const acceptFriendRequestTool = createTool(
  'accept_friend_request',
  'Accept a pending friend request',
  z.object({
    user_id: z.string().describe('User ID to accept'),
  }),
  async (ctx, input) => {
    if (!ctx.config.allowRelationships) {
      return failure(featureDisabledError('Relationships (set ALLOW_RELATIONSHIPS=true)'));
    }

    const userId = parseUserInput(input.user_id);
    const user = await ctx.client.users.fetch(userId);
    
    if (!user) {
      return failure(notFoundError('User', userId));
    }

    await ctx.client.relationships.sendFriendRequest(user);

    return success({
      userId,
      username: user.username,
      message: `Accepted friend request from ${user.username}`,
    });
  }
);

export const relationshipTools = {
  name: 'relationships',
  tools: [
    listFriendsTool,
    listBlockedTool,
    listPendingRequestsTool,
    sendFriendRequestTool,
    removeFriendTool,
    blockUserTool,
    unblockUserTool,
    acceptFriendRequestTool,
  ],
};

registerToolGroup(relationshipTools);
