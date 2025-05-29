document.addEventListener('DOMContentLoaded', () => {
    const widgetContainer = document.getElementById('widget-container');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refresh-btn');

    const parameterUnits = {
        'AQI': '',
        'Temperature': '°C',
        'PM1.0': 'µg/m³',
        'Humidity': '%RH',
        'PM2.5': 'µg/m³',
        'PM10': 'µg/m³',
        'O2': '%',
        'CO2': 'ppm',
        'TVOC': 'µg/m³'
    };

    const parameterRanges = {
        'AQI': { min: 0, max: 500, good: 50, moderate: 100 },
        'Temperature': { min: 0, max: 104, good: 68, moderate: 77 },
        'PM1.0': { min: 0, max: 110, good: 90, moderate: 101 },
        'Humidity': { min: 0, max: 100, good: 30, moderate: 60 },
        'PM2.5': { min: 0, max: 100, good: 12, moderate: 35 },
        'PM10': { min: 0, max: 100, good: 20, moderate: 50 },
        'O2': { min: 0, max: 100, good: 19, moderate: 23 },
        'CO2': { min: 0, max: 2000, good: 250, moderate: 1000 },
        'TVOC': { min: 0, max: 2000, good: 450, moderate: 1000 }
    };

    const parameterDescriptions = {
        'AQI': 'Air Quality Index based on PM2.5, PM10, and O2 levels (0-500 scale)',
        'Temperature': 'Measures the ambient temperature in Celsius.',
        'PM1.0': 'Measures atmospheric PM1.0 in hectopascals (Kpa).',
        'Humidity': 'Measures the relative humidity in percentage (%RH).',
        'PM2.5': 'Measures particulate matter (2.5 micrometers) in µg/m³.',
        'PM10': 'Measures particulate matter (10 micrometers) in µg/m³.',
        'O2': 'Measures oxygen concentration in percentage (%Vol).',
        'CO2': 'Measures carbon dioxide concentration in parts per million (ppm).',
        'TVOC': 'Measures total volatile organic compounds in parts per billion (ppb).'
    };

    const graphData = {
        'Temperature': [],
        'Humidity': [],
        'PM2.5': [],
        'PM10': []
    };
    const maxDataPoints = 15;
    const chartInstances = {};
    let lastSuccessfulData = null;

    const fiveMinInterval = 1 * 60 * 1000;
    let lastSavedTime = Date.now();

    const formatDateTime = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const time = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        const dayName = now.toLocaleDateString('en-US', { weekday: 'short' });
        return {
            date: `${dayName}, ${day}/${month}/${year}`,
            time: `${time}`
        };
    };

    const updateDateTime = () => {
        const timestampDateSpan = document.getElementById('aqi-timestamp-date');
        const timestampTimeSpan = document.getElementById('aqi-timestamp-time');
        if (timestampDateSpan && timestampTimeSpan) {
            const { date, time } = formatDateTime();
            timestampDateSpan.textContent = date;
            timestampTimeSpan.textContent = time;
        }
    };

    const calculateAQI = (pm25, pm10, o2) => {
        if (pm25 === null || pm10 === null || o2 === null ||
            pm25 === undefined || pm10 === undefined || o2 === undefined ||
            isNaN(pm25) || isNaN(pm10) || isNaN(o2)) {
            return null;
        }

        const pm25Breakpoints = [
            { low: 0, high: 12, aqiLow: 0, aqiHigh: 50 },
            { low: 12.1, high: 35.4, aqiLow: 51, aqiHigh: 100 },
            { low: 35.5, high: 55.4, aqiLow: 101, aqiHigh: 150 },
            { low: 55.5, high: 150.4, aqiLow: 151, aqiHigh: 200 },
            { low: 150.5, high: 250.4, aqiLow: 201, aqiHigh: 300 },
            { low: 250.5, high: 500.4, aqiLow: 301, aqiHigh: 500 }
        ];

        const pm10Breakpoints = [
            { low: 0, high: 54, aqiLow: 0, aqiHigh: 50 },
            { low: 55, high: 154, aqiLow: 51, aqiHigh: 100 },
            { low: 155, high: 254, aqiLow: 101, aqiHigh: 150 },
            { low: 255, high: 354, aqiLow: 151, aqiHigh: 200 },
            { low: 355, high: 424, aqiLow: 201, aqiHigh: 300 },
            { low: 425, high: 604, aqiLow: 301, aqiHigh: 500 }
        ];

        let aqiPM25 = 0;
        for (const bp of pm25Breakpoints) {
            if (pm25 >= bp.low && pm25 <= bp.high) {
                aqiPM25 = ((bp.aqiHigh - bp.aqiLow) / (bp.high - bp.low)) * (pm25 - bp.low) + bp.aqiLow;
                break;
            }
        }

        let aqiPM10 = 0;
        for (const bp of pm10Breakpoints) {
            if (pm10 >= bp.low && pm10 <= bp.high) {
                aqiPM10 = ((bp.aqiHigh - bp.aqiLow) / (bp.high - bp.low)) * (pm10 - bp.low) + bp.aqiLow;
                break;
            }
        }

        let o2Factor = 1;
        if (o2 < 19) o2Factor = 1.2;
        else if (o2 > 23) o2Factor = 0.9;

        const finalAQI = Math.min(500, Math.max(aqiPM25, aqiPM10) * o2Factor).toFixed(2);
        return finalAQI;
    };

    const fetchModbusData = async () => {
        try {
            console.log('Fetching data from http://localhost:5500/api/modbus-data');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const response = await fetch('http://localhost:5500/api/modbus-data', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} - ${response.statusText}`);
            }
            const data = await response.json();
            console.log('Data received:', data);
            lastSuccessfulData = data;
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            errorMessage.textContent = `Error: ${error.message}`;

            if (lastSuccessfulData) {
                return lastSuccessfulData.map(widget => ({
                    ...widget,
                    value: null
                }));
            } else {
                return [
                    { title: 'Temperature', value: null },
                    { title: 'Humidity', value: null },
                    { title: 'PM1.0', value: null },
                    { title: 'PM2.5', value: null },
                    { title: 'PM10', value: null },
                    { title: 'O2', value: null },
                    { title: 'CO2', value: null },
                    { title: 'TVOC', value: null }
                ];
            }
        }
    };

    const drawGauge = (ctx, x, y, radius, value, min, max, good, moderate, title, unit) => {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const validValue = (value === null || value === undefined || isNaN(value)) ? min : value;
        const percentage = ((validValue - min) / (max - min)) * 100;
        const startAngle = -Math.PI;
        const endAngle = Math.PI;
        const fillAngle = startAngle + (percentage / 100) * (endAngle - startAngle);

        ctx.beginPath();
        ctx.arc(x, y, radius, startAngle, endAngle, false);
        ctx.lineWidth = 25;
        ctx.strokeStyle = '#e0e0e0';
        ctx.stroke();

        if (value !== null && value !== undefined && !isNaN(value)) {
            if (title === 'AQI') {
                const totalAngle = endAngle - startAngle;
                const transitionWidth = 0.05 * totalAngle;

                const angle25 = startAngle + (0.25 * totalAngle);
                const angle50 = startAngle + (0.50 * totalAngle);
                const angle75 = startAngle + (0.75 * totalAngle);

                const colors = {
                    green: '#4F7942',
                    yellow: '#ffff00',
                    pink: '#ff69b4',
                    red: '#ff0000'
                };

                ctx.beginPath();
                ctx.arc(x, y, radius, startAngle, fillAngle, false);
                ctx.lineWidth = 25;

                if (fillAngle <= angle25) {
                    ctx.strokeStyle = colors.green;
                } else if (fillAngle <= angle50) {
                    let gradient = ctx.createLinearGradient(
                        x + radius * Math.cos(startAngle),
                        y + radius * Math.sin(startAngle),
                        x + radius * Math.cos(fillAngle),
                        y + radius * Math.sin(fillAngle)
                    );
                    gradient.addColorStop(0, colors.green);
                    gradient.addColorStop(1, colors.yellow);
                    ctx.strokeStyle = gradient;
                } else if (fillAngle <= angle75) {
                    let gradient = ctx.createLinearGradient(
                        x + radius * Math.cos(startAngle),
                        y + radius * Math.sin(startAngle),
                        x + radius * Math.cos(fillAngle),
                        y + radius * Math.sin(fillAngle)
                    );
                    gradient.addColorStop(0, colors.green);
                    gradient.addColorStop(0.33, colors.yellow);
                    gradient.addColorStop(0.66, colors.pink);
                    gradient.addColorStop(1, colors.red);
                    ctx.strokeStyle = gradient;
                } else {
                    let gradient = ctx.createLinearGradient(
                        x + radius * Math.cos(startAngle),
                        y + radius * Math.sin(startAngle),
                        x + radius * Math.cos(fillAngle),
                        y + radius * Math.sin(fillAngle)
                    );
                    gradient.addColorStop(0, colors.green);
                    gradient.addColorStop(0.33, colors.yellow);
                    gradient.addColorStop(0.66, colors.pink);
                    gradient.addColorStop(1, colors.red);
                    ctx.strokeStyle = gradient;
                }
                ctx.stroke();

                [angle25, angle50, angle75].forEach(angle => {
                    ctx.beginPath();
                    ctx.arc(x, y, radius, angle - 0.01, angle + 0.01, false);
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
                    ctx.stroke();
                });
            } else {
                ctx.beginPath();
                ctx.arc(x, y, radius, startAngle, fillAngle, false);
                ctx.lineWidth = 25;
                ctx.strokeStyle = '#558a4a';
                ctx.stroke();
            }
        }

        const displayValue = (value === null || value === undefined || isNaN(value)) ? 'NA' : `${value}${unit}`;
        ctx.font = title === 'AQI' ? 'bold 32px Roboto' : 'bold 25px Roboto';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayValue, x, y);
    };

    const getAQIHealthStatus = (aqi) => {
        if (aqi === null || aqi === undefined || isNaN(aqi)) return 'Unknown';
        if (aqi <= 50) return 'Healthy';
        if (aqi <= 100) return 'Clean';
        if (aqi <= 150) return 'Good';
        if (aqi <= 200) return 'Moderate';
        if (aqi <= 300) return 'Unhealthy';
        return 'Hazardous';
    };

    const getAQIBackgroundColor = (aqi) => {
        if (aqi === null || aqi === undefined || isNaN(aqi)) return '#ffffff';
        if (aqi <= 70) return '#17B169';
        if (aqi <= 150) return '#17B169';
        if (aqi <= 190) return '#c4cd04';
        if (aqi <= 240) return '#c4cd04';
        if (aqi <= 300) return '#f14e4e';
        return '#f14e4e';
    };

    const createWidget = (title, value, unit) => {
        const canvasIdGauge = `gauge-${title.replace(/\s+/g, '-')}`;
        const isAQI = title === 'AQI';
        const { date, time } = formatDateTime();
        const widgetHTML = isAQI ? `
            <div class="widget-item aqi-widget">
                <div class="card aqi-top-card">
                    <div class="aqi-image-container">
                        <img src="AVL.png" class="aqi-image">
                    </div>
                </div>
                <div class="card aqi-bottom-card" id="aqi-bottom-card">
                    <div class="gauge-container">
                        <h5 data-tooltip="${parameterDescriptions[title] || 'No description available'}">${title}</h5>
                        <canvas id="${canvasIdGauge}" width="280" height="280"></canvas>
                        <div class="aqi-health-status">Air Quality: <span>${getAQIHealthStatus(value)}</span></div>
                        <div class="aqi-datetime">
                            <div>Current Date: <span id="aqi-timestamp-date">${date}</span></div>
                            <div>Time: <span id="aqi-timestamp-time">${time}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        ` : `
            <div class="widget-item">
                <div class="card">
                    <h5 data-tooltip="${parameterDescriptions[title] || 'No description available'}">${title}</h5>
                    <div class="gauge-container">
                        <canvas id="${canvasIdGauge}" width="265" height="265"></canvas>
                    </div>
                </div>
            </div>
        `;
        widgetContainer.insertAdjacentHTML('beforeend', widgetHTML);

        const gaugeCanvas = document.getElementById(canvasIdGauge);
        if (!gaugeCanvas) {
            console.error(`Failed to find canvas for ${title}`);
            return;
        }
        const gaugeCtx = gaugeCanvas.getContext('2d');
        const { min, max, good, moderate } = parameterRanges[title] || { min: 0, max: 100, good: 30, moderate: 60 };
        const radius = Math.min(gaugeCanvas.width, gaugeCanvas.height) / 2 - (isAQI ? 60 : 40);
        drawGauge(gaugeCtx, gaugeCanvas.width / 2, gaugeCanvas.height / 2, radius, value, min, max, good, moderate, title, unit);

        if (isAQI) {
            const aqiBottomCard = document.getElementById('aqi-bottom-card');
            if (aqiBottomCard) {
                aqiBottomCard.style.backgroundColor = getAQIBackgroundColor(value);
            }
        }
    };

    const updateWidget = (title, value, unit) => {
        const gaugeCanvas = document.getElementById(`gauge-${title.replace(/\s+/g, '-')}`);
        if (gaugeCanvas) {
            const gaugeCtx = gaugeCanvas.getContext('2d');
            const { min, max, good, moderate } = parameterRanges[title] || { min: 0, max: 100, good: 30, moderate: 60 };
            const isAQI = title === 'AQI';
            const radius = Math.min(gaugeCanvas.width, gaugeCanvas.height) / 2 - (isAQI ? 60 : 40);
            drawGauge(gaugeCtx, gaugeCanvas.width / 2, gaugeCanvas.height / 2, radius, value, min, max, good, moderate, title, unit);

            if (isAQI) {
                const healthStatusDiv = gaugeCanvas.parentElement.querySelector('.aqi-health-status span');
                if (healthStatusDiv) {
                    healthStatusDiv.textContent = getAQIHealthStatus(value);
                }
                const timestampDateSpan = gaugeCanvas.parentElement.querySelector('#aqi-timestamp-date');
                const timestampTimeSpan = gaugeCanvas.parentElement.querySelector('#aqi-timestamp-time');
                if (timestampDateSpan && timestampTimeSpan) {
                    const { date, time } = formatDateTime();
                    timestampDateSpan.textContent = date;
                    timestampTimeSpan.textContent = time;
                }
                const aqiBottomCard = document.getElementById('aqi-bottom-card');
                if (aqiBottomCard) {
                    aqiBottomCard.style.backgroundColor = getAQIBackgroundColor(value);
                }
            }
        }
    };

    const getDataRange = (data, bufferPercent = 30) => {
        if (!data || data.length === 0) return { min: 0, max: 100 };

        const values = data.map(d => d.value);
        let min = Math.min(...values);
        let max = Math.max(...values);

        if (min === max) {
            min = Math.max(0, min - 10);
            max = max + 10;
            return { min, max };
        }

        const range = max - min;
        const buffer = (range * bufferPercent) / 100;

        min = Math.max(0, min - buffer);
        max = max + buffer;

        return { min, max };
    };

    const initializeCharts = () => {
        const chartConfig = {
            type: 'line',
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time',
                            font: { size: 14, weight: 'bold' },
                            color: '#000000'
                        },
                        ticks: { color: '#333', font: { weight: 'bold' } }
                    },
                    y: {
                        beginAtZero: true,
                        title: { display: true, font: { size: 14, weight: 'bold' }, color: '#000000' },
                        ticks: { color: '#333', font: { weight: 'bold' }, stepSize: 20 }
                    }
                },
                plugins: { legend: { display: false } },
                animation: {
                    duration: 500
                }
            }
        };

        chartInstances['Temperature'] = new Chart(document.getElementById('tempChart'), {
            ...chartConfig,
            data: { labels: [], datasets: [{ label: 'Temperature (°C)', data: [], borderColor: '#e74c3c', fill: false }] },
            options: {
                ...chartConfig.options,
                scales: {
                    ...chartConfig.options.scales,
                    y: {
                        ...chartConfig.options.scales.y,
                        title: { ...chartConfig.options.scales.y.title, text: 'Temperature (°C)' }
                    }
                }
            }
        });

        chartInstances['Humidity'] = new Chart(document.getElementById('humidityChart'), {
            ...chartConfig,
            data: { labels: [], datasets: [{ label: 'Humidity (%RH)', data: [], borderColor: '#3498db', fill: false }] },
            options: {
                ...chartConfig.options,
                scales: {
                    ...chartConfig.options.scales,
                    y: {
                        ...chartConfig.options.scales.y,
                        title: { ...chartConfig.options.scales.y.title, text: 'Humidity (%RH)' }
                    }
                }
            }
        });

        chartInstances['PM2.5'] = new Chart(document.getElementById('pm25Chart'), {
            ...chartConfig,
            data: { labels: [], datasets: [{ label: 'PM2.5 (µg/m³)', data: [], borderColor: '#9b59b6', fill: false }] },
            options: {
                ...chartConfig.options,
                scales: {
                    ...chartConfig.options.scales,
                    y: {
                        ...chartConfig.options.scales.y,
                        title: { ...chartConfig.options.scales.y.title, text: 'PM2.5 (µg/m³)' }
                    }
                }
            }
        });

        chartInstances['PM10'] = new Chart(document.getElementById('pm10Chart'), {
            ...chartConfig,
            data: { labels: [], datasets: [{ label: 'PM10 (µg/m³)', data: [], borderColor: '#2ecc71', fill: false }] },
            options: {
                ...chartConfig.options,
                scales: {
                    ...chartConfig.options.scales,
                    y: {
                        ...chartConfig.options.scales.y,
                        title: { ...chartConfig.options.scales.y.title, text: 'PM10 (µg/m³)' }
                    }
                }
            }
        });
    };

    const updateDashboard = async () => {
        try {
            const widgets = await fetchModbusData();

            if (widgets) {
                if (!errorMessage.textContent.includes('Failed to fetch')) {
                    // errorMessage.style.display = 'none';
                }

                const pm25 = widgets.find(w => w.title === 'PM2.5')?.value;
                const pm10 = widgets.find(w => w.title === 'PM10')?.value;
                const o2 = widgets.find(w => w.title === 'O2')?.value;
                const aqiValue = calculateAQI(pm25, pm10, o2);

                const existingAQI = document.getElementById('gauge-AQI');
                if (!existingAQI) {
                    createWidget('AQI', aqiValue, parameterUnits['AQI']);
                } else {
                    updateWidget('AQI', aqiValue, parameterUnits['AQI']);
                }

                const now = new Date();
                const timeString = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                const currentTime = now.getTime();
                const shouldSaveData = currentTime - lastSavedTime >= fiveMinInterval;
                let dataWasSaved = false;

                widgets.forEach(widget => {
                    const unit = parameterUnits[widget.title] || '';
                    const existingWidget = document.getElementById(`gauge-${widget.title.replace(/\s+/g, '-')}`);
                    if (existingWidget && widget.title !== 'AQI') {
                        updateWidget(widget.title, widget.value, unit);
                    } else if (!existingWidget && widget.title !== 'AQI') {
                        createWidget(widget.title, widget.value, unit);
                    }

                    if (['Temperature', 'Humidity', 'PM2.5', 'PM10'].includes(widget.title)) {
                        if (shouldSaveData && widget.value !== null && widget.value !== undefined && !isNaN(widget.value)) {
                            graphData[widget.title].push({ time: timeString, value: widget.value });

                            if (graphData[widget.title].length > maxDataPoints) {
                                graphData[widget.title].shift();
                            }

                            const chart = chartInstances[widget.title];
                            if (chart) {
                                chart.data.labels = graphData[widget.title].map(d => d.time);
                                chart.data.datasets[0].data = graphData[widget.title].map(d => d.value);

                                const { min, max } = getDataRange(graphData[widget.title]);
                                chart.options.scales.y.min = min;
                                chart.options.scales.y.max = max;

                                chart.update();
                            }

                            dataWasSaved = true;
                        }
                    }
                });

                if (shouldSaveData && dataWasSaved) {
                    lastSavedTime = currentTime;
                    console.log('Updated lastSavedTime:', new Date(lastSavedTime).toLocaleTimeString());
                }
            }
        } catch (error) {
            console.error('Dashboard update error:', error);
            errorMessage.textContent = `Error: ${error.message}`;
        } finally {
            // loading.style.display = 'none';
            // refreshBtn.style.display = 'flex';
        }
    };

    console.log('Initializing dashboard');
    // refreshBtn.style.display = 'flex';
    initializeCharts();
    updateDashboard();

    setInterval(updateDateTime, 1000);
    setInterval(() => {
        console.log('Scheduled refresh');
        updateDashboard();
    }, 30000);
});