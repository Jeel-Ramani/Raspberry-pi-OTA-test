document.addEventListener('DOMContentLoaded', () => {
    const widgetContainer = document.getElementById('widget-container');
    const errorMessage = document.getElementById('error-message');
    const loading = document.getElementById('loading');
    const refreshBtn = document.getElementById('refresh-btn');

    // Map parameter titles to dynamic icons and units
    const parameterIcons = {
        'Temperature': 'fas fa-thermometer-half',
        'Pressure': 'fas fa-tachometer-alt',
        'Humidity': 'fas fa-tint',
        'PM2.5': 'fas fa-smog',
        'PM10': 'fas fa-cloud-meatball',
        'O2': 'fas fa-cloud-sun', // Changed from fas fa-wind
        'CO2': 'fas fa-cloud',
        'TVOC': 'fas fa-wind'
    };

    const parameterUnits = {
        'Temperature': '°C',
        'Pressure': 'hPa',
        'Humidity': '%',
        'PM2.5': 'µg/m³',
        'PM10': 'µg/m³',
        'O2': '%',
        'CO2': 'ppm',
        'TVOC': 'mg/m³'
    };

    const fetchModbusData = async () => {
        try {
            console.log('Attempting to fetch from http://localhost:3000/api/modbus-data');
            // loading.style.display = 'flex'; // Show loader
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
            const response = await fetch('http://localhost:3000/api/modbus-data', {
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
            return data;
        } catch (error) {
            console.error('Fetch error:', error);
            throw new Error(`Failed to fetch Modbus data: ${error.message}`);
        } finally {
            loading.style.display = 'none'; // Hide loader
        }
    };

    const updateDashboard = async () => {
        try {
            const widgets = await fetchModbusData();
            widgetContainer.innerHTML = '';

            if (!Array.isArray(widgets)) {
                throw new Error('Received data is not an array');
            }

            widgets.forEach(widget => {
                const iconClass = parameterIcons[widget.title] || 'fas fa-chart-bar';
                const unit = parameterUnits[widget.title] || ''; // Default to empty string if no unit
                const widgetHTML = `
                    <div class="col-md-3 mb-4">
                        <div class="card">
                            <i class="${iconClass}"></i>
                            <h5>${widget.title}</h5>
                            <h3>${widget.value} ${unit}</h3>
                        </div>
                    </div>
                `;
                widgetContainer.insertAdjacentHTML('beforeend', widgetHTML);
            });

            errorMessage.style.display = 'none';
        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.style.display = 'block';
        }
    };

    // Event Listener for Refresh Button
    refreshBtn.addEventListener('click', () => {
        console.log('Manual refresh triggered');
        updateDashboard();
    });

    // Initial Load and Auto-Refresh
    updateDashboard();
    setInterval(updateDashboard, 5000);
});