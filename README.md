# DiscOS

DiscOS is a secure interaction bridge between Discord and Linux servers, letting admins manage and users access their machines effortlessly. It’s easier to set up than SSH, and offers a richer set of features than traditional remote desktop solutions.

## Features

**You can use `/dcos` slash commands to:**

- Execute almost any command on the server as your local user
- Live-monitor (periodically execute) almost any command with the watch module
- Clear the previous replies for a smooth experience
- Send any type of file from your machine to the server
- Send any type of file from the server to your machine (to a Discord channel)
- Decide if the reply should only be visible to you, or everybody on the channel

**Admins can use `/admos` slash commands to:**

- Switch between standalone and external backend mode
- Enable or disable safemode
- Clear the previous replies for any user (or all users)
- Enable or disable users to use DiscOS
- Enable or disable DiscOS to be used on specific channels
- List all channels and users that can use DiscOS
- Manage admin access and list admins
- Enable lockdown mode (only admins can use DiscOS commands)
- Execute almost any command on the server as root
- Kill DiscOS

**You can use environment variables to:**

- Configure essential security features
- Limit maximum file and reply size
- Configure some amazing display options
- Configure bot and connection settings

**These security features keep you and your server safe:**

- All user input are escaped, so the shell cannot be abused
- Users can decide if the reply for their command is ephemeral or visible for all server users (who have permission to view the channel)
- In external backend mode, you can use an IPC server to validate payloads with DiscOS
- The one and only secret DiscOS uses is the bot token - no others keys or secrets needed
- Minimal logging - users deserve privacy
- DiscOS is open-source - see what's under the hood
- No need for open ports - DiscOS will make a secure outbound connection to Discord servers
- Files are sent over HTTPS through Discord CDN, the URL is not recorded, so only you can see what was sent
- The Discord API and Discord.js are used by millions of bots and users - DiscOS is built on a solid and reliable foundation

## Limitations

- Commands that are interactive (require user input) are not supported
- Discord API limitations apply
- Supported shell: `Bash` - all pseudoterminals are spawned using `Bash`
- The admin PTY is shared, meaning all admins will use a shared terminal

## Ways to use

- As a Systemd service
- As an [npm package](https://www.npmjs.com/package/discos)
- In a [Docker container](https://hub.docker.com/repository/docker/brni05/discos) (**non-rootless mode**)
- Compile the code and create an own solution

## Notice

Using DiscOS means you’re cool with the [Terms of Service](https://github.com/BrNi05/DiscOS/blob/main/.github/TERMS_OF_SERVICE.md) and the [Privacy Policy](https://github.com/BrNi05/DiscOS/blob/main/.github/PRIVACY_POLICY.md).

## Getting started

Please visit [DiscOS Wiki](https://github.com/BrNi05/DiscOS/wiki/01.-Home) for detailed documentation on setup and usage.

**Have fun using DiscOS!**
