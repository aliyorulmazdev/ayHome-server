const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Redis = require('ioredis');
const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  methods: 'POST',
  optionsSuccessStatus: 204,
}));

app.use(bodyParser.json());

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'redis-13555.c250.eu-central-1-1.ec2.cloud.redislabs.com',
  port: process.env.REDIS_PORT || 13555,
  password: process.env.REDIS_PASSWORD || 'WIrKQWMTIPxZYsaG6TpP88f0EoWq4iMd'
};
const redisClient = new Redis(redisConfig);

app.post('/api/control-device', async (req, res) => {
  console.log('Received data:', req.body);

  const { roomName, action, deviceType } = req.body;
  const currentTime = new Date().toISOString();

  const key = `actionLogs:${roomName}:${deviceType}`;

  try {
    await redisClient.del(key);
    const first = await redisClient.hmset(key, 'roomName', roomName, 'action', action, 'time', currentTime);
    const updateData = { roomName, action };
    console.log(`Saved/Updated data on redis for ${deviceType}: `, first, updateData);
    await redisClient.publish(`${deviceType}StatusUpdates`, JSON.stringify(updateData));
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
  }
});

app.post('/api/get-device-status', async (req, res) => {
  console.log('Received request:', req.body);
  const { roomName, deviceType } = req.body;
  const key = `actionLogs:${roomName}:${deviceType}`;
  try {
    // Son veriyi al
    const data = await redisClient.hgetall(key);
    if (data && Object.keys(data).length > 0) {
      res.status(200).json({
        message: `Last status of ${deviceType} in ${roomName}`,
        data: data,
        success: true
      });
    } else {
      res.status(200).json({
        message: `No data found for ${deviceType} in ${roomName}`,
        success: true
      });
    }
  } catch (error) {
    console.error(`Error fetching data from Redis for ${deviceType}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = 3535;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
