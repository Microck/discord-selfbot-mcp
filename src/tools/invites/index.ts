import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatGuild } from '../../core/formatting/index.js';
import { forbiddenError, notFoundError } from '../../core/errors/index.js';
import { solveCaptchaInBrowser } from '../../core/browser/index.js';

const CAPTCHA_ERROR_PATTERNS = [
  'CAPTCHA',
  'captcha',
  'You need to update your app',
  'verify',
];

function isCaptchaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return CAPTCHA_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

const acceptInviteTool = createTool(
  'accept_invite',
  'Join a server using an invite code',
  z.object({
    invite_code: z.string().describe('The invite code (e.g. "discord.gg/code" or just "code")'),
  }),
  async (ctx, input) => {
    const code = input.invite_code.split('/').pop() ?? input.invite_code;

    try {
      const joined = await ctx.client.acceptInvite(code, {
        bypassOnboarding: true,
        bypassVerify: true,
      });
      
      if ('name' in joined && 'id' in joined) {
        return success({
          guild: formatGuild(joined as import('discord.js-selfbot-v13').Guild),
          message: `Joined guild: ${joined.name}`,
        });
      }
      
      return success({
        channel_id: joined.id,
        message: `Joined channel/group DM`,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 10006) {
        return failure(notFoundError('Invite', code));
      }
      
      if (isCaptchaError(error)) {
        const result = await solveCaptchaInBrowser({
          inviteCode: code,
          client: ctx.client,
          token: ctx.config.discordToken,
          timeoutMs: 300000,
        });
        
        if (result.success && result.guildId) {
          const guild = ctx.client.guilds.cache.get(result.guildId);
          if (guild) {
            return success({
              guild: formatGuild(guild),
              message: `Joined guild: ${result.guildName} (via browser captcha)`,
            });
          }
          return success({
            guildId: result.guildId,
            guildName: result.guildName,
            message: `Joined guild: ${result.guildName} (via browser captcha)`,
          });
        }
        
        return failure(forbiddenError(result.error ?? 'Captcha solving failed'));
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
