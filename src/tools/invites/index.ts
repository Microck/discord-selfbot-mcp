import { z } from 'zod';
import { createTool, success, failure, registerToolGroup } from '../../mcp/registry.js';
import { formatGuild } from '../../core/formatting/index.js';
import { forbiddenError, notFoundError } from '../../core/errors/index.js';
import { solveCaptchaInBrowser } from '../../core/browser/captcha-solver.js';
import { getLogger } from '../../core/logger.js';

const acceptInviteTool = createTool(
  'accept_invite',
  'Join a server using an invite code. If captcha is required, it will be solved automatically if CAPTCHA_SERVICE and CAPTCHA_API_KEY are configured.',
  z.object({
    invite_code: z.string().describe('The invite code (e.g. "discord.gg/code" or just "code")'),
  }),
  async (ctx, input) => {
    const code = input.invite_code.split('/').pop() ?? input.invite_code;
    const logger = getLogger();

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
      
      const message = error instanceof Error ? error.message : String(error);
      
      if (message.includes('captcha') || message.includes('CAPTCHA')) {
        logger.info('Captcha required, launching browser for manual solving...');
        
        const browserResult = await solveCaptchaInBrowser({
          inviteCode: code,
          client: ctx.client,
          token: ctx.config.discordToken,
          timeoutMs: 300000,
        });
        
        if (browserResult.success) {
          const guild = ctx.client.guilds.cache.get(browserResult.guildId!);
          return success({
            guild: guild ? formatGuild(guild) : { id: browserResult.guildId, name: browserResult.guildName },
            message: `Joined guild via browser: ${browserResult.guildName}`,
          });
        }
        
        return failure(forbiddenError(
          `Captcha solving failed: ${browserResult.error}. Make sure you're logged into Discord in your browser.`
        ));
      }
      
      return failure(forbiddenError(`Failed to accept invite: ${message}`));
    }
  }
);

export const inviteTools = {
  name: 'invites',
  tools: [acceptInviteTool],
};

registerToolGroup(inviteTools);
