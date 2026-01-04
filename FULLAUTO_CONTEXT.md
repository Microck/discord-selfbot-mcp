# FULLAUTO Context - Discord Selfbot MCP

## Current Task
Build a comprehensive Discord Selfbot MCP (Model Context Protocol) server with ALL features that current implementations lack.

## Target Features (Complete List)

### Message Operations
- [x] Read messages (existing)
- [x] Send messages (existing)
- [ ] Edit messages
- [ ] Delete messages
- [ ] Pin/unpin messages
- [ ] React to messages
- [ ] Remove reactions
- [ ] Reply to messages
- [ ] Forward messages
- [ ] Search messages

### DMs & Relationships
- [ ] Read DMs
- [ ] Send DMs
- [ ] List friends
- [ ] Add/remove friends
- [ ] Block/unblock users
- [ ] List blocked users

### Voice & Media
- [ ] Join voice channels
- [ ] Leave voice channels
- [ ] Mute/deafen self
- [ ] Upload files/images
- [ ] Download attachments

### Server Management
- [ ] List guilds (existing)
- [ ] List channels (existing)
- [ ] Change nickname
- [ ] Join/leave servers
- [ ] Create invites
- [ ] View audit logs
- [ ] Manage roles (self)

### Threads & Forums
- [ ] List threads
- [ ] Read thread messages
- [ ] Create threads
- [ ] Archive threads
- [ ] Forum post creation

### Status & Presence
- [ ] Set status (online/idle/dnd/invisible)
- [ ] Set custom status
- [ ] Set activity
- [ ] Read others' status

### Events & Scheduling
- [ ] List scheduled events
- [ ] RSVP to events
- [ ] Create events

### Notifications
- [ ] Get mention notifications
- [ ] Mark as read
- [ ] Mute channels/servers

### Channel Management
- [ ] Create channels
- [ ] Delete channels
- [ ] Edit channel settings

## Technical Decisions

### Language: TypeScript/Node.js
- Best MCP ecosystem support
- discord.js-selfbot-v13 available
- Easy npm distribution

### Auth: User Token
- Standard approach for selfbots
- Extracted from browser DevTools

### Architecture
- MCP Server using @modelcontextprotocol/sdk
- discord.js-selfbot-v13 for Discord API
- Modular tool organization by category

## Completed
- [x] Project directory created
- [x] Git initialized

## In Progress
- [ ] Oracle strategic consultation
- [ ] Project scaffolding
- [ ] Core implementation

## Key Files (To Be Created)
- src/index.ts - MCP server entry point
- src/client.ts - Discord client wrapper
- src/tools/*.ts - Tool implementations by category
- package.json - Dependencies
- tsconfig.json - TypeScript config

## Existing Implementations Analyzed
1. Maol-1997/discord-self-mcp - ~8 tools, has search
2. codebyyassine/discordselfbot-mcp - 29 tools, channel mgmt
3. elyxlz/discord-mcp - Email/password auth, web scraping

## Our Goal
50+ tools covering ALL Discord user functionality
