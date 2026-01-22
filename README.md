<p align="center">
  <img src="./logo.png" alt="discord-selfbot-mcp" width="100">
</p>

<h1 align="center">discord-selfbot-mcp</h1>

<p align="center">
  comprehensive discord selfbot mcp server for full user autonomy.
  <br>
  powered by <a href="https://github.com/dolfies/discord.py-self">discord.py-self</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/language-python-blue" alt="language">
  <img src="https://img.shields.io/badge/mcp-sdk-orange" alt="mcp">
</p>

---

### installation

**Codex**  
Tell Codex:  
Fetch and follow instructions from https://raw.githubusercontent.com/Microck/discord-selfbot-mcp/refs/heads/master/.codex/INSTALL.md

**OpenCode**  
Tell OpenCode:  
Fetch and follow instructions from https://raw.githubusercontent.com/Microck/discord-selfbot-mcp/refs/heads/master/.opencode/INSTALL.md

---

### manual installation

**prerequisites**:
- python 3.10+
- `uv` (recommended) or `pip`

**install**:

```bash
uv tool install git+https://github.com/Microck/discord-selfbot-mcp.git
# or
pip install git+https://github.com/Microck/discord-selfbot-mcp.git
```

---

### how it works (setup wizard)

run the interactive setup script to generate your config:

```bash
# if using uv
uv tool run discord-selfbot-mcp-setup

# or running the script directly from the repo
python3 discord_selfbot_mcp/setup.py
```

1. **extract token**: automatically grabs your token from an open browser session (playwright)
2. **generate config**: outputs the mcp configuration json for you
3. **configure**: paste the config into your mcp client settings

---

### manual configuration

add this to your MCP config (`claude_desktop_config.json`, `.opencode.json`, etc):

```json
{
  "mcpServers": {
    "discord-selfbot": {
      "command": "uv",
      "args": ["tool", "run", "discord-selfbot-mcp"],
      "env": {
        "DISCORD_TOKEN": "your_token_here"
      }
    }
  }
}
```

if installed via pip/venv, adjust the command to point to your python executable or script location.

---

### features

powered by the robust `discord.py-self` library.

| category | tools | description |
|----------|-------|-------------|
| **system** | 2 | get_user_info, list_guilds |
| **messages** | 2 | send_message, read_messages |

*(more tools being ported from original node.js version - stay tuned)*

### comparison

| feature | discord-selfbot-mcp | Maol-1997 | codebyyassine | elyxlz |
|---------|---------------------|-----------|---------------|--------|
| read messages | yes | yes | yes | yes |
| send messages | yes | yes | yes | yes |
| list guilds | yes | yes | yes | yes |
| list channels | yes | yes | yes | yes |
| get user info | yes | yes | yes | no |
| search messages | planned | no | no | no |
| create channels | planned | no | yes | no |
| delete channels | planned | no | yes | no |
| edit messages | planned | no | no | no |
| delete messages | planned | no | no | no |
| join voice | planned | no | no | no |
| manage friends | planned | no | no | no |
| manage threads | planned | no | no | no |
| slash commands | planned | no | no | no |
| click buttons | planned | no | no | no |
| select menus | planned | no | no | no |
| setup wizard | yes | no | no | no |
| captcha fallback | partial | no | no | no |

---

### troubleshooting

| problem | solution |
|---------|----------|
| **token invalid** | run the setup script again to extract a fresh one |
| **missing dependencies** | ensure `uv` or `pip` installed all requirements (`discord.py-self`, `mcp`, `playwright`) |
| **playwright error** | run `playwright install chromium` |
| **audioop error** | ensure `audioop-lts` is installed if using python 3.13+ |

---

### project structure

```
discord_selfbot_mcp/
├── bot.py          # discord.py-self client instance
├── main.py         # mcp server entry point
├── setup.py        # setup wizard (token extraction)
└── tools/          # tool implementations
    ├── guilds.py
    ├── messages.py
    └── registry.py
```

---

### license

mit
