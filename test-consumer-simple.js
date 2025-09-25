const Redis = require('ioredis');

async function testRedisStream() {
  console.log('Testing Redis Stream directly...');

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    // Read from consumer group
    const result = await redis.xreadgroup(
      'GROUP',
      'ticket-processors',
      'test-consumer-simple',
      'COUNT',
      10,
      'BLOCK',
      1000,
      'STREAMS',
      'queue:tickets',
      '>',
    );

    console.log('Raw result:', JSON.stringify(result, null, 2));

    if (result && result.length > 0) {
      const [, messages] = result[0];
      console.log(`Found ${messages.length} messages`);

      messages.forEach(([id, fields], index) => {
        console.log(`Message ${index + 1} - ID: ${id}`);
        console.log('Fields:', fields);

        // Parse fields
        const ticket = { id };
        for (let i = 0; i < fields.length; i += 2) {
          ticket[fields[i]] = fields[i + 1];
        }

        console.log('Parsed ticket:', JSON.stringify(ticket, null, 2));

        // Test our parse function
        const parsed = parseMessageData(ticket);
        console.log('Our parse result:', JSON.stringify(parsed, null, 2));
      });
    } else {
      console.log('No messages found');
    }

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    redis.disconnect();
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

testRedisStream();


