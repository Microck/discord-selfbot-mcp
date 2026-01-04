<p align="center">
  <img src="./logo.png" alt="discord-selfbot-mcp" width="100">
</p>

<h1 align="center">discord-selfbot-mcp</h1>

<p align="center">
  comprehensive discord selfbot mcp server with 64 tools for full user autonomy
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/language-typescript-blue" alt="language">
  <img src="https://img.shields.io/badge/mcp-sdk-orange" alt="mcp">
</p>

---

### quickstart

automatic setup wizard (extracts token via browser):

```bash
npx discord-selfbot-mcp-setup
```

manual installation:

```bash
npm install -g discord-selfbot-mcp
```

### features

**64 tools** across 15 categories.

| category | tools | description |
|----------|-------|-------------|
| **system** | 3 | health, whoami, get_config |
| **guilds** | 8 | list, info, members, nickname, leave, invite, create, delete |
| **channels** | 5 | list, info, create, delete, edit |
| **messages** | 8 | read, send, reply, edit, delete, search, get, forward |
| **reactions** | 4 | react, unreact, get_reactions, remove_all |
| **pins** | 3 | pin, unpin, list_pinned |
| **dms** | 5 | list, read, send, create, close |
| **threads** | 7 | list, create, join, leave, archive, read, send |
| **presence** | 5 | set_status, set_custom, set_activity, clear, get_user |
| **voice** | 5 | join, leave, set_state, get_state, list_members |
| **relationships** | 8 | friends, blocked, pending, request, remove, block, unblock, accept |
| **notifications** | 5 | mentions, mark_read, mark_guild_read, mute_channel, mute_guild |
| **files** | 3 | upload, download, list |
| **events** | 4 | list, get, rsvp, create |
| **profile** | 1 | edit_profile (avatar, bio, username) |
| **interactions** | 4 | trigger_typing, click_button, select_menu, get_components |
| **invites** | 1 | accept_invite (auto browser fallback for captcha) |
| **slash** | 1 | send_slash (execute bot slash commands, waits for response) |

### comparison

| feature | discord-selfbot-mcp | Maol-1997 | codebyyassine | elyxlz |
|---------|---------------------|-----------|---------------|--------|
| read messages | ✅ | ✅ | ✅ | ✅ |
| send messages | ✅ | ✅ | ✅ | ✅ |
| list guilds | ✅ | ✅ | ✅ | ✅ |
| list channels | ✅ | ✅ | ✅ | ✅ |
| get user info | ✅ | ✅ | ✅ | ❌ |
| search messages | ✅ | ❌ | ❌ | ❌ |
| create channels | ✅ | ❌ | ✅ | ❌ |
| delete channels | ✅ | ❌ | ✅ | ❌ |
| edit messages | ✅ | ❌ | ❌ | ❌ |
| delete messages | ✅ | ❌ | ❌ | ❌ |
| join voice | ✅ | ❌ | ❌ | ❌ |
| manage friends | ✅ | ❌ | ❌ | ❌ |
| manage threads | ✅ | ❌ | ❌ | ❌ |
| slash commands | ✅ | ❌ | ❌ | ❌ |
| click buttons | ✅ | ❌ | ❌ | ❌ |
| select menus | ✅ | ❌ | ❌ | ❌ |
| setup wizard | ✅ | ❌ | ❌ | ❌ |
| **total tools** | **64** | **7** | **29** | **4** |

### usage

run manually (requires token):

```bash
export DISCORD_TOKEN='your_token'
npx discord-selfbot-mcp
```

configure in claude/opencode:

```json
{
  "mcpServers": {
    "discord-selfbot": {
      "command": "npx",
      "args": ["discord-selfbot-mcp"],
      "env": {
        "DISCORD_TOKEN": "your_token"
      }
    }
  }
}
```

### captcha solving

discord may require captcha when joining servers. configure auto-solve:

```json
{
  "mcpServers": {
    "discord-selfbot": {
      "command": "npx",
      "args": ["discord-selfbot-mcp"],
      "env": {
        "DISCORD_TOKEN": "your_token",
        "CAPTCHA_SERVICE": "capsolver",
        "CAPTCHA_API_KEY": "your_api_key"
      }
    }
  }
}
```

| service | env value | pricing | signup |
|---------|-----------|---------|--------|
| CapSolver | `capsolver` | ~$0.80/1k | [capsolver.com](https://capsolver.com) |
| CapMonster | `capmonster` | ~$0.70/1k | [capmonster.cloud](https://capmonster.cloud) |
| NopeCHA | `nopecha` | 100 free/day | [nopecha.com](https://nopecha.com) |

if auto-solve fails or no service is configured, the MCP will open your system browser for manual captcha solving.

### slash commands

execute bot slash commands in any channel:

```typescript
send_slash({
  channel_id: "123456789",
  bot_id: "987654321",
  command: "task import",
  args: ["argument1", "argument2"]
})
```

### bot testing (buttons, menus)

click buttons and select dropdown options on bot messages:

```typescript
click_button({
  channel_id: "123456789",
  message_id: "987654321",
  button_id: "0,0"  // first button (row 0, col 0) or use custom_id
})

select_menu({
  channel_id: "123456789",
  message_id: "987654321", 
  menu_id: "0",  // first menu or custom_id
  values: ["option1", "option2"]
})

get_components({
  channel_id: "123456789",
  message_id: "987654321"
})  // inspect all buttons/menus on a message
```

### project structure

```bash
src/
├── core/           # configuration, logging, errors
├── discord/        # discord.js client wrapper
├── mcp/            # mcp server & registry
├── tools/          # tool implementations
│   ├── channels/
│   ├── dms/
│   ├── events/
│   ├── files/
│   ├── guilds/
│   ├── interactions/
│   ├── invites/
│   ├── slash/
│   ├── messages/
│   ├── notifications/
│   ├── presence/
│   ├── profile/
│   ├── relationships/
│   ├── system/
│   ├── threads/
│   └── voice/
├── index.ts        # entry point
└── setup.ts        # setup wizard
```

### troubleshooting

| problem | solution |
|---------|----------|
| **token invalid** | run `npx discord-selfbot-mcp-setup` to extract a fresh one |
| **rate limited** | reduce `RATE_LIMIT_CONCURRENCY` env var (default: 3) |
| **missing permissions** | ensure account has access to the guild/channel |
| **captcha required** | configure `CAPTCHA_SERVICE` and `CAPTCHA_API_KEY`, or let browser fallback handle it |

### license

mit
