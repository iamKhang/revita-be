//@ts-nocheck
const { PrismaClient } = require('@prisma/client');

async function createTestReceptionists() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Tạo thêm receptionist cho test nhiều quầy...\n');
    
    const testReceptionists = [
      {
        name: 'Nguyễn Thị A',
        email: 'receptionist1@gmail.com',
        phone: '0901234561',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      },
      {
        name: 'Trần Văn B',
        email: 'receptionist2@gmail.com',
        phone: '0901234562',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      },
      {
        name: 'Lê Thị C',
        email: 'receptionist3@gmail.com',
        phone: '0901234563',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      },
      {
        name: 'Phạm Văn D',
        email: 'receptionist4@gmail.com',
        phone: '0901234564',
        password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
      }
    ];

    const createdReceptionists = [];

    for (const receptionistData of testReceptionists) {
      // Kiểm tra xem đã tồn tại chưa
      const existingAuth = await prisma.auth.findFirst({
        where: {
          OR: [
            { email: receptionistData.email },
            { phone: receptionistData.phone }
          ]
        }
      });

      if (existingAuth) {
        console.log(`⚠️  Receptionist ${receptionistData.name} đã tồn tại`);
        continue;
      }

      // Tạo auth
      const auth = await prisma.auth.create({
        data: {
          name: receptionistData.name,
          dateOfBirth: new Date('1990-01-01'),
          email: receptionistData.email,
          phone: receptionistData.phone,
          password: receptionistData.password,
          gender: 'MALE',
          avatar: null,
          address: 'TP HCM',
          role: 'RECEPTIONIST',
        },
      });

      // Tạo receptionist
      const receptionist = await prisma.receptionist.create({
        data: {
          id: auth.id,
          authId: auth.id,
        },
      });

      createdReceptionists.push({
        id: receptionist.id,
        name: auth.name,
        email: auth.email,
        phone: auth.phone,
      });

      console.log(`✅ Đã tạo receptionist: ${auth.name} (ID: ${receptionist.id})`);
    }

    if (createdReceptionists.length > 0) {
      console.log('\n📋 Danh sách receptionist đã tạo:');
      console.log('┌─────────────────────────────────────────────────────────────────┐');
      console.log('│ COUNTER ID                    │ TÊN                    │ EMAIL                │');
      console.log('├─────────────────────────────────────────────────────────────────┤');
      
      createdReceptionists.forEach((receptionist) => {
        const counterId = receptionist.id;
        const name = receptionist.name.padEnd(20);
        const email = receptionist.email.padEnd(20);
        
        console.log(`│ ${counterId} │ ${name} │ ${email} │`);
      });
      
      console.log('└─────────────────────────────────────────────────────────────────┘');
    }

    // Hiển thị tất cả receptionist
    console.log('\n📋 Tất cả receptionist trong hệ thống:');
    const allReceptionists = await prisma.receptionist.findMany({
      include: {
        auth: {
          select: {
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    console.log('┌─────────────────────────────────────────────────────────────────┐');
    console.log('│ COUNTER ID                    │ TÊN                    │ EMAIL                │');
    console.log('├─────────────────────────────────────────────────────────────────┤');
    
    allReceptionists.forEach((receptionist) => {
      const counterId = receptionist.id;
      const name = receptionist.auth.name.padEnd(20);
      const email = receptionist.auth.email.padEnd(20);
      
      console.log(`│ ${counterId} │ ${name} │ ${email} │`);
    });
    
    console.log('└─────────────────────────────────────────────────────────────────┘');

    console.log('\n🚀 Hướng dẫn test nhiều quầy:');
    console.log('1. Khởi động Kafka: cd kafka && docker compose up -d');
    console.log('2. Chạy counter listener cho từng quầy (mỗi terminal một quầy):');
    
    allReceptionists.forEach((receptionist, index) => {
      console.log(`   Terminal ${index + 1}:`);
      console.log(`   KAFKA_BROKERS=localhost:9092 KAFKA_TOPIC_COUNTER_ASSIGNMENTS=counter.assignments node kafka/counter-listener.js ${receptionist.id}`);
      console.log('');
    });

    console.log('3. Import collection Postman: postman_script/counter-assignment-collection.json');
    console.log('4. Cập nhật receptionistId trong Postman variables');
    console.log('5. Test các API và xem thông báo real-time trong các terminal');

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

createTestReceptionists();
