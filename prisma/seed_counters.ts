import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CounterData {
  counterCode: string;
  counterName: string;
  location: string;
  isActive: boolean;
  maxQueue: number;
  receptionistId: string | null;
}

interface CounterAssignmentData {
  counterId: string;
  receptionistId: string;
  assignedAt: string;
  completedAt: string | null;
  status: string;
  notes: string;
}


async function seedCounters() {
  try {
    console.log('🚀 Bắt đầu seed dữ liệu Counter...');

    // Đọc dữ liệu từ file JSON
    const countersPath = path.join(__dirname, 'Data', 'counters.json');
    const assignmentsPath = path.join(__dirname, 'Data', 'counter_assignments.json');

    const countersData: CounterData[] = JSON.parse(
      fs.readFileSync(countersPath, 'utf8')
    );
    const assignmentsData: CounterAssignmentData[] = JSON.parse(
      fs.readFileSync(assignmentsPath, 'utf8')
    );

    // Xóa dữ liệu cũ
    console.log('🧹 Xóa dữ liệu Counter cũ...');
    await prisma.counterAssignment.deleteMany();
    await prisma.counter.deleteMany();

    // Lấy danh sách Receptionists có sẵn
    console.log('📝 Lấy danh sách Receptionists có sẵn...');
    const existingReceptionists = await prisma.receptionist.findMany({
      include: {
        auth: true,
      },
    });
    
    console.log(`✅ Tìm thấy ${existingReceptionists.length} receptionists có sẵn`);
    existingReceptionists.forEach(receptionist => {
      console.log(`  - ${receptionist.auth.name} (${receptionist.auth.email})`);
    });

    // Seed Counters
    console.log('📝 Tạo Counters...');
    const createdCounters: any[] = [];
    
    for (const counterData of countersData) {
      const counter = await prisma.counter.create({
        data: {
          counterCode: counterData.counterCode,
          counterName: counterData.counterName,
          location: counterData.location,
          isActive: counterData.isActive,
          maxQueue: counterData.maxQueue,
          receptionistId: counterData.receptionistId,
        },
      });
      createdCounters.push(counter);
      console.log(`✅ Tạo Counter: ${counter.counterCode} - ${counter.counterName}`);
    }

    // Tạo mapping từ counterCode sang counterId
    const counterMapping: { [key: string]: string } = {};
    createdCounters.forEach(counter => {
      if (counter.counterCode === 'CTR001') {
        counterMapping['counter-1-uuid'] = counter.id;
      } else if (counter.counterCode === 'CTR002') {
        counterMapping['counter-2-uuid'] = counter.id;
      }
    });

    // Tạo mapping từ receptionistId sang receptionistId thực tế
    const receptionistMapping: { [key: string]: string } = {};
    existingReceptionists.forEach((receptionist, index) => {
      receptionistMapping[`receptionist-${index + 1}-uuid`] = receptionist.id;
    });

    // Seed Counter Assignments
    console.log('📝 Tạo Counter Assignments...');
    
    for (const assignmentData of assignmentsData) {
      const actualCounterId = counterMapping[assignmentData.counterId];
      const actualReceptionistId = receptionistMapping[assignmentData.receptionistId];

      if (actualCounterId && actualReceptionistId) {
        await prisma.counterAssignment.create({
          data: {
            counterId: actualCounterId,
            receptionistId: actualReceptionistId,
            assignedAt: new Date(assignmentData.assignedAt),
            completedAt: assignmentData.completedAt ? new Date(assignmentData.completedAt) : null,
            status: assignmentData.status,
            notes: assignmentData.notes,
          },
        });
        console.log(`✅ Tạo Assignment: Receptionist ${actualReceptionistId} -> Counter ${actualCounterId} (${assignmentData.status})`);
      }
    }

    // Tạo dữ liệu mẫu cho 2 phiên làm việc (mỗi phiên 400 giờ)
    console.log('📝 Tạo dữ liệu mẫu cho 2 phiên làm việc...');
    
    const startDate = new Date('2025-09-20T16:24:00.000Z');
    
    // Phiên 1: 400 giờ từ 16:24 ngày 20/9/2025
    const session1End = new Date(startDate.getTime() + (400 * 60 * 60 * 1000));
    console.log(`📅 Phiên 1: ${startDate.toISOString()} -> ${session1End.toISOString()}`);
    
    // Phiên 2: 400 giờ từ thời điểm kết thúc phiên 1
    const session2Start = new Date(session1End.getTime() + (1 * 60 * 60 * 1000)); // Nghỉ 1 giờ
    const session2End = new Date(session2Start.getTime() + (400 * 60 * 60 * 1000));
    console.log(`📅 Phiên 2: ${session2Start.toISOString()} -> ${session2End.toISOString()}`);

    // Tạo thống kê mẫu
    const stats = {
      totalReceptionists: existingReceptionists.length,
      totalCounters: createdCounters.length,
      totalAssignments: assignmentsData.length,
      activeAssignments: assignmentsData.filter(a => a.status === 'ACTIVE').length,
      completedAssignments: assignmentsData.filter(a => a.status === 'COMPLETED').length,
      session1: {
        start: startDate.toISOString(),
        end: session1End.toISOString(),
        duration: '400 hours'
      },
      session2: {
        start: session2Start.toISOString(),
        end: session2End.toISOString(),
        duration: '400 hours'
      },
      averageProcessingTime: '8 hours per shift',
      totalProcessingTime: '400 hours per session'
    };

    console.log('📊 Thống kê dữ liệu đã tạo:');
    console.log(JSON.stringify(stats, null, 2));

    console.log('✅ Hoàn thành seed dữ liệu Counter!');
    
  } catch (error) {
    console.error('❌ Lỗi khi seed dữ liệu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy seed function
if (require.main === module) {
  seedCounters()
    .then(() => {
      console.log('🎉 Seed Counter hoàn thành thành công!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed Counter thất bại:', error);
      process.exit(1);
    });
}

export { seedCounters };
