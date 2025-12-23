#!/bin/bash

############### Cleanup ###############
cleanup() {
   echo -e "\nCleaning up..."
   rm -rf "$TEMP_DIR"
}


############### Trap ###############
trap '
EXIT_CODE=$?
cleanup
if [ $EXIT_CODE -eq 0 ]; then
    echo -e "DiscOS installation completed successfully.\n"
else
    echo -e "DiscOS installation aborted!\n"
fi' EXIT


############### Privilige check ###############
if [[ "$EUID" -ne 0 ]]; then
   echo "DiscOS install script must run as root."
   exit 1
fi


############### Error management ###############
set -e
on_error() { echo "DiscOS install script failed. Error on line: $1."; }
trap 'on_error $LINENO' ERR


############### Distro-agnostic package installer ###############
need() {
   PKG="$1"

   # Check if the binary is already installed
   if command -v "$PKG" >/dev/null 2>&1; then
      return 0
   fi

   echo "Installing $PKG..."

   if command -v apt-get >/dev/null 2>&1; then
        apt-get update -y && apt-get install -y "$PKG"
   elif command -v dnf >/dev/null 2>&1; then
        dnf install -y "$PKG"
   elif command -v yum >/dev/null 2>&1; then
        yum install -y "$PKG"
   elif command -v zypper >/dev/null 2>&1; then
        zypper install -y "$PKG"
   elif command -v pacman >/dev/null 2>&1; then
        pacman -S --noconfirm "$PKG"
   elif command -v apk >/dev/null 2>&1; then
        apk add "$PKG"
   else
        echo "No supported package manager found. Please install $PKG manually."
        return 1
   fi
}


############### Preparation ###############
echo -e "\nStarting DiscOS installation..."

echo -e "\nInstalling dependencies..."

# Install deps for this script
need sed
need awk
need grep # DiscOS deps as well
need git
need curl # DiscOS deps as well
need tee
need tail

# Install deps for DiscOS
need cat
need base64
need dos2unix
need realpath
need head

echo -e "All dependencies installed."


# Clone the DiscOS repository to a temp directory
echo -e "\nCloning DiscOS repository into a temporary directory..."

TEMP_DIR=$(mktemp -d)
chmod 777 "$TEMP_DIR" # discos user (Systemd install) can access it

if ! git clone --branch main --single-branch --depth 1 https://github.com/BrNi05/DiscOS.git "$TEMP_DIR" &>/dev/null; then
   echo "Failed to clone DiscOS repository."
   exit 1
fi

cd "$TEMP_DIR" || (echo "Failed to enter temp directory." && exit 1)


############### .env setup ###############
setup_dotenv() {
   local OPERATOR="$1"
   
   echo -e "\nSetting up .env file..."

   read -rp "If not already, set up your bot. Refer to the docs: https://github.com/BrNi05/DiscOS/wiki/03.-Creating-your-bot. Press any key to continue..."

   echo
   read -rp "Enter your bot token: " BOT_TOKEN
   read -rp "Enter your bot's app ID (Application ID): " APP_ID
   read -rp "Enter the IDs of the servers where the bot should be active (comma-separated): " GUILD_IDS
   read -rp "Select command queue max size (press Enter for default: 50): " CMD_QUEUE_SIZE
   read -rp "Enter external backend URL (if not used, press Enter): " EXTERNAL_BACKEND_URL
   read -rp "Enter max size for file uploads in MB (press Enter for default: 8): " MAX_FILE_SIZE_MB
   read -rp "Choose text editor overrides (press Enter for default: nano,less,cat,more,vim): " TEXT_EDITOR_OVERRIDES
   read -rp "Choose QuickView filextensions (press Enter for default: .txt,.log,.md,.mdx,.json,.yaml,.yml,.html,.sh,.conf,.csv,.xml,.env,.): " QUICKVIEW_FILE_EXTENSIONS
   read -rp "Choose QuickView max text length (press Enter for default: 2000): " QUICKVIEW_MAX_TEXT_LENGTH

   DOTENV="$TEMP_DIR/setup/.env"

   sed -i "s/^BOT_TOKEN=.*/BOT_TOKEN=$BOT_TOKEN/" "$DOTENV"
   sed -i "s/^APP_ID=.*/APP_ID=$APP_ID/" "$DOTENV"
   sed -i "s/^GUILD_IDS=.*/GUILD_IDS=$GUILD_IDS/" "$DOTENV"
   [ -n "$CMD_QUEUE_SIZE" ] && sed -i "s/^CMD_QUEUE_MAX_SIZE=.*/CMD_QUEUE_MAX_SIZE=$CMD_QUEUE_SIZE/" "$DOTENV"
   [ -n "$EXTERNAL_BACKEND_URL" ] && sed -i "s|^BACKEND=.*|BACKEND=$EXTERNAL_BACKEND_URL|" "$DOTENV"
   [ -n "$MAX_FILE_SIZE_MB" ] && sed -i "s/^FILE_MAX_SIZE=.*/FILE_MAX_SIZE=$MAX_FILE_SIZE_MB/" "$DOTENV"
   [ -n "$TEXT_EDITOR_OVERRIDES" ] && sed -i "s|^READ_BIN_OVERRIDE=.*|READ_BIN_OVERRIDE=$TEXT_EDITOR_OVERRIDES|" "$DOTENV"
   [ -n "$QUICKVIEW_FILE_EXTENSIONS" ] && sed -i "s|^QUICK_VIEW=.*|QUICK_VIEW=$QUICKVIEW_FILE_EXTENSIONS|" "$DOTENV"
   [ -n "$QUICKVIEW_MAX_TEXT_LENGTH" ] && sed -i "s/^QUICK_VIEW_MAX_LENGTH=.*/QUICK_VIEW_MAX_LENGTH=$QUICKVIEW_MAX_TEXT_LENGTH/" "$DOTENV"

   if [ "$OPERATOR" = "write" ]; then
      # Copy .env from CWD to discos home
      cp "$DOTENV" "$DISCOS_HOME/.env"
      chown discos:discos "$DISCOS_HOME/.env"
      chmod 660 "$DISCOS_HOME/.env"
   elif [ "$OPERATOR" = "disp" ]; then
      echo -e "\nGenerated .env content:\n"
      cat "$DOTENV"
      echo -e "\n\nSupply these env vars to your environment as needed."
   else
      # A path was provided - generating there
      cp "$DOTENV" "$OPERATOR/.env"
      chown root:root "$OPERATOR/.env"
      chmod 660 "$OPERATOR/.env"
   fi

   # Security - since the temp dir can be accessed by any user
   rm -f "$DOTENV"

   echo -e "\n.env setup process completed."
}


############### DB setup ###############
setup_db() {
   local OPERATOR="$1"

   echo -e "\nCreating the initial database..."

   echo -e "You will be added as a DiscOS admin.\n"

   read -rp "Enter your Discord UID: " DISCORD_UID
   read -rp "Enter the local username that you want to use as the given Discord user: " LOCAL_USERNAME
   read -rp "Enter a single channel ID which DiscOS has already joined: " CHANNEL_ID

   # Disable standalone mode by default for Docker releases
   echo -e "\nIf you plan to run DiscOS in a Docker container in EB mode, modify the DB, so that the container is started in standalone mode!"
   echo "Otherwise, if the prevoiusly set local user does not exist, DiscOS will fail to start."

   DB="$TEMP_DIR/setup/db.json"

   sed -i "s/DC_UID/$DISCORD_UID/g" "$DB"
   sed -i "s/LOCAL_USER/$LOCAL_USERNAME/g" "$DB"
   sed -i "s/CHANNEL_ID/$CHANNEL_ID/g" "$DB"

   if [ "$OPERATOR" = "write" ]; then
      # Copy db.json from CWD to discos home
      cp "$DB" "$DISCOS_HOME/db.json"
      chown discos:discos "$DISCOS_HOME/db.json"
      chmod 660 "$DISCOS_HOME/db.json"
   elif [ "$OPERATOR" = "disp" ]; then
      echo -e "\nManually create the db.json file where needed."
      echo -e "Generated db.json content:\n"
      cat "$DB"
      echo
   else
      # A path was provided - generating there

      # Docker release overrides
      sed -i "s/true,/false,/g" "$DB"

      cp "$DB" "$OPERATOR/db.json"
      chown root:root "$OPERATOR/db.json"
      chmod 660 "$OPERATOR/db.json"
   fi

   # Security - since the temp dir can be accessed by any user
   rm -f "$DB"

   echo
   echo "Some default values were set:"
   echo "   - Standalone mode: enabled"
   echo "   - Safemode: enabled"
   echo "   - Lockdown mode: disabled"
   echo "You can change these settings with admos slash commands later."

   echo -e "\nDatabase setup process completed."
}


############### Node.js LTS updater ###############
setup_node_updater() {
   echo -e "\nAn updater script will be installed and a Systemd service will be created to keep Node.js up to date."
   echo "NOTE: old Node.js versions will NOTE be removed automatically."

   SCRIPT_PATH='/usr/local/bin/update-node.sh'
   printf '%s\n' '#!/bin/bash' \
   'export NVM_DIR="$HOME/.nvm"' \
   '[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"' \
   '' \
   'nvm install --lts' > "$SCRIPT_PATH"

   chown discos:discos "$SCRIPT_PATH"
   chmod 770 "$SCRIPT_PATH"

   printf '%s\n' \
   '[Unit]' \
   'Description=Update Node.js LTS for discos user' \
   '' \
   '[Service]' \
   'Type=oneshot' \
   'User=discos' \
   "ExecStart=$SCRIPT_PATH" \
   > /etc/systemd/system/discos-node-updater.service

   printf '%s\n' \
   '[Unit]' \
   'Description=Run Node.js LTS update daily' \
   '' \
   '[Timer]' \
   'OnCalendar=daily' \
   'Persistent=true' \
   '' \
   '[Install]' \
   'WantedBy=timers.target' \
   > /etc/systemd/system/discos-node-updater.timer

   systemctl daemon-reload
   systemctl enable --now discos-node-updater.timer

   echo -e "Node.js updater script and service installed."
}


############### Compose setup ###############
setup_compose() {
   echo -e "\nSetting up compose file...\n"

   echo "The latest DiscOS image will be used. In case of an update, be sure to manually pull the new image."

   read -rp "Container name (default DiscOS): " CONTAINER_NAME
   sed -i "s/SERVICE_NAME/${CONTAINER_NAME:-DiscOS}/g" "$COMPOSE_FILE"
   sed -i "s/CONTAINER_NAME/${CONTAINER_NAME:-DiscOS}/g" "$COMPOSE_FILE"

   read -rp "Logging will use json-file driver. Choose max size (default 10M): " LOG_MAX_SIZE
   sed -i "s/MAX_LOG_SIZE/${LOG_MAX_SIZE:-10M}/g" "$COMPOSE_FILE"

   read -rp "Choose max number of log files to keep (default 3): " LOG_MAX_FILE
   sed -i "s/MAX_LOG_COUNT/${LOG_MAX_FILE:-3}/g" "$COMPOSE_FILE"

   echo
}


############### Systemd release ###############
install_systemd() {
   echo -e "\nStarting Systemd release installation..."

   if ! id -u discos &>/dev/null; then
      useradd --system -m -s "$(command -v nologin)" discos
      echo "Created system user: discos. DiscoS will run as root but use this user for storage and Node.js installation."
   fi

   DISCOS_HOME=$(getent passwd discos | cut -d: -f6)

   DISCOS_DIR="$DISCOS_HOME/DiscOS"

   if [[ "$1" != "update" ]]; then
      echo -e "\nSetting up Node.js..."
      read -rp "Do you have a global / user-scoped Node.js install (y/n)? " NODE_ANSWER
      if [[ "$NODE_ANSWER" = "y" || "$NODE_ANSWER" = "Y" ]]; then
         if ! sudo -u discos bash -euo pipefail -c '
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
            command -v node
         ' >/dev/null 2>&1; then
            echo "ERROR: Node.js not found."
            exit 1
         fi
      else
         echo -e "\nInstalling Node.js via nvm..."
         sudo -u discos bash -euo pipefail -c '
         export NVM_DIR="$HOME/.nvm"
         curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
         [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
         nvm install --lts
         nvm use --lts
         '

         echo -e "Node.js installed."
         setup_node_updater
      fi

      # .env setup
      setup_dotenv "write"

      # DB setup
      setup_db "write"

      # Set up ownership and permissions
      chown -R root:discos "$DISCOS_DIR"
      chmod -R 770 "$DISCOS_DIR"
   else
      # Stop the service for before the update process
      systemctl stop discos.service || echo "DiscOS service could not be stopped."
   fi

   # Compile DiscOS
   echo -e "\nCompiling DiscOS..."
   DISCOS_DIR="$DISCOS_HOME"

   sudo -u discos bash -euo pipefail -c "
   TEMP_DIR=\"$TEMP_DIR\"
   DISCOS_DIR=\"$DISCOS_DIR\"

   # Source nvm
   export NVM_DIR=\"\$HOME/.nvm\"
   [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"

   # Build in the temp dir
   cd \"\$TEMP_DIR\" || { echo 'Failed to enter temp download directory.'; exit 1; }
   echo \"CWD: \$TEMP_DIR\"
   echo 'Installing dependencies...'
   npm ci --omit=optional --silent
   npm run build

   # Copy dist and install only prod deps
   mkdir -p \"\$DISCOS_DIR\"
   rm -rf \"\$DISCOS_DIR/dist\"
   cp -r \"\$TEMP_DIR/dist\" \"\$DISCOS_DIR\"
   cp \"\$TEMP_DIR/package.json\" \"\$DISCOS_DIR\"
   cp \"\$TEMP_DIR/package-lock.json\" \"\$DISCOS_DIR\"
   chmod -R 770 \"\$DISCOS_DIR\"

   cd \"\$DISCOS_DIR\" || { echo 'Failed to enter DiscOS directory.'; exit 1; }
   npm ci --silent --omit=dev --omit=optional

   # Remove package.json and package-lock.json
   rm -f package*.json
   "

   echo -e "\nDiscOS compiled successfully."

   if [[ "$1" != "update" ]]; then
      # Systemd service and timer setup
      echo -e "\nSetting up DiscOS service..."
      SERVICE_FILE="$TEMP_DIR/setup/discos.service"

      read -rp "If you have a template service for error handling, enter its name (like: error@.service -> enter: error). If not, press Enter: " ERROR_SERVICE
      if [ -n "$ERROR_SERVICE" ]; then
         sed -i "s/ERROR/$ERROR_SERVICE/g" "$SERVICE_FILE"
      else
         sed -i '/^OnFailure=ERROR@%n\.service$/d' "$SERVICE_FILE"
      fi

      sed -i "s|WD_PATH|$DISCOS_DIR|g" "$SERVICE_FILE"

      cp "$SERVICE_FILE" /etc/systemd/system/discos.service
      rm -f "$SERVICE_FILE"
      systemctl daemon-reload

      read -rp "Do you want DiscOS to start on every boot? (y/n): " START_ON_BOOT
      if [[ "$START_ON_BOOT" == "y" || "$START_ON_BOOT" == "Y" ]]; then
         systemctl enable discos.service
      fi

      read -rp "Do you want DiscOS to start now? (y/n): " START_NOW
      if [[ "$START_NOW" == "y" || "$START_NOW" == "Y" ]]; then
         systemctl start discos.service
      fi

      echo -e "\nBe sure the regulary check for updates. You can use this script to install a new version."

      echo -e "DiscOS service setup completed."
   else
      systemctl start discos.service
      echo -e "\nDiscOS updated successfully."
   fi
}


############### npm package release ###############
install_npm() {
   echo -e "\nStarting npm package release installation...\n"

   read -rp "Do you plan to run your code in a Docker container (y/Y) or not (n/N)? " IN_DOCKER
   if [[ "$IN_DOCKER" = "y" || "$IN_DOCKER" = "Y" ]]; then
      COMPOSE_FILE="$TEMP_DIR/setup/docker-compose.yaml"
      setup_compose
      echo -e "Compose file will be displayed below. Now, rewrite it according to your needs but make sure mounts and env var settings are kept.\n"
      cat "$COMPOSE_FILE"
      echo
   else
      echo "Maybe Systemd then... make sure env vars are loaded into the service."
   fi

   echo

   read -rp "Press any key to continue with .env generation. It will only be displayed, copy it where needed."
   setup_dotenv "disp"

   echo

   read -rp "Press any key to continue with database generation. It will only be displayed, copy it where needed."
   setup_db "disp"

   echo -e "\nnpm release installation process completed."
}


############### Docker release ###############
install_docker() {
   echo -e "\nStarting Docker release installation..."

   COMPOSE_FILE="$TEMP_DIR/setup/docker-compose.yaml"
   setup_compose

   read -rp "Do you have an existing compose file (y/Y) or should the script generate on for you (n/N)? " COMPOSE_EXIST

   if [[ "$COMPOSE_EXIST" = "y" || "$COMPOSE_EXIST" = "Y" ]]; then
      echo -e "DiscOS installer will now display the service:\n"
      tail -n +2 "$COMPOSE_FILE"
      echo
      echo -e "\nPaste this into your compose file."

      echo
      read -rp "Provide the absolute path to to the directory where your compose file is: " COMPOSE_PATH
      cd "$COMPOSE_PATH" || (echo "Failed to enter compose file directory." && exit 1)
   else
      echo "DiscOS installer will now generate the compose file..."

      echo
      read -rp "Provide the absolute path to to the directory where your compose should be: " COMPOSE_PATH
      cd "$COMPOSE_PATH" || (echo "Failed to enter compose file directory." && exit 1)
      cp "$COMPOSE_FILE" "$COMPOSE_PATH/docker-compose.yaml"
      chown root:root "$COMPOSE_PATH/docker-compose.yaml"
      chmod 660 "$COMPOSE_PATH/docker-compose.yaml"
   fi

   echo

   read -rp "Press any key to continue with .env generation. It will be located in the compose file dir."
   setup_dotenv "$COMPOSE_PATH"

   echo

   read -rp "Press any key to continue with database generation. It will be located in the compose file dir."
   setup_db "$COMPOSE_PATH"

   echo -e "\nDocker release installation process completed."
}


############### Systemd update mode ###############
if [[ "$1" == "update" ]]; then
   install_systemd "update"
   exit 0
fi


############### Release selection ###############

echo -e "\nHow do you want to use DiscOS?"
echo "  1 - as a Systemd service"
echo "  2 - as an npm package"
echo "  3 - in a Docker container"
echo "  4 - other"

read -rp "Enter your choice (1-4): " INSTALL_TYPE

case $INSTALL_TYPE in
   1)
      install_systemd
      ;;
   2)
      install_npm
      ;;
   3)
      install_docker
      ;;
   4)
      echo -e "\nPlease refer to the documentation for more information: https://github.com/BrNi05/DiscOS/wiki/01.-Home"
      ;;
   *)
      echo "Invalid choice."
      exit 1
      ;;
esac
