/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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

  // Get all technicians
  const technicians = await prisma.technician.findMany({
    include: {
      auth: true,
    },
  });

  if (doctors.length === 0) {
    console.log('❌ No doctors found. Please run doctor seeding first.');
    return;
  }

  if (technicians.length === 0) {
    console.log(
      '❌ No technicians found. Please run technician seeding first.',
    );
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

  console.log(
    `📋 Found ${doctors.length} doctors, ${technicians.length} technicians and ${booths.length} booths`,
  );

  // Separate booths for doctors and technicians
  const doctorBooths = booths.filter(
    (booth) =>
      !booth.room.roomName.includes('Xét nghiệm') &&
      !booth.room.roomName.includes('Chụp X-quang') &&
      !booth.room.roomName.includes('CT'),
  );

  const technicianBooths = booths.filter(
    (booth) =>
      booth.room.roomName.includes('Xét nghiệm') ||
      booth.room.roomName.includes('Chụp X-quang') ||
      booth.room.roomName.includes('CT'),
  );

  console.log(
    `🏥 Doctor booths: ${doctorBooths.length}, Technician booths: ${technicianBooths.length}`,
  );

  // Create work sessions for the next 30 days starting from today
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0); // Start from beginning of today
  const workSessions: Array<{
    boothId: string;
    doctorId?: string;
    technicianId?: string;
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

  // Helper function to create work sessions for a staff type
  const createWorkSessionsForStaff = (
    staffArray: any[],
    boothsForStaff: any[],
    staffType: 'doctor' | 'technician',
    day: number,
  ) => {
    for (const shift of shifts) {
      for (
        let boothIndex = 0;
        boothIndex < boothsForStaff.length;
        boothIndex++
      ) {
        const booth = boothsForStaff[boothIndex];
        const staffIndex = (boothIndex + day) % staffArray.length;
        const staff = staffArray[staffIndex];

        // Create start and end times for this shift (24h coverage)
        const startTime = new Date(startDate);
        startTime.setDate(startDate.getDate() + day);
        startTime.setHours(shift.startHour, 0, 0, 0);

        const endTime = new Date(startTime);
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

        const sessionData: any = {
          boothId: booth.id,
          startTime,
          endTime,
          nextAvailableAt,
        };

        if (staffType === 'doctor') {
          sessionData.doctorId = staff.id;
        } else {
          sessionData.technicianId = staff.id;
        }

        workSessions.push(sessionData);
      }
    }
  };

  // Create work sessions for each day
  for (let day = 0; day < 30; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    // Include all days including weekends for 24h coverage
    const dayOfWeek = currentDate.getDay();

    console.log(`📅 Creating work sessions for ${currentDate.toDateString()}`);

    // Create sessions for doctors
    if (doctorBooths.length > 0) {
      createWorkSessionsForStaff(doctors, doctorBooths, 'doctor', day);
    }

    // Create sessions for technicians
    if (technicianBooths.length > 0) {
      createWorkSessionsForStaff(
        technicians,
        technicianBooths,
        'technician',
        day,
      );
    }

    // Add some additional sessions for busy periods (more staff per booth)
    if (day < 7) {
      // First week gets extra sessions
      // Additional sessions for doctors
      for (const booth of doctorBooths.slice(0, 10)) {
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

      // Additional sessions for technicians
      for (const booth of technicianBooths.slice(0, 5)) {
        const technicianIndex = Math.floor(Math.random() * technicians.length);
        const technician = technicians[technicianIndex];

        // Additional morning session for technicians (8:00 - 12:00)
        const techEarlyStart = new Date(currentDate);
        techEarlyStart.setHours(8, 0, 0, 0);
        const techEarlyEnd = new Date(currentDate);
        techEarlyEnd.setHours(12, 0, 0, 0);

        workSessions.push({
          boothId: booth.id,
          technicianId: technician.id,
          startTime: techEarlyStart,
          endTime: techEarlyEnd,
          nextAvailableAt: new Date(techEarlyEnd.getTime() + 30 * 60 * 1000),
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

      console.log(
        `✅ Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(workSessions.length / batchSize)}`,
      );
    } catch (error) {
      console.error(
        `❌ Error inserting batch ${Math.floor(i / batchSize) + 1}:`,
        error,
      );
    }
  }

  // Create some special weekend sessions for emergency departments
  console.log('🏥 Creating weekend emergency sessions...');

  const emergencyBooths = booths.filter(
    (booth) =>
      booth.room.specialty.name.includes('Cấp cứu') ||
      booth.room.specialty.name.includes('Nội') ||
      booth.room.specialty.name.includes('Nhi'),
  );

  const emergencyTechnicianBooths = technicianBooths.filter(
    (booth) =>
      booth.room.specialty.name.includes('Cấp cứu') ||
      booth.room.specialty.name.includes('Nội') ||
      booth.room.specialty.name.includes('Nhi'),
  );

  for (let day = 0; day < 30; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    const dayOfWeek = currentDate.getDay();

    // Weekend emergency sessions (Saturday and Sunday) - 24h coverage
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      // Emergency sessions for doctors
      for (const booth of emergencyBooths.slice(0, 3)) {
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
          console.error('❌ Error creating weekend doctor session:', error);
        }
      }

      // Emergency sessions for technicians
      for (const booth of emergencyTechnicianBooths.slice(0, 2)) {
        const technicianIndex = Math.floor(Math.random() * technicians.length);
        const technician = technicians[technicianIndex];

        // Weekend technician session (8:00 - 20:00)
        const techWeekendStart = new Date(currentDate);
        techWeekendStart.setHours(8, 0, 0, 0);
        const techWeekendEnd = new Date(currentDate);
        techWeekendEnd.setHours(20, 0, 0, 0);

        try {
          await prisma.workSession.create({
            data: {
              boothId: booth.id,
              technicianId: technician.id,
              startTime: techWeekendStart,
              endTime: techWeekendEnd,
              nextAvailableAt: new Date(
                techWeekendEnd.getTime() + 30 * 60 * 1000,
              ),
            },
          });
        } catch (error) {
          console.error('❌ Error creating weekend technician session:', error);
        }
      }
    }
  }

  // Create some overlapping sessions for high-demand periods
  console.log('🔥 Creating overlapping sessions for high demand...');

  const highDemandDoctorBooths = doctorBooths.slice(0, 12); // First 12 doctor booths get overlapping sessions
  const highDemandTechnicianBooths = technicianBooths.slice(0, 8); // First 8 technician booths get overlapping sessions

  for (let day = 0; day < 14; day++) {
    // First 2 weeks
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);

    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends

    // Overlapping sessions for doctors
    for (const booth of highDemandDoctorBooths) {
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
        console.error('❌ Error creating overlapping doctor sessions:', error);
      }
    }

    // Overlapping sessions for technicians
    for (const booth of highDemandTechnicianBooths) {
      const technician1 =
        technicians[Math.floor(Math.random() * technicians.length)];
      const technician2 =
        technicians[Math.floor(Math.random() * technicians.length)];

      // First technician: 8:00 - 16:00
      const techSession1Start = new Date(currentDate);
      techSession1Start.setHours(8, 0, 0, 0);
      const techSession1End = new Date(currentDate);
      techSession1End.setHours(16, 0, 0, 0);

      // Second technician: 16:00 - 24:00
      const techSession2Start = new Date(currentDate);
      techSession2Start.setHours(16, 0, 0, 0);
      const techSession2End = new Date(currentDate);
      techSession2End.setHours(24, 0, 0, 0);

      try {
        await prisma.workSession.createMany({
          data: [
            {
              boothId: booth.id,
              technicianId: technician1.id,
              startTime: techSession1Start,
              endTime: techSession1End,
              nextAvailableAt: new Date(
                techSession1End.getTime() + 30 * 60 * 1000,
              ),
            },
            {
              boothId: booth.id,
              technicianId: technician2.id,
              startTime: techSession2Start,
              endTime: techSession2End,
              nextAvailableAt: new Date(
                techSession2End.getTime() + 30 * 60 * 1000,
              ),
            },
          ],
          skipDuplicates: true,
        });
      } catch (error) {
        console.error(
          '❌ Error creating overlapping technician sessions:',
          error,
        );
      }
    }
  }

  console.log('🎉 Work Session Seeding Completed!');

  // Print summary
  const totalSessions = await prisma.workSession.count();
  console.log(`📈 Total work sessions in database: ${totalSessions}`);

  // Count doctor and technician sessions
  const doctorSessions = await prisma.workSession.count({
    where: { doctorId: { not: null } },
  });

  const technicianSessions = await prisma.workSession.count({
    where: { technicianId: { not: null } },
  });

  console.log(`👨‍⚕️ Doctor work sessions: ${doctorSessions}`);
  console.log(`🔬 Technician work sessions: ${technicianSessions}`);

  const todaySessions = await prisma.workSession.count({
    where: {
      startTime: {
        gte: new Date('2025-08-28T00:00:00.000Z'),
        lt: new Date('2025-08-29T00:00:00.000Z'),
      },
    },
  });
  console.log(`📅 Work sessions for today (28/8/2025): ${todaySessions}`);

  // Sample today's sessions breakdown
  const todayDoctorSessions = await prisma.workSession.count({
    where: {
      doctorId: { not: null },
      startTime: {
        gte: new Date('2025-08-28T00:00:00.000Z'),
        lt: new Date('2025-08-29T00:00:00.000Z'),
      },
    },
  });

  const todayTechnicianSessions = await prisma.workSession.count({
    where: {
      technicianId: { not: null },
      startTime: {
        gte: new Date('2025-08-28T00:00:00.000Z'),
        lt: new Date('2025-08-29T00:00:00.000Z'),
      },
    },
  });

  console.log(
    `📅 Today's breakdown - Doctors: ${todayDoctorSessions}, Technicians: ${todayTechnicianSessions}`,
  );
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
