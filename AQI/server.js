const ModbusRTU = require('modbus-serial');
const express = require('express');
const cors = require('cors');
const SerialPort = require('./node_modules/serialport');
const app = express();
const port = 5500;

app.use(cors());

// Define Modbus parameters
const serialPort = '/dev/ttyAMA3'; // Adjust based on your system
const baudRate = 9600;
const dataBits = 8;
const stopBits = 1;
const parity = 'none';
const slaveId = 1;

// Updated register values (change these to your desired addresses)
const registers = [4, 6, 5, 1, 7, 10, 3, 2];

// Dividers for each parameter to scale the raw values
const dividers = {
    'Temperature': 10, // e.g., 725 → (725-500)/10 = 22.5 °C
    'PM1.0': 1,
    'Humidity': 10,      // e.g., 45 → 45 % (no scaling)
    'PM2.5': 1,         // e.g., 25 → 25 µg/m³ (no scaling)
    'PM10': 1,          // e.g., 40 → 40 µg/m³ (no scaling)
    'O2': 10,           // e.g., 210 → 21.0 %
    'CO2': 1,           // e.g., 400 → 400 ppm (no scaling)
    'TVOC': 1           // e.g., 300 → 300 ppb (no scaling)
};

const parameterNames = ['Temperature', 'PM1.0', 'Humidity', 'PM2.5', 'PM10', 'O2', 'CO2', 'TVOC'];

// Initialize Modbus RTU client
const client = new ModbusRTU();

async function connectModbus() {
    try {
        await client.connectRTUBuffered(serialPort, { baudRate, dataBits, stopBits, parity });
        client.setID(slaveId);
        console.log('Connected to Modbus RTU');
    } catch (error) {
        console.error('Connection Error:', error.message);
        throw error;
    }
}

// Function to read Modbus registers
async function readModbusData() {
    const widgets = [];
    try {
        for (let i = 0; i < registers.length; i++) {
            const address = registers[i];
            const parameterName = parameterNames[i];
            const divider = dividers[parameterName] || 1; // Default to 1 if no divider specified

            const response = await client.readHoldingRegisters(address, 1);
            let value = response.data[0] ?? null; // Use null if value is undefined

            // Apply special calculation for temperature: (value-500)/10
            if (value !== null) {
                if (parameterName === 'Temperature') {
                    value = (value - 500) / divider;
                } else {
                    value = value / divider;
                }
                // Round to 2 decimal places for readability
                // value = Math.round(value * 100) / 100;
            }

            widgets.push({
                title: parameterName,
                value: value, // Scaled value
                icon: 'fas fa-chart-bar'
            });
        }
        return widgets;
    } catch (error) {
        console.error('Read Error:', error.message);
        throw error;
    }
}

// API endpoint to serve Modbus data
app.get('/api/modbus-data', async (req, res) => {
    try {
        const data = await readModbusData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server and connect to Modbus
async function startServer() {
    try {
        await connectModbus();
        app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Startup Error:', error.message);
        process.exit(1);
    }
}

startServer();

// Cleanup on process exit
process.on('SIGINT', async () => {
    client.close(() => {
        console.log('Modbus connection closed');
        process.exit(0);
    });
});