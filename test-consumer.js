const { RedisStreamService } = require('./dist/cache/redis-stream.service');
const { RedisService } = require('./dist/cache/redis.service');

async function testConsumer() {
  console.log('Testing Redis Stream Consumer...');

  const redisService = new RedisService();
  const redisStream = new RedisStreamService(redisService);

  try {
    // Đọc messages từ consumer group
    const messages = await redisStream.readFromConsumerGroup(
      'queue:tickets',
      'ticket-processors',
      'test-consumer',
      10,
      1000
    );

    console.log(`Found ${messages.length} messages:`);

    messages.forEach((message, index) => {
      console.log(`Message ${index + 1}:`, JSON.stringify(message, null, 2));

      // Test parseMessageData
      try {
        const parsed = parseMessageData(message);
        console.log(`Parsed message ${index + 1}:`, JSON.stringify(parsed, null, 2));
      } catch (error) {
        console.error(`Error parsing message ${index + 1}:`, error);
      }
    });

  } catch (error) {
    console.error('Test failed:', error);
  }

  process.exit(0);
}

// Copy parseMessageData function
function parseMessageData(message) {
  console.log('Processing message:', JSON.stringify(message, null, 2));

  // Kiểm tra cấu trúc message
  if (!message) {
    throw new Error('Message is null or undefined');
  }

  if (!message.id) {
    console.warn('Message missing id:', message);
    return {
      id: 'unknown',
      error: 'Missing message id',
    };
  }

  // Redis Stream trả về message với fields đã được flatten trực tiếp
  // { id: 'message-id', field1: 'value1', field2: 'value2', ... }
  const data = {
    id: message.id,
  };

  // Copy tất cả fields từ message (trừ id)
  Object.keys(message).forEach(key => {
    if (key !== 'id') {
      const value = message[key];

      // Convert string numbers back to numbers
      if (['patientAge', 'priorityScore', 'sequence', 'estimatedWaitTime'].includes(key)) {
        data[key] = parseInt(value) || 0;
      } else if (['isPregnant', 'isDisabled', 'isElderly', 'isEmergency', 'isVIP'].includes(key)) {
        data[key] = value === 'true' || value === true;
      } else if (key === 'metadata' && typeof value === 'string') {
        // Parse metadata JSON string nếu có
        try {
          data[key] = JSON.parse(value);
        } catch (e) {
          data[key] = value;
        }
      } else {
        data[key] = value;
      }
    }
  });

  console.log('Parsed data:', data);

  return data;
}

testConsumer();


