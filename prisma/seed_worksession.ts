import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌅 Starting Work Session Seeding...');

  // Get all doctors
  const doctors = await prisma.doctor.findMany({
    include: {
      auth: true,
    },
  });

  if (doctors.length === 0) {
    console.log('❌ No doctors found. Please run doctor seeding first.');
    return;
  }

  // Get all booths
  const booths = await prisma.booth.findMany({
    where: { isActive: true },
    include: {
      room: {
        include: {
          specialty: true,
        },
      },
    },
  });

  if (booths.length === 0) {
    console.log('❌ No booths found. Please run booth seeding first.');
    return;
  }

  console.log(`📋 Found ${doctors.length} doctors and ${booths.length} booths`);

  // Create work sessions for the next 30 days starting from today
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start from beginning of today
  const workSessions: Array<{
    boothId: string;
    doctorId: string;
    startTime: Date;
    endTime: Date;
    nextAvailableAt: Date;
  }> = [];

  // Define work shifts - 24h coverage
  const shifts = [
    { name: 'Early Morning', startHour: 0, endHour: 6, duration: 6 },
    { name: 'Morning', startHour: 6, endHour: 12, duration: 6 },
    { name: 'Afternoon', startHour: 12, endHour: 18, duration: 6 },
    { name: 'Evening', startHour: 18, endHour: 24, duration: 6 },
  ];

  // Create work sessions for each day
  for (let day = 0; day < 30; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    // Include all days including weekends for 24h coverage
    const dayOfWeek = currentDate.getDay();
    // Keep weekends for emergency services

    console.log(`📅 Creating work sessions for ${currentDate.toDateString()}`);

    // Assign doctors to booths for each shift
    for (const shift of shifts) {
      // For each booth, assign a doctor
      for (let boothIndex = 0; boothIndex < booths.length; boothIndex++) {
        const booth = booths[boothIndex];
        const doctorIndex = (boothIndex + day) % doctors.length; // Rotate doctors
        const doctor = doctors[doctorIndex];

        // Create start and end times for this shift (24h coverage)
        const startTime = new Date(currentDate);
        startTime.setHours(shift.startHour, 0, 0, 0);

        const endTime = new Date(currentDate);
        if (shift.startHour > shift.endHour) {
          // Overnight shift (e.g., 18:00 to 24:00, then 0:00 to 6:00)
          endTime.setDate(endTime.getDate() + 1);
          endTime.setHours(shift.endHour, 0, 0, 0);
        } else {
          endTime.setHours(shift.endHour, 0, 0, 0);
        }

        // Add some variation to start times (15-minute intervals)
        const startTimeVariation = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, 45 minutes
        startTime.setMinutes(startTime.getMinutes() + startTimeVariation);

        // Add some variation to end times
        const endTimeVariation = Math.floor(Math.random() * 4) * 15;
        endTime.setMinutes(endTime.getMinutes() + endTimeVariation);

        // Calculate next available time (30 minutes after end time)
        const nextAvailableAt = new Date(endTime);
        nextAvailableAt.setMinutes(nextAvailableAt.getMinutes() + 30);

        workSessions.push({
          boothId: booth.id,
          doctorId: doctor.id,
          startTime,
          endTime,
          nextAvailableAt,
        });
      }
    }

    // Add some additional sessions for busy periods (more doctors per booth)
    if (day < 7) { // First week gets extra sessions
      for (const booth of booths.slice(0, 10)) { // First 10 booths get extra sessions
        const doctorIndex = Math.floor(Math.random() * doctors.length);
        const doctor = doctors[doctorIndex];

        // Additional morning session (6:00 - 10:00)
        const earlyStart = new Date(currentDate);
        earlyStart.setHours(6, 0, 0, 0);
        const earlyEnd = new Date(currentDate);
        earlyEnd.setHours(10, 0, 0, 0);

        workSessions.push({
          boothId: booth.id,
          doctorId: doctor.id,
          startTime: earlyStart,
          endTime: earlyEnd,
          nextAvailableAt: new Date(earlyEnd.getTime() + 30 * 60 * 1000),
        });

        // Additional evening session (18:00 - 21:00)
        const lateStart = new Date(currentDate);
        lateStart.setHours(18, 0, 0, 0);
        const lateEnd = new Date(currentDate);
        lateEnd.setHours(21, 0, 0, 0);

        workSessions.push({
          boothId: booth.id,
          doctorId: doctor.id,
          startTime: lateStart,
          endTime: lateEnd,
          nextAvailableAt: new Date(lateEnd.getTime() + 30 * 60 * 1000),
        });
      }
    }
  }

  console.log(`📊 Created ${workSessions.length} work sessions`);

  // Insert work sessions in batches
  const batchSize = 100;
  for (let i = 0; i < workSessions.length; i += batchSize) {
    const batch = workSessions.slice(i, i + batchSize);
    
    try {
      await prisma.workSession.createMany({
        data: batch,
        skipDuplicates: true,
      });
      
      console.log(`✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workSessions.length / batchSize)}`);
    } catch (error) {
      console.error(`❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
    }
  }

  // Create some special weekend sessions for emergency departments
  console.log('🏥 Creating weekend emergency sessions...');
  
  const emergencyBooths = booths.filter(booth => 
    booth.room.specialty.name.includes('Cấp cứu') || 
    booth.room.specialty.name.includes('Nội') ||
    booth.room.specialty.name.includes('Nhi')
  );

  for (let day = 0; day < 30; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    const dayOfWeek = currentDate.getDay();
    
    // Weekend emergency sessions (Saturday and Sunday) - 24h coverage
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      for (const booth of emergencyBooths.slice(0, 5)) { // 5 emergency booths
        const doctorIndex = Math.floor(Math.random() * doctors.length);
        const doctor = doctors[doctorIndex];

        // Weekend 24h session (0:00 - 24:00)
        const weekendStart = new Date(currentDate);
        weekendStart.setHours(0, 0, 0, 0);
        const weekendEnd = new Date(currentDate);
        weekendEnd.setHours(23, 59, 59, 999);

        try {
          await prisma.workSession.create({
            data: {
              boothId: booth.id,
              doctorId: doctor.id,
              startTime: weekendStart,
              endTime: weekendEnd,
              nextAvailableAt: new Date(weekendEnd.getTime() + 30 * 60 * 1000),
            },
          });
        } catch (error) {
          console.error('❌ Error creating weekend session:', error);
        }
      }
    }
  }

  // Create some overlapping sessions for high-demand periods
  console.log('🔥 Creating overlapping sessions for high demand...');
  
  const highDemandBooths = booths.slice(0, 15); // First 15 booths get overlapping sessions
  
  for (let day = 0; day < 14; day++) { // First 2 weeks
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    for (const booth of highDemandBooths) {
      // Create overlapping 24h sessions
      const doctor1 = doctors[Math.floor(Math.random() * doctors.length)];
      const doctor2 = doctors[Math.floor(Math.random() * doctors.length)];

      // First doctor: 0:00 - 12:00
      const session1Start = new Date(currentDate);
      session1Start.setHours(0, 0, 0, 0);
      const session1End = new Date(currentDate);
      session1End.setHours(12, 0, 0, 0);

      // Second doctor: 12:00 - 24:00 (continuous coverage)
      const session2Start = new Date(currentDate);
      session2Start.setHours(12, 0, 0, 0);
      const session2End = new Date(currentDate);
      session2End.setHours(23, 59, 59, 999);

      try {
        await prisma.workSession.createMany({
          data: [
            {
              boothId: booth.id,
              doctorId: doctor1.id,
              startTime: session1Start,
              endTime: session1End,
              nextAvailableAt: new Date(session1End.getTime() + 30 * 60 * 1000),
            },
            {
              boothId: booth.id,
              doctorId: doctor2.id,
              startTime: session2Start,
              endTime: session2End,
              nextAvailableAt: new Date(session2End.getTime() + 30 * 60 * 1000),
            },
          ],
          skipDuplicates: true,
        });
      } catch (error) {
        console.error('❌ Error creating overlapping sessions:', error);
      }
    }
  }

  console.log('🎉 Work Session Seeding Completed!');
  
  // Print summary
  const totalSessions = await prisma.workSession.count();
  console.log(`📈 Total work sessions in database: ${totalSessions}`);
  
  const todaySessions = await prisma.workSession.count({
    where: {
      startTime: {
        gte: new Date('2025-08-28T00:00:00.000Z'),
        lt: new Date('2025-08-29T00:00:00.000Z'),
      },
    },
  });
  console.log(`📅 Work sessions for today (28/8/2025): ${todaySessions}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
