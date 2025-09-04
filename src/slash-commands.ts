import { REST, Routes, SlashCommandBuilder } from 'discord.js';

// Helpers
import { validateDotenv } from './tools/validateDotenv';

// Consts and project-scoped types
import * as COMMON from './common';

export function registerSlashCommands(): void {
  // Load and validate environment variables
  if (!validateDotenv()) { process.exit(1); }

  // Create the /dcos subcommands
  const command = new SlashCommandBuilder()
    .setName(COMMON.DCOS)
    .setDescription(COMMON.DCOS_DESC)

    // /dcos exec <cmd> <hide?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.EXEC)
        .setDescription(COMMON.EXEC_DESC)
        .addStringOption((option) => option
          .setName(COMMON.CMD)
          .setDescription(COMMON.CMD_DESC)
          .setRequired(true))
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
    )

    // /dcos clear <lookback> <hide?> <verbose?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.CLEAR)
        .setDescription(COMMON.CLEAR_DESC)
        .addIntegerOption((option) => option
          .setName(COMMON.LOOKBACK)
          .setDescription(COMMON.LOOKBACK_DESC)
          .setMinValue(1)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName(COMMON.VERBOSE)
          .setDescription(COMMON.SUCCESS_VERBOSE)
          .setRequired(false))
    )

    // /dcos read <path> <hide?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.READ)
        .setDescription(COMMON.READ_DESC)
        .addStringOption((option) => option
          .setName(COMMON.PATH)
          .setDescription(COMMON.PATH_DESC_READ)
          .setAutocomplete(true)
          .setRequired(true))
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
    )

    // /dcos write <path> <file> <hide?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.WRITE)
        .setDescription(COMMON.WRITE_DESC)
        .addAttachmentOption(option => option
          .setName(COMMON.FILE)
          .setDescription(COMMON.FILE_DESC)
          .setRequired(true))
        .addStringOption((option) => option
          .setName(COMMON.PATH)
          .setDescription(COMMON.PATH_DESC_WRITE)
          .setAutocomplete(true)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
    )

    // /dcos watch <target> <interval> <repeat> <hide?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.WATCH)
        .setDescription(COMMON.WATCH_DESC)
        .addStringOption((option) => option
          .setName(COMMON.TARGET)
          .setDescription(COMMON.TARGET_DESC)
          .setRequired(true))
        .addIntegerOption((option) => option
          .setName(COMMON.INTERVAL)
          .setDescription(COMMON.INTERVAL_DESC)
          .setMinValue(500)
          .setMaxValue(5000)
          .setRequired(false))
        .addIntegerOption((option) => option
          .setName(COMMON.REPEAT)
          .setDescription(COMMON.REPEAT_DESC)
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
    )

    // /dcos debug
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.DEBUG)
        .setDescription(COMMON.DEBUG_DESC)
        .addBooleanOption((option) => option
          .setName(COMMON.HIDE)
          .setDescription(COMMON.HIDE_REPLY)
          .setRequired(false))
    );

  // Create the /admos subdommands
  const adminCommand = new SlashCommandBuilder()
    .setName(COMMON.ADMOS)
    .setDescription(COMMON.ADMOS_DESC)
    // /admos kill
    // Shuts down the DiscOS instance
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.KILL)
        .setDescription(COMMON.KILL_DESC)
    )
    // /admos mode <standalone?>
    // Toggle to use an external backend or use DiscOS's own backend solution
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.MODE)
        .setDescription(COMMON.MODE_DESC)
        .addBooleanOption((option) => option
          .setName(COMMON.STANDALONE)
          .setDescription(COMMON.STANDALONE_DESC)
          .setRequired(true))
    )

    // /admos safemode <true?>
    // Turn on/off the command validation feature
    // Only has an effect if DiscOS is not running in standalone mode
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.SAFEMODE)
        .setDescription(COMMON.SAFEMODE_DESC)
        .addBooleanOption((option) => option
          .setName(COMMON.CMD_VAL)
          .setDescription(COMMON.CMD_VAL_DESC)
          .setRequired(true))
    )

    // /admos clear <user/all> <lookback> <verbose?>
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.CLEAR)
        .setDescription(COMMON.ADMIN_CLEAR_DESC)
        .addUserOption((option) => option
          .setName(COMMON.CLEAR_USER)
          .setDescription(COMMON.CLEAR_USER_DESC)
          .setRequired(false))
        .addIntegerOption((option) => option
          .setName(COMMON.LOOKBACK)
          .setDescription(COMMON.LOOKBACK_DESC)
          .setMinValue(1)
          .setRequired(false))
        .addBooleanOption((option) => option
          .setName(COMMON.VERBOSE)
          .setDescription(COMMON.SUCCESS_VERBOSE)
          .setRequired(false))
    )

    // /admos usermgmt <user> <localProfile> <add?/remove?>
    // Add/remove a user to/from the local db
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.USER_MGMT)
        .setDescription(COMMON.USER_MGMT_DESC)
        .addUserOption((option) => option
          .setName(COMMON.USER)
          .setDescription(COMMON.USER_SEL)
          .setRequired(true))
        .addStringOption((option) => option
          .setName(COMMON.LOCAL_USER)
          .setDescription(COMMON.LOCAL_USER_DESC)
          .setRequired(true))
        .addBooleanOption((option) => option
          .setName(COMMON.OPERATION)
          .setDescription(COMMON.ADDRM)
          .setRequired(true))
    )

    // /admos lsu
    // List all the server users and their Discord UIDs
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.LSU)
        .setDescription(COMMON.LSU_DESC)
    )

    // /admos adminmgmt <user> <add?/remove?>
    // Add/remove a user to/from the admin list
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.ADMIN_MGMT)
        .setDescription(COMMON.ADMIN_MGMT_DESC)
        .addUserOption((option) => option
          .setName(COMMON.USER)
          .setDescription(COMMON.USER_SEL)
          .setRequired(true))
        .addBooleanOption((option) => option
          .setName(COMMON.OPERATION)
          .setDescription(COMMON.ADDRM)
          .setRequired(true))
    )

    // /admos lsa
    // List all the admins and their Discord UIDs
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.LSA)
        .setDescription(COMMON.LSA_DESC)
    )

    // /admos chmgmt <channel> <add?/remove?>
    // Add/remove a channel to/from the list of channels that DiscOS can be used on
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.CH_MGMT)
        .setDescription(COMMON.CH_MGMT_DESC)
        .addChannelOption((option) => option
          .setName(COMMON.CHANNEL)
          .setDescription(COMMON.CHANNEL_DESC)
          .setRequired(true))
        .addBooleanOption((option) => option
          .setName(COMMON.OPERATION)
          .setDescription(COMMON.LOCKDOWN_ENABLED)
          .setRequired(true))
    )

    // /admos lockdown <true?>
    // Turn on/off the lockdown mode (no commands can be executed, only admin commands)
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.LOCKDOWN)
        .setDescription(COMMON.LOCKDOWN_DESC)
        .addBooleanOption((option) => option
          .setName(COMMON.ENABLED)
          .setDescription(COMMON.LOCKDOWN_ENABLED)
          .setRequired(true))
    )

    // /admos root <command>
    // Execute a command as root on the host
    .addSubcommand((sub) =>
      sub
        .setName(COMMON.ROOT)
        .setDescription(COMMON.ROOT_DESC)
        .addStringOption((option) => option
          .setName(COMMON.CMD)
          .setDescription(COMMON.CMD_DESC)
          .setRequired(true))
    );

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN!);

  // Registers the command (to be used) on our servers (but not globally)
  const guildIds = process.env.GUILD_IDS!.split(',').map((id) => id.trim());

  (async () => {
    for (const guildId of guildIds) {
      try {
        await rest.put(Routes.applicationGuildCommands(process.env.APP_ID!, guildId), { body: [command.toJSON(), adminCommand.toJSON()] });
        console.log(`${COMMON.CMD_REG_1} ${guildId}`);
      } catch (err) {
        console.error(`${COMMON.CMD_REG_2} ${guildId}`, err);
      }
    }
  })().catch((err) => {
    console.error(COMMON.CMD_REG_ERR, err);
  });
}

// Run slash command building if it is run directly with Node
if (require.main === module) {
  registerSlashCommands();
}
