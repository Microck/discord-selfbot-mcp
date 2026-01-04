import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatGuild } from '../../core/formatting/index.js';
import { forbiddenError, notFoundError } from '../../core/errors/index.js';

const acceptInviteTool = createTool(
  'accept_invite',
  'Join a server using an invite code',
  z.object({
    invite_code: z.string().describe('The invite code (e.g. "discord.gg/code" or just "code")'),
  }),
  async (ctx, input) => {
    const code = input.invite_code.split('/').pop() ?? input.invite_code;

    try {
      const invite = await ctx.client.fetchInvite(code);
      const joined = await (invite as unknown as { acceptInvite: () => Promise<import('discord.js-selfbot-v13').Guild> }).acceptInvite();
      
      return success({
        code: invite.code,
        guild: formatGuild(joined),
        message: `Joined guild: ${joined.name}`,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 10006) {
        return failure(notFoundError('Invite', code));
      }
      return failure(forbiddenError(`Failed to accept invite: ${error}`));
    }
  }
);

export const inviteTools = {
  name: 'invites',
  tools: [acceptInviteTool],
};

registerToolGroup(inviteTools);
