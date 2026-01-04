import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { getAllTools, getToolByName } from './registry.js';
import { getDiscordContext, type DiscordContext } from '../discord/client.js';
import { getLogger } from '../core/logger.js';
import { mapDiscordError, validationError } from '../core/errors/index.js';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'discord-selfbot-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getAllTools();
    return {
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: zodToJsonSchema(tool.inputSchema) as Record<string, unknown>,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const logger = getLogger();
    const { name, arguments: args } = request.params;

    const tool = getToolByName(name);
    if (!tool) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: { code: 'NOT_FOUND', message: `Tool not found: ${name}` } }),
          },
        ],
        isError: true,
      };
    }

    let ctx: DiscordContext;
    try {
      ctx = getDiscordContext();
    } catch {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: { code: 'INTERNAL', message: 'Discord client not ready' } }),
          },
        ],
        isError: true,
      };
    }

    const parseResult = tool.inputSchema.safeParse(args);
    if (!parseResult.success) {
      const error = validationError('Invalid input', {
        issues: parseResult.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ error }) }],
        isError: true,
      };
    }

    try {
      logger.debug(`Executing tool: ${name}`, { args: parseResult.data });
      
      const result = await ctx.rateLimiter.run(() => tool.handler(ctx, parseResult.data));

      if (result.success) {
        return {
          content: [{ type: 'text', text: JSON.stringify(result.data) }],
        };
      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }],
          isError: true,
        };
      }
    } catch (error) {
      logger.error(`Tool execution failed: ${name}`, { error: String(error) });
      const mcpError = mapDiscordError(error);
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: mcpError }) }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startMcpServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  getLogger().info('MCP server started on stdio');
}
