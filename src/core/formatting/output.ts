import type {
  Guild,
  Channel,
  TextChannel,
  DMChannel,
  Message,
  User,
  GuildMember,
  MessageAttachment,
  MessageEmbed,
  VoiceState,
  ThreadChannel,
  Role,
} from 'discord.js-selfbot-v13';

export interface UserDTO {
  id: string;
  username: string;
  discriminator: string;
  displayName: string | null;
  avatarUrl: string | null;
  bot: boolean;
  system: boolean;
}

export interface GuildDTO {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  ownerId: string;
  description: string | null;
  features: string[];
  joinedAt: string | null;
}

export interface ChannelDTO {
  id: string;
  name: string | null;
  type: string;
  guildId: string | null;
  parentId: string | null;
  topic: string | null;
  nsfw: boolean;
  position: number | null;
}

export interface AttachmentDTO {
  id: string;
  filename: string;
  url: string;
  size: number;
  contentType: string | null;
  width: number | null;
  height: number | null;
}

export interface EmbedDTO {
  title: string | null;
  description: string | null;
  url: string | null;
  color: number | null;
  timestamp: string | null;
  footer: string | null;
  author: string | null;
}

export interface MessageDTO {
  id: string;
  channelId: string;
  guildId: string | null;
  author: UserDTO;
  content: string;
  createdAt: string;
  editedAt: string | null;
  pinned: boolean;
  type: string;
  replyTo: string | null;
  attachments: AttachmentDTO[];
  embeds: EmbedDTO[];
  reactions: { emoji: string; count: number; me: boolean }[];
}

export interface ThreadDTO {
  id: string;
  name: string;
  parentId: string | null;
  guildId: string | null;
  ownerId: string | null;
  archived: boolean;
  locked: boolean;
  messageCount: number;
  memberCount: number;
  createdAt: string | null;
}

export interface VoiceStateDTO {
  channelId: string | null;
  guildId: string | null;
  userId: string;
  mute: boolean;
  deaf: boolean;
  selfMute: boolean;
  selfDeaf: boolean;
  streaming: boolean;
}

export interface RoleDTO {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
  mentionable: boolean;
  hoist: boolean;
}

export function formatUser(user: User): UserDTO {
  return {
    id: user.id,
    username: user.username,
    discriminator: user.discriminator,
    displayName: user.globalName ?? null,
    avatarUrl: user.displayAvatarURL({ dynamic: true }) ?? null,
    bot: user.bot,
    system: user.system,
  };
}

export function formatGuild(guild: Guild): GuildDTO {
  return {
    id: guild.id,
    name: guild.name,
    iconUrl: guild.iconURL({ dynamic: true }) ?? null,
    memberCount: guild.memberCount,
    ownerId: guild.ownerId,
    description: guild.description,
    features: [...guild.features],
    joinedAt: guild.joinedAt?.toISOString() ?? null,
  };
}

export function formatChannel(channel: Channel): ChannelDTO {
  const base = {
    id: channel.id,
    type: channel.type,
    guildId: null as string | null,
    parentId: null as string | null,
    name: null as string | null,
    topic: null as string | null,
    nsfw: false,
    position: null as number | null,
  };

  if ('name' in channel) base.name = (channel as TextChannel).name;
  if ('guild' in channel) base.guildId = (channel as TextChannel).guild?.id ?? null;
  if ('parentId' in channel) base.parentId = (channel as TextChannel).parentId ?? null;
  if ('topic' in channel) base.topic = (channel as TextChannel).topic ?? null;
  if ('nsfw' in channel) base.nsfw = (channel as TextChannel).nsfw;
  if ('position' in channel) base.position = (channel as TextChannel).position ?? null;

  return base;
}

export function formatAttachment(att: MessageAttachment): AttachmentDTO {
  return {
    id: att.id,
    filename: att.name ?? 'unknown',
    url: att.url,
    size: att.size,
    contentType: att.contentType ?? null,
    width: att.width ?? null,
    height: att.height ?? null,
  };
}

export function formatEmbed(embed: MessageEmbed): EmbedDTO {
  return {
    title: embed.title ?? null,
    description: embed.description ?? null,
    url: embed.url ?? null,
    color: embed.color ?? null,
    timestamp: embed.timestamp ? new Date(embed.timestamp).toISOString() : null,
    footer: embed.footer?.text ?? null,
    author: embed.author?.name ?? null,
  };
}

export function formatMessage(message: Message): MessageDTO {
  return {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId,
    author: formatUser(message.author),
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    editedAt: message.editedAt?.toISOString() ?? null,
    pinned: message.pinned,
    type: message.type,
    replyTo: message.reference?.messageId ?? null,
    attachments: message.attachments.map((a) => formatAttachment(a)),
    embeds: message.embeds.map((e) => formatEmbed(e)),
    reactions: message.reactions.cache.map((r) => ({
      emoji: r.emoji.toString(),
      count: r.count ?? 0,
      me: r.me,
    })),
  };
}

export function formatThread(thread: ThreadChannel): ThreadDTO {
  return {
    id: thread.id,
    name: thread.name,
    parentId: thread.parentId,
    guildId: thread.guildId,
    ownerId: thread.ownerId,
    archived: thread.archived ?? false,
    locked: thread.locked ?? false,
    messageCount: thread.messageCount ?? 0,
    memberCount: thread.memberCount ?? 0,
    createdAt: thread.createdAt?.toISOString() ?? null,
  };
}

export function formatVoiceState(state: VoiceState): VoiceStateDTO {
  return {
    channelId: state.channelId,
    guildId: state.guild?.id ?? null,
    userId: state.id,
    mute: state.mute ?? false,
    deaf: state.deaf ?? false,
    selfMute: state.selfMute ?? false,
    selfDeaf: state.selfDeaf ?? false,
    streaming: state.streaming ?? false,
  };
}

export function formatRole(role: Role): RoleDTO {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions.bitfield.toString(),
    mentionable: role.mentionable,
    hoist: role.hoist,
  };
}
