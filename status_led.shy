#!/bin/bash
LED_BOOT=18  # LED to indicate Raspberry Pi is booted
LED_HDMI_URL=22  # LED for HDMI and URL status
URL_TO_CHECK="http://localhost:3000"  # Change this to your required URL
GPIO_CHIP=/dev/gpiochip0  # Explicitly using gpiochip0
# Ensure gpiod is installed
if ! [ -x "/usr/bin/gpioset" ]; then
    echo "[ERROR] gpiod is not installed. Run: sudo apt install gpiod"
    exit 1
fi

echo "[INFO] Raspberry Pi booted. Boot LED is ON."
gpioset --mode=time --sec=0 $GPIO_CHIP $LED_BOOT=1
check_hdmi() {
    HDMI_STATUS=$(cat /sys/class/drm/card*-HDMI-A-1/status 2>/dev/null)
    echo "[DEBUG] HDMI status: $HDMI_STATUS"

    if [ "$HDMI_STATUS" = "connected" ]; then  # Use [ ... ] instead of [[ ... ]]
        echo "[INFO] HDMI is connected."
        return 0
    else
        echo "[WARNING] HDMI is not connected."
        return 1
    fi
}

check_url() {
    if curl -s --max-time 5 --head "$URL_TO_CHECK" | grep "200 OK" > /dev/null; then
        echo "[INFO] URL is accessible."
        return 0
    else
        echo "[WARNING] URL is not accessible."
        return 1
    fi
}

while true; do
    if ! check_hdmi; then
        echo "[INFO] Blinking LED slowly (HDMI not connected)"
        gpioset $GPIO_CHIP $LED_HDMI_URL=1  # Turn ON
        sleep 1
        gpioset $GPIO_CHIP $LED_HDMI_URL=0  # Turn OFF
        sleep 1
    else
        if ! check_url; then
		echo "[INFO] Blinking LED fast (URL not accessible)"
            gpioset $GPIO_CHIP $LED_HDMI_URL=1  # Turn ON
            sleep 0.2
            gpioset $GPIO_CHIP $LED_HDMI_URL=0  # Turn OFF
            sleep 0.2
        else
            echo "[INFO] Turning LED ON (HDMI and URL are OK)"
            gpioset $GPIO_CHIP $LED_HDMI_URL=1  # Keep LED ON
        fi
    fi
done
