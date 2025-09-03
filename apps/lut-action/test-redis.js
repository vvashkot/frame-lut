const IORedis = require('ioredis');

const connection = new IORedis({
  host: 'localhost',
  port: 6380,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

connection.on('connect', () => {
  console.log('Connected to Redis');
  connection.keys('bull:lut-processing:*').then(keys => {
    console.log('Found keys:', keys.length);
    connection.quit();
  });
});

connection.on('error', (err) => {
  console.error('Redis error:', err);
});
