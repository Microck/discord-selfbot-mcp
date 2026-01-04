import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatUser } from '../../core/formatting/index.js';
import { internalError } from '../../core/errors/index.js';

const editProfileTool = createTool(
  'edit_profile',
  'Edit your user profile (avatar, banner, bio)',
  z.object({
    username: z.string().min(2).max(32).optional().describe('New username (rate limited!)'),
    avatar_url: z.string().url().optional().describe('URL to new avatar image'),
    banner_url: z.string().url().optional().describe('URL to new banner image'),
    bio: z.string().max(190).optional().describe('New "About Me" bio'),
  }),
  async (ctx, input) => {
    const user = ctx.client.user;
    if (!user) return failure(internalError('Client not ready'));

    const selfUser = user as unknown as {
      setUsername: (name: string, password?: string) => Promise<unknown>;
      setAvatar: (url: string) => Promise<unknown>;
      setBanner: (url: string) => Promise<unknown>;
      setAboutMe: (bio: string | null) => Promise<unknown>;
    };

    if (input.username) {
      await selfUser.setUsername(input.username);
    }

    if (input.avatar_url) {
      await selfUser.setAvatar(input.avatar_url);
    }

    if (input.banner_url) {
      await selfUser.setBanner(input.banner_url);
    }

    if (input.bio !== undefined) {
      await selfUser.setAboutMe(input.bio || null);
    }

    return success({
      message: 'Profile updated',
      user: formatUser(user),
    });
  }
);

export const profileTools = {
  name: 'profile',
  tools: [editProfileTool],
};

registerToolGroup(profileTools);
