
#!/bin/bash

# Initialize the previous HDMI status
PREV_STATUS="connected"

# Function to check HDMI status
check_hdmi() {
    HDMI_STATUS=$(cat /sys/class/drm/card*-HDMI-A-1/status 2>/dev/null)
    echo "[DEBUG] HDMI status: $HDMI_STATUS"

    # If status changed from disconnected to connected, execute command
    if [ "$HDMI_STATUS" = "connected" ] && [ "$PREV_STATUS" = "disconnected" ]; then
        echo "[WARNING] HDMI has been disconnected. Stopping user.slice..."
        sudo systemctl stop user.slice
    fi

    # Update previous status
    PREV_STATUS="$HDMI_STATUS"
}

# Run the check every 30 seconds in an infinite loop
while true; do
    check_hdmi
    sleep 15
done
