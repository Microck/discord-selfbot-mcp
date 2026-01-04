import { createServer, type Server } from 'http';
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

const TOKEN_INJECTION_HTML = (token: string, inviteCode: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Discord Invite - Manual Join</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #36393f;
      color: #dcddde;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      box-sizing: border-box;
    }
    .container {
      background: #2f3136;
      border-radius: 8px;
      padding: 32px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    h1 { color: #fff; margin-bottom: 16px; }
    .status { 
      padding: 16px;
      border-radius: 4px;
      margin: 16px 0;
      font-weight: 500;
    }
    .status.pending { background: #faa61a20; color: #faa61a; }
    .status.success { background: #43b58120; color: #43b581; }
    .status.error { background: #f0453420; color: #f04534; }
    .btn {
      background: #5865f2;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
      margin-top: 16px;
    }
    .btn:hover { background: #4752c4; }
    .btn:disabled { background: #4e5058; cursor: not-allowed; }
    .instructions {
      text-align: left;
      background: #202225;
      padding: 16px;
      border-radius: 4px;
      margin-top: 16px;
    }
    .instructions li { margin: 8px 0; }
    code { background: #202225; padding: 2px 6px; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Discord Invite Join</h1>
    <div id="status" class="status pending">Preparing...</div>
    <div class="instructions">
      <strong>Instructions:</strong>
      <ol>
        <li>Click "Open Discord Invite" below</li>
        <li>Solve the captcha if prompted</li>
        <li>Click "Accept Invite" on Discord</li>
        <li>This page will auto-detect when you've joined</li>
      </ol>
    </div>
    <button id="openBtn" class="btn" disabled>Open Discord Invite</button>
  </div>
  <script>
    const token = ${JSON.stringify(token)};
    const inviteCode = ${JSON.stringify(inviteCode)};
    const statusEl = document.getElementById('status');
    const openBtn = document.getElementById('openBtn');
    
    function injectToken() {
      try {
        statusEl.textContent = 'Ready! Click the button to open Discord invite.';
        statusEl.className = 'status pending';
        openBtn.disabled = false;
        return true;
      } catch(e) {
        statusEl.textContent = 'Error: ' + e.message;
        statusEl.className = 'status error';
        return false;
      }
    }
    
    openBtn.onclick = function() {
      const inviteUrl = 'https://discord.com/invite/' + inviteCode;
      window.open(inviteUrl, '_blank');
      statusEl.textContent = 'Discord opened! Solve captcha and accept the invite. Waiting for confirmation...';
      statusEl.className = 'status pending';
      pollForJoin();
    };
    
    async function pollForJoin() {
      try {
        const res = await fetch('/status');
        const data = await res.json();
        if (data.joined) {
          statusEl.textContent = 'Successfully joined: ' + data.guildName + '! You can close this page.';
          statusEl.className = 'status success';
          openBtn.disabled = true;
        } else if (data.error) {
          statusEl.textContent = 'Error: ' + data.error;
          statusEl.className = 'status error';
        } else {
          setTimeout(pollForJoin, 1000);
        }
      } catch(e) {
        setTimeout(pollForJoin, 1000);
      }
    }
    
    injectToken();
  </script>
</body>
</html>
`;

export async function solveCaptchaInBrowser(
  options: CaptchaSolverOptions
): Promise<CaptchaSolverResult> {
  const { inviteCode, client, token, timeoutMs = 300000 } = options;
  const logger = getLogger();
  
  const open = (await import('open')).default;
  
  let server: Server | null = null;
  let joinResult: CaptchaSolverResult = { success: false };
  const initialGuildIds = new Set(client.guilds.cache.keys());
  
  return new Promise((resolve) => {
    server = createServer((req, res) => {
      if (req.url === '/status') {
        for (const [guildId, guild] of client.guilds.cache) {
          if (!initialGuildIds.has(guildId)) {
            joinResult = {
              success: true,
              guildId,
              guildName: guild.name,
            };
            break;
          }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          joined: joinResult.success,
          guildId: joinResult.guildId,
          guildName: joinResult.guildName,
        }));
        return;
      }
      
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(TOKEN_INJECTION_HTML(token, inviteCode));
    });
    
    server.listen(0, '127.0.0.1', async () => {
      const address = server!.address();
      if (!address || typeof address === 'string') {
        resolve({ success: false, error: 'Failed to start local server' });
        return;
      }
      
      const port = address.port;
      const url = `http://127.0.0.1:${port}`;
      
      logger.info(`Opening system browser for manual captcha solving...`);
      logger.info(`Local server running at ${url}`);
      logger.warn('>>> SOLVE THE CAPTCHA IN YOUR BROWSER AND ACCEPT THE INVITE <<<');
      
      await open(url);
      
      const startTime = Date.now();
      const pollInterval = setInterval(() => {
        for (const [guildId, guild] of client.guilds.cache) {
          if (!initialGuildIds.has(guildId)) {
            clearInterval(pollInterval);
            logger.info(`Successfully joined guild: ${guild.name}`);
            
            setTimeout(() => {
              server?.close();
            }, 2000);
            
            resolve({
              success: true,
              guildId,
              guildName: guild.name,
            });
            return;
          }
        }
        
        if (Date.now() - startTime >= timeoutMs) {
          clearInterval(pollInterval);
          server?.close();
          logger.warn('Timeout waiting for guild join');
          resolve({
            success: false,
            error: 'Timeout. Please try again.',
          });
        }
      }, 1000);
    });
    
    server.on('error', (err) => {
      logger.error(`Server error: ${err.message}`);
      resolve({ success: false, error: err.message });
    });
  });
}
