#!/bin/bash

# Always exit with code 0 to avoid exceptions at backend
trap 'exit 0' EXIT

# Privilige check
if [[ "$EUID" -ne 0 ]]; then
   echo "Script not running as root. Terminating..."
   exit 1
fi

# Argument check
if [[ $# -lt 2 ]]; then
    echo "Expected 2 commands. Exiting..."
    exit 1
fi

# Args
USERNAME="$1"
CMD="$2"

# Determine the user's shell
USER_SHELL=$(getent passwd "$USERNAME" | cut -d: -f7)

# Run the command as the specified user
OUTPUT=$(sudo -iu "$USERNAME" "$USER_SHELL" -c "$CMD" 2>&1)
echo "$OUTPUT"
exit 0