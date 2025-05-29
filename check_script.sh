#!/bin/bash
# Function to log messages with timestamp and log level
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    echo "[$timestamp] [$level] [$message]" >> /home/UbiqCM4/url_check.log
    echo "[$timestamp] [$level] [$message]"
}

# Function to clean up old logs (keeping only last 24 hours)
cleanup_old_logs() {
    local log_file="/home/UbiqCM4/url_check.log"
    local temp_file="/home/UbiqCM4/url_check_temp.log"
    local cutoff_time=$(date -d "24 hours ago" "+%Y-%m-%d %H:%M:%S")

    log "INFO" "Cleaning up logs older than $cutoff_time"

    # Create a temporary file with only recent logs
    awk -v cutoff="$cutoff_time" '

        function parse_time(timestamp) {
            # Extract the timestamp part between square brackets
            gsub(/^\[|\].*$/, "", timestamp)
            return timestamp
        }

        {
            log_time = parse_time($0)
            if (log_time >= cutoff) {
                print $0
            }
        }
    ' "$log_file" > "$temp_file"

    # Replace the original log file with the filtered one
    mv "$temp_file" "$log_file"

    log "INFO" "Log cleanup completed"
}

# Variable to track previous status
PREVIOUS_STATUS="up"
# Counter for remaining F5 presses after recovery
REMAINING_F5_PRESSES=0
# Counter for log cleanup (24 hours = 1440 minutes, check every 60 seconds = 24 checks)
CLEANUP_COUNTER=24

while true; do
    URL="http://localhost:3000"

    log "INFO" "Checking URL: $URL"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $URL)

    if [ $HTTP_CODE -eq 200 ]; then
        log "INFO" "URL $URL is accessible (HTTP $HTTP_CODE)"

        # If we've just recovered from being down, set the counter for additional F5 presses
        if [ "$PREVIOUS_STATUS" = "down" ]; then
            log "INFO" "Page has just become accessible again, will press F5 5 more times"
            REMAINING_F5_PRESSES=5
        fi

	# If we still have remaining F5 presses to do
        if [ $REMAINING_F5_PRESSES -gt 0 ]; then
            log "DEBUG" "Pressing F5 after recovery ($REMAINING_F5_PRESSES remaining presses)"

            export DISPLAY=:0
            if xdotool key F5; then
                log "INFO" "Successfully pressed F5 key (post-recovery press)"
            else
                log "CRITICAL" "Failed to press F5 key (post-recovery press)"
            fi

            # Decrement the counter
            REMAINING_F5_PRESSES=$((REMAINING_F5_PRESSES - 1))
        fi

        PREVIOUS_STATUS="up"
    else
        log "CRITICAL" "URL $URL is NOT accessible (HTTP $HTTP_CODE)"

        # Log before attempting to press F5
        log "DEBUG" "Attempting to press F5 key due to inaccessibility"

        export DISPLAY=:0
        if xdotool key F5; then
            log "INFO" "Successfully pressed F5 key"
        else
            log "CRITICAL" "Failed to press F5 key"
        fi

        PREVIOUS_STATUS="down"
    fi

    # Decrement cleanup counter and perform cleanup if needed
    CLEANUP_COUNTER=$((CLEANUP_COUNTER - 1))
    if [ $CLEANUP_COUNTER -le 0 ]; then
        cleanup_old_logs
        CLEANUP_COUNTER=24  # Reset counter (will clean logs once per day)
    fi

    # Log that we're going to sleep
    log "DEBUG" "Sleeping for 10 seconds before next check"

    # Wait for 10 seconds before checking again
    sleep 10
done
