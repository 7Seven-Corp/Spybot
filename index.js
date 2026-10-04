// Made by Cu_psy & Trvs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

import {
  Client,
  GatewayIntentBits,
  Partials,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

import { Client as SelfClient } from 'discord.js-selfbot-v13';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(__dirname, 'data');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const bus = new EventEmitter();

const log = (msg) =>
  console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

const err = (msg) =>
  console.error(`[${new Date().toLocaleTimeString()}] ERROR: ${msg}`);


const UI = {
  primary: 0x5865F2,
  success: 0x57F287,
  warning: 0xFEE75C,
  danger: 0xED4245,
};

function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

function separator() {
  return new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small);
}

function panel({
  title,
  body,
  color = UI.primary,
  footer,
  buttons = [],
}) {
  const container = new ContainerBuilder()
    .setAccentColor(color);

  if (title) {
    container.addTextDisplayComponents(
      text(`## ${title}`)
    );
  }

  if (body) {
    container.addTextDisplayComponents(
      text(body)
    );
  }

  if (footer) {
    container.addSeparatorComponents(
      separator()
    );

    container.addTextDisplayComponents(
      text(`-# ${footer}`)
    );
  }

  if (buttons.length) {
    const row = new ActionRowBuilder();

    for (const button of buttons) {
      row.addComponents(button);
    }

    container.addActionRowComponents(row);
  }

  return container;
}

function linkButton(label, url) {
  return new ButtonBuilder()
    .setStyle(ButtonStyle.Link)
    .setLabel(label)
    .setURL(url);
}

function v2Payload(options, ephemeral = false) {
  return {
    components: [
      panel(options),
    ],

    flags:
      MessageFlags.IsComponentsV2 |
      (ephemeral ? MessageFlags.Ephemeral : 0),

    allowedMentions: {
      parse: [],
    },
  };
}

function v2EditPayload(options) {
  return {
    components: [
      panel(options),
    ],

    allowedMentions: {
      parse: [],
    },
  };
}

const successPanel = (title, body, footer) => ({
  title: `✅ ${title}`,
  body,
  color: UI.success,
  footer,
});

const errorPanel = (title, body, footer) => ({
  title: `❌ ${title}`,
  body,
  color: UI.danger,
  footer,
});

const infoPanel = (title, body, footer) => ({
  title: `ℹ️ ${title}`,
  body,
  color: UI.primary,
  footer,
});


const FILES = {
  keywords: path.join(DATA_DIR, 'keywords.json'),
  stalked: path.join(DATA_DIR, 'stalked.json'),
  whitelist: path.join(DATA_DIR, 'whitelist.json'),
};

const cache = {};

function initStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true,
    });
  }

  for (const file of Object.values(FILES)) {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(
        file,
        '[]',
        'utf8'
      );
    }
  }

  log('Storage ready');
}

function getAll(key) {
  try {
    return JSON.parse(
      fs.readFileSync(
        FILES[key],
        'utf8'
      )
    );
  } catch (e) {
    err(`getAll ${key}: ${e.message}`);
    return [];
  }
}

function save(key, data) {
  fs.writeFileSync(
    FILES[key],
    JSON.stringify(
      data,
      null,
      2
    ),
    'utf8'
  );
}

function add(key, entry) {
  const data = getAll(key);

  data.push(entry);

  save(key, data);

  return entry;
}

function edit(key, id, changes) {
  const data = getAll(key);

  const entry = data.find(
    e => e.ownerId === id
  );

  if (!entry) return null;

  Object.assign(
    entry,
    changes
  );

  save(key, data);

  return entry;
}

function editAll(key, pred, changes) {
  const data = getAll(key);

  const entries = data.filter(pred);

  if (!entries.length) {
    return 0;
  }

  for (const entry of entries) {
    Object.assign(
      entry,
      changes
    );
  }

  save(key, data);

  return entries.length;
}

function remove(key, pred) {
  const data = getAll(key);

  const before = data.length;

  const newData = data.filter(
    e => !pred(e)
  );

  save(
    key,
    newData
  );

  return before - newData.length;
}

function find(key, pred) {
  return getAll(key).find(pred);
}

function filter(key, pred) {
  return getAll(key).filter(pred);
}

// Made by Cu_psy & Trvs

const isOwner = (id) =>
  config.ownerIds.includes(id);

const isWhitelisted = (id) =>
  !!find(
    'whitelist',
    e => e.userId === id
  );



// Made by Cu_psy & Trvs

function getClientIdFromToken(token) {
  return Buffer.from(
    token.split('.')[0],
    'base64'
  ).toString('utf8');
}

async function ensureCategory(
  guild,
  name
) {
  let cat =
    guild.channels.cache.find(
      c =>
        c.type ===
          ChannelType.GuildCategory &&
        c.name === name
    );

  if (!cat) {
    cat =
      await guild.channels.create({
        name,
        type:
          ChannelType.GuildCategory,
      });
  }

  return cat;
}

async function createPrivateChannel(
  guild,
  category,
  user,
  roleId
) {
  const name =
    `spy-${user.username}`
      .toLowerCase()
      .replace(
        /[^a-z0-9-]/g,
        ''
      );

  const existing =
    guild.channels.cache.find(
      c =>
        c.type ===
          ChannelType.GuildText &&
        c.name === name
    );

  if (existing) {
    return existing;
  }

  return guild.channels.create({
    name,

    type:
      ChannelType.GuildText,

    parent:
      category.id,

    permissionOverwrites: [
      {
        id:
          guild.roles
            .everyone.id,

        deny: [
          PermissionFlagsBits
            .ViewChannel,
        ],
      },

      {
        id:
          user.id,

        allow: [
          PermissionFlagsBits
            .ViewChannel,

          PermissionFlagsBits
            .ReadMessageHistory,

          PermissionFlagsBits
            .SendMessages,
        ],
      },

      {
        id:
          roleId,

        allow: [
          PermissionFlagsBits
            .ViewChannel,

          PermissionFlagsBits
            .ReadMessageHistory,
        ],
      },
    ],
  });
}



// Made by Cu_psy & Trvs

const commands = [
  {
    data:
      new SlashCommandBuilder()
        .setName('ping')
        .setDescription(
          'Latency'
        ),

    async execute(i) {
      await i.reply(
        v2Payload(
          infoPanel(
            'Latency',

            `**${i.client.ws.ping} ms**`,

            '7Seven • System'
          ),

          true
        )
      );
    },
  },

  {
    data:
      new SlashCommandBuilder()
        .setName(
          'whitelist'
        )

        .setDescription(
          'Add a user to the whitelist (owner only)'
        )

        .addUserOption(
          o =>
            o
              .setName(
                'user'
              )

              .setDescription(
                'User'
              )

              .setRequired(
                true
              )
        ),

    async execute(i) {
      if (
        !isOwner(
          i.user.id
        )
      ) {
        return i.reply(
          v2Payload(
            errorPanel(
              'Access denied',

              'This command is reserved for owners.',

              '7Seven • Security'
            ),

            true
          )
        );
      }

      const target =
        i.options.getUser(
          'user'
        );

      if (
        isWhitelisted(
          target.id
        )
      ) {
        return i.reply(
          v2Payload(
            infoPanel(
              'Already whitelisted',

              `<@${target.id}> is already authorized.`,

              '7Seven • Whitelist'
            ),

            true
          )
        );
      }

      await i.reply(
        v2Payload(
          infoPanel(
            'Processing',

            'Applying your request…',

            '7Seven • System'
          ),

          true
        )
      );

      try {
        const member =
          await i.guild.members.fetch(
            target.id
          );

        if (
          config.whitelistRoleId
        ) {
          await member.roles
            .add(
              config.whitelistRoleId
            )

            .catch(
              e =>
                err(
                  `role add: ${e.message}`
                )
            );
        }

        const cat =
          await ensureCategory(
            i.guild,
            config.alertCategoryName
          );

        const chan =
          await createPrivateChannel(
            i.guild,
            cat,
            target,
            config.whitelistRoleId
          );

        add(
          'whitelist',
          {
            userId:
              target.id,

            addedBy:
              i.user.id,

            channelId:
              chan.id,

            addedAt:
              Date.now(),
          }
        );

        await i.editReply(
          v2EditPayload(
            successPanel(
              'Whitelist updated',

              `**${target.tag}** is now whitelisted.\n\nPrivate alerts: <#${chan.id}>`,

              '7Seven • Whitelist'
            )
          )
        );

        await chan.send(
          v2Payload(
            successPanel(
              'Private alerts enabled',

              `Welcome <@${target.id}>.\n\nYour keyword and stalk alerts will be delivered in this channel.`,

              '7Seven • Monitoring'
            )
          )
        );
      } catch (e) {
        err(
          `whitelist: ${e.message}`
        );

        await i.editReply(
          v2EditPayload(
            errorPanel(
              'Operation failed',

              `\`${e.message}\``,

              '7Seven • Error'
            )
          )
        );
      }
    },
  },

  {
    data:
      new SlashCommandBuilder()
        .setName(
          'unwhitelist'
        )

        .setDescription(
          'Remove a user from whitelist (owner only)'
        )

        .addUserOption(
          o =>
            o
              .setName(
                'user'
              )

              .setDescription(
                'User'
              )

              .setRequired(
                true
              )
        ),

    async execute(i) {
      if (
        !isOwner(
          i.user.id
        )
      ) {
        return i.reply(
          v2Payload(
            errorPanel(
              'Access denied',

              'This command is reserved for owners.',

              '7Seven • Security'
            ),

            true
          )
        );
      }

      const target =
        i.options.getUser(
          'user'
        );

      const entry =
        find(
          'whitelist',
          e =>
            e.userId ===
            target.id
        );

      if (!entry) {
        return i.reply(
          v2Payload(
            infoPanel(
              'Not whitelisted',

              `<@${target.id}> is not currently whitelisted.`,

              '7Seven • Whitelist'
            ),

            true
          )
        );
      }

      await i.reply(
        v2Payload(
          infoPanel(
            'Processing',

            'Applying your request…',

            '7Seven • System'
          ),

          true
        )
      );

      const member =
        await i.guild.members
          .fetch(
            target.id
          )

          .catch(
            () => null
          );

      if (
        member &&
        config.whitelistRoleId
      ) {
        await member.roles
          .remove(
            config.whitelistRoleId
          )

          .catch(
            () => {}
          );
      }

      const chan =
        i.guild.channels.cache.get(
          entry.channelId
        );

      if (chan) {
        await chan
          .delete()

          .catch(
            () => {}
          );
      }

      remove(
        'whitelist',

        e =>
          e.userId ===
          target.id
      );

      await i.editReply(
        v2EditPayload(
          successPanel(
            'Whitelist updated',

            `**${target.tag}** has been removed from the whitelist.`,

            '7Seven • Whitelist'
          )
        )
      );
    },
  },

  {
    data:
      new SlashCommandBuilder()
        .setName(
          'keyword'
        )

        .setDescription(
          'Manage keywords'
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'add'
              )

              .setDescription(
                'Add a keyword'
              )

              .addStringOption(
                o =>
                  o
                    .setName(
                      'pattern'
                    )

                    .setDescription(
                      'Word or regex'
                    )

                    .setRequired(
                      true
                    )
              )

              .addBooleanOption(
                o =>
                  o
                    .setName(
                      'regex'
                    )

                    .setDescription(
                      'Is regex?'
                    )
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'remove'
              )

              .setDescription(
                'Remove by id'
              )

              .addStringOption(
                o =>
                  o
                    .setName(
                      'id'
                    )

                    .setDescription(
                      'ID'
                    )

                    .setRequired(
                      true
                    )
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'stop'
              )

              .setDescription(
                'Stop keyword system by keeping the list saved'
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'start'
              )

              .setDescription(
                'Start keyword system'
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'state'
              )

              .setDescription(
                'State of keyword system'
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'list'
              )

              .setDescription(
                'List your keywords'
              )
        ),

    async execute(i) {
      if (
        !isWhitelisted(
          i.user.id
        ) &&
        !isOwner(
          i.user.id
        )
      ) {
        return i.reply(
          v2Payload(
            errorPanel(
              'Whitelist required',

              'You must be whitelisted to use this command.',

              '7Seven • Security'
            ),

            true
          )
        );
      }

      const sub =
        i.options.getSubcommand();

      if (
        sub ===
        'add'
      ) {
        const pattern =
          i.options.getString(
            'pattern'
          );

        const isRegex =
          i.options.getBoolean(
            'regex'
          ) ?? false;

        const id =
          `kw_${Date.now()}`;

        add(
          'keywords',
          {
            id,

            ownerId:
              i.user.id,

            pattern,

            isRegex,
          }
        );

        return i.reply(
          v2Payload(
            successPanel(
              'Keyword added',

              `Pattern: \`${pattern}\`\nID: \`${id}\`\nMode: **${isRegex ? 'Regex' : 'Text'}**`,

              '7Seven • Keywords'
            ),

            true
          )
        );
      }

      if (
        sub ===
        'remove'
      ) {
        const id =
          i.options.getString(
            'id'
          );

        const n =
          remove(
            'keywords',

            e =>
              e.id === id &&
              (
                e.ownerId ===
                  i.user.id ||
                isOwner(
                  i.user.id
                )
              )
          );

        return i.reply(
          v2Payload(
            n
              ? successPanel(
                  'Keyword removed',

                  `Keyword \`${id}\` has been removed.`,

                  '7Seven • Keywords'
                )

              : errorPanel(
                  'Keyword not found',

                  `No accessible keyword matches \`${id}\`.`,

                  '7Seven • Keywords'
                ),

            true
          )
        );
      }

      if (
        sub ===
        'list'
      ) {
        const mine =
          filter(
            'keywords',

            e =>
              e.ownerId ===
              i.user.id
          );

        if (
          !mine.length
        ) {
          return i.reply(
            v2Payload(
              infoPanel(
                'No keywords',

                'You have no registered keywords.',

                '7Seven • Keywords'
              ),

              true
            )
          );
        }

        const txt =
          mine
            .map(
              k =>
                `\`${k.id}\` -> \`${k.pattern}\`${k.isRegex ? ' (regex)' : ''}`
            )

            .join(
              '\n'
            );

        return i.reply(
          v2Payload(
            infoPanel(
              'Your keywords',

              txt,

              `7Seven • ${mine.length} keyword${mine.length > 1 ? 's' : ''}`
            ),

            true
          )
        );
      }

      if (
        sub ===
        'stop'
      ) {
        const ownerId =
          i.user.id.toString();

        edit(
          'keywords',
          ownerId,
          {
            active: false,
          }
        );

        return i.reply(
          v2Payload(
            successPanel(
              'Keyword system stopped',

              `Monitoring is now paused for \`${ownerId}\`.\n\nYour saved keywords have **not** been deleted.`,

              '7Seven • Keywords'
            ),

            true
          )
        );
      }

      if (
        sub ===
        'start'
      ) {
        const ownerId =
          i.user.id.toString();

        edit(
          'keywords',
          ownerId,
          {
            active: true,
          }
        );

        return i.reply(
          v2Payload(
            successPanel(
              'Keyword system started',

              `Monitoring is now active for \`${ownerId}\`.`,

              '7Seven • Keywords'
            ),

            true
          )
        );
      }

      if (
        sub ===
        'state'
      ) {
        const ownerId =
          i.user.id;

        const entry =
          find(
            'keywords',

            e =>
              e.ownerId ===
              ownerId
          );

        const state =
          entry?.active;

        return i.reply(
          v2Payload(
            infoPanel(
              'Keyword system state',

              `Status: **${
                state === true
                  ? 'ACTIVE'
                  : state === false
                    ? 'STOPPED'
                    : 'UNDEFINED'
              }**\nUser: \`${ownerId}\``,

              '7Seven • Keywords'
            ),

            true
          )
        );
      }
    },
  },

  {
    data:
      new SlashCommandBuilder()
        .setName(
          'stalk'
        )

        .setDescription(
          'Watch a specific user'
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'add'
              )

              .setDescription(
                'Stalk a user'
              )

              .addStringOption(
                o =>
                  o
                    .setName(
                      'userid'
                    )

                    .setDescription(
                      'User ID'
                    )

                    .setRequired(
                      true
                    )
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'remove'
              )

              .setDescription(
                'Stop'
              )

              .addStringOption(
                o =>
                  o
                    .setName(
                      'userid'
                    )

                    .setDescription(
                      'User ID'
                    )

                    .setRequired(
                      true
                    )
              )
        )

        .addSubcommand(
          s =>
            s
              .setName(
                'list'
              )

              .setDescription(
                'List'
              )
        ),

    async execute(i) {
      if (
        !isWhitelisted(
          i.user.id
        ) &&
        !isOwner(
          i.user.id
        )
      ) {
        return i.reply(
          v2Payload(
            errorPanel(
              'Whitelist required',

              'You must be whitelisted to use this command.',

              '7Seven • Security'
            ),

            true
          )
        );
      }

      const sub =
        i.options.getSubcommand();

      if (
        sub ===
        'add'
      ) {
        const userid =
          i.options.getString(
            'userid'
          );

        if (
          find(
            'stalked',

            e =>
              e.ownerId ===
                i.user.id &&
              e.targetId ===
                userid
          )
        ) {
          return i.reply(
            v2Payload(
              infoPanel(
                'Already monitored',

                `User \`${userid}\` is already in your stalk list.`,

                '7Seven • Stalk'
              ),

              true
            )
          );
        }

        add(
          'stalked',
          {
            id:
              `st_${Date.now()}`,

            ownerId:
              i.user.id,

            targetId:
              userid,
          }
        );

        return i.reply(
          v2Payload(
            successPanel(
              'Monitoring started',

              `Now watching user \`${userid}\`.`,

              '7Seven • Stalk'
            ),

            true
          )
        );
      }

      if (
        sub ===
        'remove'
      ) {
        const userid =
          i.options.getString(
            'userid'
          );

        const n =
          remove(
            'stalked',

            e =>
              e.ownerId ===
                i.user.id &&
              e.targetId ===
                userid
          );

        return i.reply(
          v2Payload(
            n
              ? successPanel(
                  'Monitoring stopped',

                  `User \`${userid}\` has been removed from your stalk list.`,

                  '7Seven • Stalk'
                )

              : errorPanel(
                  'User not found',

                  `User \`${userid}\` is not in your stalk list.`,

                  '7Seven • Stalk'
                ),

            true
          )
        );
      }

      if (
        sub ===
        'list'
      ) {
        const mine =
          filter(
            'stalked',

            e =>
              e.ownerId ===
              i.user.id
          );

        if (
          !mine.length
        ) {
          return i.reply(
            v2Payload(
              infoPanel(
                'Stalk list empty',

                'You are not monitoring any users.',

                '7Seven • Stalk'
              ),

              true
            )
          );
        }

        return i.reply(
          v2Payload(
            infoPanel(
              'Monitored users',

              mine
                .map(
                  (
                    s,
                    index
                  ) =>
                    `**${index + 1}.** \`${s.targetId}\``
                )

                .join(
                  '\n'
                ),

              `7Seven • ${mine.length} user${mine.length > 1 ? 's' : ''}`
            ),

            true
          )
        );
      }
    },
  },
];



// Made by Cu_psy & Trvs

function buildAlertComponents(
  payload
) {
  const {
    type,
    message,
    match,
    selfbotName,
  } = payload;

  const isKeyword =
    type === 'keyword';

  const title =
    isKeyword
      ? '🕷️ Keyword detected'
      : '👁️ Watched user activity';

  const color =
    isKeyword
      ? UI.primary
      : UI.warning;

  const location =
    message.guildName ||
    'Direct Message';

  const channel =
    message.channelId
      ? `<#${message.channelId}>`
      : (
          message.channelName ||
          'Unknown'
        );

  const body = [
    `### ${message.authorTag}`,

    message.content ||
      '*[no content]*',

    '',

    `**Server**  •  ${location}`,

    `**Channel**  •  ${channel}`,

    `**Selfbot**  •  ${selfbotName}`,

    isKeyword
      ? `**Matched**  •  \`${match}\``
      : `**Stalked user**  •  <@${match}>`,
  ]
    .join('\n')
    .slice(
      0,
      3900
    );

  const buttons =
    message.jumpUrl
      ? [
          linkButton(
            'Open message',
            message.jumpUrl
          ),
        ]

      : [];

  return panel({
    title,
    body,
    color,

    footer:
      `Author ID: ${message.authorId} • ${new Date(message.timestamp).toLocaleString()}`,

    buttons,
  });
}



// Made by Cu_psy & Trvs

async function deployCommands() {
  const clientId =
    getClientIdFromToken(
      config.botToken
    );

  const rest =
    new REST({
      version: '10',
    }).setToken(
      config.botToken
    );

  const body =
    commands.map(
      c =>
        c.data.toJSON()
    );

  console.log(body);

  if (
    config.guildId
  ) {
    await rest.put(
      Routes.applicationGuildCommands(
        clientId,
        config.guildId
      ),

      {
        body,
      }
    );

    await rest.put(
      Routes.applicationCommands(
        clientId
      ),

      {
        body: [],
      }
    );

    console.log(
      'Commandes globales supprimées'
    );

    log(
      `Deployed ${body.length} commands to guild ${config.guildId}`
    );
  } else {
    await rest.put(
      Routes.applicationCommands(
        clientId
      ),

      {
        body,
      }
    );

    log(
      `Deployed ${body.length} global commands`
    );
  }
}



async function startBot() {
  const client =
    new Client({
      intents: [
        GatewayIntentBits
          .Guilds,

        GatewayIntentBits
          .GuildMembers,

        GatewayIntentBits
          .GuildMessages,
      ],

      partials: [
        Partials.Channel,
        Partials.GuildMember,
      ],
    });

  client.once(
    'ready',

    () => {
      log(
        `Bot ready: ${client.user.tag}`
      );

      client.user.setPresence({
        activities: [
          {
            name:
              '7Seven - Corps',

            type: 3,
          },
        ],

        status:
          'online',
      });
    }
  );

  client.on(
    'interactionCreate',

    async i => {
      if (
        !i.isChatInputCommand()
      ) {
        return;
      }

      const cmd =
        commands.find(
          c =>
            c.data.name ===
            i.commandName
        );

      if (!cmd) {
        return;
      }

      try {
        await cmd.execute(i);
      } catch (e) {
        err(
          `cmd ${i.commandName}: ${e.message}`
        );

        const r =
          errorPanel(
            'Command error',

            `\`${e.message}\``,

            '7Seven • Error'
          );

        if (
          i.deferred ||
          i.replied
        ) {
          await i
            .editReply(
              v2EditPayload(
                r
              )
            )

            .catch(
              () => {}
            );
        } else {
          await i
            .reply(
              v2Payload(
                r,
                true
              )
            )

            .catch(
              () => {}
            );
        }
      }
    }
  );

  bus.on(
    'alert',

    async payload => {
      const alert =
        buildAlertComponents(
          payload
        );

      const entry =
        find(
          'whitelist',

          e =>
            e.userId ===
            payload.ownerId
        );

      if (!entry) {
        return;
      }

      const chan =
        await client.channels
          .fetch(
            entry.channelId
          )

          .catch(
            () => null
          );

      if (chan) {
        await chan
          .send({
            components: [
              alert,
            ],

            flags:
              MessageFlags.IsComponentsV2,

            allowedMentions: {
              parse: [],
            },
          })

          .catch(
            e =>
              err(
                `send alert: ${e.message}`
              )
          );
      }
    }
  );

  await deployCommands();

  await client.login(
    config.botToken
  );

  return client;
}



// Made by Cu_psy & Trvs

function matchKeyword(
  content,
  entry
) {
  if (
    entry.isRegex
  ) {
    try {
      const m =
        content.match(
          new RegExp(
            entry.pattern,
            'i'
          )
        );

      return m
        ? m[0]
        : null;
    } catch {
      return null;
    }
  }

  return content
    .toLowerCase()
    .includes(
      entry.pattern
        .toLowerCase()
    )

    ? entry.pattern
    : null;
}



function buildMessagePayload(
  message,
  selfbotName
) {
  return {
    message: {
      content:
        message.content,

      authorId:
        message.author.id,

      authorTag:
        message.author.tag,

      authorAvatar:
        message.author
          .displayAvatarURL?.({
            dynamic: true,
          }),

      guildName:
        message.guild?.name,

      channelName:
        message.channel?.name,

      channelId:
        message.channel?.id,

      jumpUrl:
        message.url,

      timestamp:
        message.createdAt
          .toISOString(),
    },

    selfbotName,
  };
}



async function startSelfbots() {
  for (
    const sb
    of config.selfbots
  ) {
    const client =
      new SelfClient({
        checkUpdate: false,
      });

    client.on(
      'ready',

      () =>
        log(
          `Selfbot "${sb.name}" ready as ${client.user.tag}`
        )
    );

    client.on(
      'messageCreate',

      message => {
        if (
          !message.content ||
          message.author?.bot
        ) {
          return;
        }

        const entry =
          getAll(
            'keywords'
          ).find(
            kw =>
              matchKeyword(
                message.content,
                kw
              )
          );

        if (!entry) {
          return;
        }

        console.log(
          'Keyword trouvé :',
          entry
        );

        if (
          entry.active === true
        ) {
          const match =
            matchKeyword(
              message.content,
              entry
            );

          bus.emit(
            'alert',

            {
              ...buildMessagePayload(
                message,
                sb.name
              ),

              type:
                'keyword',

              match,

              ownerId:
                entry.ownerId,
            }
          );
        }

        for (
          const st
          of getAll(
            'stalked'
          )
        ) {
          if (
            message.author.id ===
            st.targetId
          ) {
            bus.emit(
              'alert',

              {
                ...buildMessagePayload(
                  message,
                  sb.name
                ),

                type:
                  'stalk',

                match:
                  st.targetId,

                ownerId:
                  st.ownerId,
              }
            );
          }
        }
      }
    );

    client.on(
      'error',

      e =>
        err(
          `Selfbot "${sb.name}": ${e.message}`
        )
    );

    await client
      .login(
        sb.token
      )

      .catch(
        e =>
          err(
            `Selfbot "${sb.name}" login: ${e.message}`
          )
      );
  }
}


// Made by Cu_psy & Trvs
function printBanner() {
    if (startupPrinted) return;

    startupPrinted = true;

    console.log(String.raw`
_________  _________                                   _________
\______  \/   _____/ _______  __ ____   ____           \_   ___ \  _________________
    /    /\_____  \_/ __ \  \/ // __ \ /    \   ______ /    \  \/ /  _ \_  __ \____ \
   /    / /        \  ___/\   /\  ___/|   |  \ /_____/ \     \___(  <_> )  | \/  |_> >
  /____/ /_______  /\___  >\_/  \___  >___|  /          \______  /\____/|__|  |   __/
                 \/     \/          \/     \/                  \/             |__|
`);
}
async function main() {
  printBanner()
  log(
    'Starting spybot...'
  );

  initStorage();

  await startBot();

  await startSelfbots();

  log(
    'All systems online.'
  );
}

process.on(
  'unhandledRejection',

  e =>
    err(
      `Unhandled: ${e.message}`
    )
);

process.on(
  'uncaughtException',

  e =>
    err(
      `Uncaught: ${e.message}`
    )
);

main();
