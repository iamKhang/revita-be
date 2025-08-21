//@ts-nocheck
const { PrismaClient } = require('@prisma/client');

async function assignReceptionistsToCounters() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Gán receptionist cho counters...\n');
    
    // Lấy danh sách receptionist
    const receptionists = await prisma.receptionist.findMany({
      include: {
        auth: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    // Lấy danh sách counters
    const counters = await prisma.counter.findMany({
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

    console.log(`📋 Tìm thấy ${receptionists.length} receptionist và ${counters.length} counters\n`);

    // Gán receptionist cho counter (1:1 mapping)
    const assignments = [];
    for (let i = 0; i < Math.min(receptionists.length, counters.length); i++) {
      const receptionist = receptionists[i];
      const counter = counters[i];

      // Cập nhật counter với receptionist
      await prisma.counter.update({
        where: { id: counter.id },
        data: { receptionistId: receptionist.id },
      });

      assignments.push({
        counterId: counter.id,
        counterCode: counter.counterCode,
        counterName: counter.counterName,
        receptionistId: receptionist.id,
        receptionistName: receptionist.auth.name,
        receptionistEmail: receptionist.auth.email,
      });

      console.log(`✅ Đã gán ${receptionist.auth.name} (${receptionist.auth.email}) cho ${counter.counterName} (${counter.counterCode})`);
    }

    console.log('\n📋 Tổng quan gán receptionist:');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ COUNTER ID                    │ MÃ QUẦY │ TÊN QUẦY        │ VỊ TRÍ              │ RECEPTIONIST        │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤');
    
    counters.forEach((counter) => {
      const counterId = counter.id;
      const counterCode = counter.counterCode.padEnd(8);
      const counterName = counter.counterName.padEnd(16);
      const location = (counter.location || '').padEnd(20);
      const receptionistName = counter.receptionist?.auth?.name || 'Chưa gán'.padEnd(20);
      
      console.log(`│ ${counterId} │ ${counterCode} │ ${counterName} │ ${location} │ ${receptionistName} │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘');

    console.log('\n🚀 Hướng dẫn test:');
    console.log('1. Khởi động Kafka: cd kafka && docker compose up -d');
    console.log('2. Chạy counter listener cho từng quầy (mỗi terminal một quầy):');
    
    counters.forEach((counter, index) => {
      console.log(`   Terminal ${index + 1}:`);
      console.log(`   KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js ${counter.id}`);
      console.log('');
    });

    console.log('3. Test API phân bổ bệnh nhân:');
    console.log('   POST /api/counter-assignment/assign');
    console.log('   POST /api/counter-assignment/scan-invoice');
    console.log('   POST /api/counter-assignment/direct-assignment');
    console.log('   POST /api/counter-assignment/simple-assignment');
    console.log('');
    console.log('4. Test API quản lý counter:');
    console.log('   POST /api/counter-assignment/counters/:counterId/online');
    console.log('   POST /api/counter-assignment/counters/:counterId/offline');
    console.log('   POST /api/counter-assignment/next-patient/:counterId');
    console.log('   POST /api/counter-assignment/return-previous/:counterId');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

assignReceptionistsToCounters();
