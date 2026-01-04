import { chromium, type Browser } from 'playwright';
import type { Client } from 'discord.js-selfbot-v13';
import { getLogger } from '../logger.js';

interface CaptchaSolverOptions {
  inviteCode: string;
  client: Client;
  token: string;
  timeoutMs?: number;
}

interface CaptchaSolverResult {
  success: boolean;
  guildId?: string;
  guildName?: string;
  error?: string;
}

export async function solveCaptchaInBrowser(
  options: CaptchaSolverOptions
): Promise<CaptchaSolverResult> {
  const { inviteCode, client, token, timeoutMs = 300000 } = options;
  const logger = getLogger();
  
  let browser: Browser | null = null;
  
  try {
    logger.info('Launching browser for captcha solving...');
    
    browser = await chromium.launch({
      headless: false,
      args: ['--disable-blink-features=AutomationControlled'],
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
    const page = await context.newPage();
    
    await page.goto('https://discord.com/app', { waitUntil: 'domcontentloaded' });
    
    await page.evaluate((discordToken) => {
      localStorage.setItem('token', JSON.stringify(discordToken));
    }, token);
    
    const inviteUrl = `https://discord.com/invite/${inviteCode}`;
    logger.info(`Navigating to invite: ${inviteUrl}`);
    await page.goto(inviteUrl, { waitUntil: 'networkidle' });
    
    const initialGuildIds = new Set(client.guilds.cache.keys());
    
    logger.info('Waiting for user to solve captcha and join guild...');
    logger.info(`Timeout: ${timeoutMs / 1000} seconds`);
    
    const result = await pollForGuildJoin(client, initialGuildIds, timeoutMs);
    
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Captcha solver error: ${message}`);
    return {
      success: false,
      error: message,
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function pollForGuildJoin(
  client: Client,
  initialGuildIds: Set<string>,
  timeoutMs: number
): Promise<CaptchaSolverResult> {
  const logger = getLogger();
  const startTime = Date.now();
  const pollInterval = 1000;
  
  return new Promise((resolve) => {
    const checkGuilds = () => {
      for (const [guildId, guild] of client.guilds.cache) {
        if (!initialGuildIds.has(guildId)) {
          logger.info(`Successfully joined guild: ${guild.name} (${guildId})`);
          resolve({
            success: true,
            guildId,
            guildName: guild.name,
          });
          return;
        }
      }
      
      if (Date.now() - startTime >= timeoutMs) {
        logger.warn('Captcha solver timed out');
        resolve({
          success: false,
          error: 'Timeout waiting for guild join. Please try again.',
        });
        return;
      }
      
      setTimeout(checkGuilds, pollInterval);
    };
    
    checkGuilds();
  });
}
