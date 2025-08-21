//@ts-nocheck
const { PrismaClient } = require('@prisma/client');

async function createTestCounters() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Tạo counters cho hệ thống...\n');
    
    const testCounters = [
      {
        counterCode: 'CTR001',
        counterName: 'Quầy 1',
        location: 'Tầng 1 - Khu A',
        maxQueue: 10,
      },
      {
        counterCode: 'CTR002',
        counterName: 'Quầy 2',
        location: 'Tầng 1 - Khu A',
        maxQueue: 10,
      },
      {
        counterCode: 'CTR003',
        counterName: 'Quầy 3',
        location: 'Tầng 1 - Khu B',
        maxQueue: 10,
      },
      {
        counterCode: 'CTR004',
        counterName: 'Quầy 4',
        location: 'Tầng 1 - Khu B',
        maxQueue: 10,
      },
      {
        counterCode: 'CTR005',
        counterName: 'Quầy Cấp cứu',
        location: 'Tầng 1 - Khu Cấp cứu',
        maxQueue: 5,
      }
    ];

    const createdCounters = [];

    for (const counterData of testCounters) {
      // Kiểm tra xem đã tồn tại chưa
      const existingCounter = await prisma.counter.findUnique({
        where: { counterCode: counterData.counterCode }
      });

      if (existingCounter) {
        console.log(`⚠️  Counter ${counterData.counterName} (${counterData.counterCode}) đã tồn tại`);
        continue;
      }

      // Tạo counter
      const counter = await prisma.counter.create({
        data: counterData,
      });

      createdCounters.push({
        id: counter.id,
        counterCode: counter.counterCode,
        counterName: counter.counterName,
        location: counter.location,
        maxQueue: counter.maxQueue,
      });

      console.log(`✅ Đã tạo counter: ${counter.counterName} (${counter.counterCode}) - ID: ${counter.id}`);
    }

    if (createdCounters.length > 0) {
      console.log('\n📋 Danh sách counters đã tạo:');
      console.log('┌─────────────────────────────────────────────────────────────────────────────────────┐');
      console.log('│ COUNTER ID                    │ MÃ QUẦY │ TÊN QUẦY        │ VỊ TRÍ              │');
      console.log('├─────────────────────────────────────────────────────────────────────────────────────┤');
      
      createdCounters.forEach((counter) => {
        const counterId = counter.id;
        const counterCode = counter.counterCode.padEnd(8);
        const counterName = counter.counterName.padEnd(16);
        const location = (counter.location || '').padEnd(20);
        
        console.log(`│ ${counterId} │ ${counterCode} │ ${counterName} │ ${location} │`);
      });
      
      console.log('└─────────────────────────────────────────────────────────────────────────────────────┘');
    }

    // Hiển thị tất cả counters
    console.log('\n📋 Tất cả counters trong hệ thống:');
    const allCounters = await prisma.counter.findMany({
      include: {
        receptionist: {
          include: {
            auth: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ COUNTER ID                    │ MÃ QUẦY │ TÊN QUẦY        │ VỊ TRÍ              │ RECEPTIONIST        │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤');
    
    allCounters.forEach((counter) => {
      const counterId = counter.id;
      const counterCode = counter.counterCode.padEnd(8);
      const counterName = counter.counterName.padEnd(16);
      const location = (counter.location || '').padEnd(20);
      const receptionistName = counter.receptionist?.auth?.name || 'Chưa gán'.padEnd(20);
      
      console.log(`│ ${counterId} │ ${counterCode} │ ${counterName} │ ${location} │ ${receptionistName} │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

    console.log('\n🚀 Hướng dẫn sử dụng:');
    console.log('1. Khởi động Kafka: cd kafka && docker compose up -d');
    console.log('2. Chạy counter listener cho từng quầy (mỗi terminal một quầy):');
    
    allCounters.forEach((counter, index) => {
      console.log(`   Terminal ${index + 1}:`);
      console.log(`   KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js ${counter.id}`);
      console.log('');
    });

    console.log('3. Import collection Postman: postman_script/counter-assignment-collection.json');
    console.log('4. Cập nhật counterId trong Postman variables');
    console.log('5. Test các API và xem thông báo real-time trong các terminal');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestCounters();
