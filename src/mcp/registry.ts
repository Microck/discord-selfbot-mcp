import { z } from 'zod';
import type { DiscordContext } from '../discord/client.js';
import type { McpError } from '../core/errors/index.js';

export type ToolResult<T> = { success: true; data: T } | { success: false; error: McpError };

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  handler: (ctx: DiscordContext, input: unknown) => Promise<ToolResult<unknown>>;
}

export interface ToolGroup {
  name: string;
  tools: ToolDefinition[];
}

const toolGroups: ToolGroup[] = [];

export function registerToolGroup(group: ToolGroup): void {
  toolGroups.push(group);
}

export function getAllTools(): ToolDefinition[] {
  return toolGroups.flatMap((g) => g.tools);
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools().find((t) => t.name === name);
}

export function getToolGroups(): ToolGroup[] {
  return [...toolGroups];
}

export function createTool<TInput, TOutput>(
  name: string,
  description: string,
  inputSchema: z.ZodType<TInput>,
  handler: (ctx: DiscordContext, input: TInput) => Promise<ToolResult<TOutput>>
): ToolDefinition {
  return { 
    name, 
    description, 
    inputSchema, 
    handler: handler as (ctx: DiscordContext, input: unknown) => Promise<ToolResult<unknown>>,
  };
}

export function success<T>(data: T): ToolResult<T> {
  return { success: true, data };
}

export function failure<T>(error: McpError): ToolResult<T> {
  return { success: false, error };
}
