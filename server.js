const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const IP = require('ip');
const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  methods: 'POST',
  optionsSuccessStatus: 204,
}));

app.use(bodyParser.json());
// Sunucu tarafındaki API endpoint'i
app.post('/api/control-device', async (req, res) => {
  console.log('Received data:', req.body);

  const { roomName, action, deviceType } = req.body;
  const currentTime = new Date().toISOString();

  const key = `actionLogs:${roomName}:${deviceType}`;

  const redisConfig = {
    host: 'redis-13555.c250.eu-central-1-1.ec2.cloud.redislabs.com',
    port: 13555,
    password: 'WIrKQWMTIPxZYsaG6TpP88f0EoWq4iMd'
  };
  const client = new Redis(redisConfig);

  try {
    // Eski veriyi sil
    await client.del(key);

    // Yeni veriyi ekle
    const first = await client.hmset(key, 'roomName', roomName, 'action', action, 'time', currentTime);
    const updateData = { roomName, action };
    console.log(`Saved/Updated data on redis for ${deviceType}: `, first, updateData);
    await client.publish(`${deviceType}StatusUpdates`, JSON.stringify(updateData));
    console.log(`Published to channel(${deviceType}StatusUpdates): `, updateData);

    const successMessage = `Device in ${roomName} ${action === 'on' ? 'turned on' : 'turned off'}.`;
    res.status(200).json({
      message: successMessage,
      success: true
    });
    console.log(`Send response successfully for ${deviceType}: `, updateData);
  } catch (error) {
    console.error(`Error updating data in Redis for ${deviceType}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.quit();
  }
});

app.post('/api/get-device-status', async (req, res) => {
  const { roomName, deviceType } = req.body;

  const key = `actionLogs:${roomName}:${deviceType}`;

  const redisConfig = {
    host: 'redis-13555.c250.eu-central-1-1.ec2.cloud.redislabs.com',
    port: 13555,
    password: 'WIrKQWMTIPxZYsaG6TpP88f0EoWq4iMd'
  };
  const client = new Redis(redisConfig);

  try {
    // Son veriyi al
    const data = await client.hgetall(key);

    if (data && Object.keys(data).length > 0) {
      res.status(200).json({
        message: `Last status of ${deviceType} in ${roomName}`,
        data: data,
        success: true
      });
    } else {
      res.status(404).json({
        message: `No data found for ${deviceType} in ${roomName}`,
        success: false
      });
    }
  } catch (error) {
    console.error(`Error fetching data from Redis for ${deviceType}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.quit();
  }
});


// Add similar logic for /api/temperature-check if needed

const PORT = 3535;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
