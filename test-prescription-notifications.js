const io = require('socket.io-client');

// Test prescription notification system
console.log('🧪 Testing Prescription Notification System...\n');

// Connect to different namespaces
const boothSocket = io('http://localhost:3000/booths');
const doctorSocket = io('http://localhost:3000/doctors');
const technicianSocket = io('http://localhost:3000/technicians');
const clinicRoomSocket = io('http://localhost:3000/clinic-rooms');
const counterSocket = io('http://localhost:3000/counters');

// Test booth connection
boothSocket.on('connect', () => {
  console.log('✅ Booth WebSocket connected');
  boothSocket.emit('join_booth', { boothId: 'booth-123' });
});

boothSocket.on('joined_booth', (data) => {
  console.log('✅ Joined booth:', data.message);
});

// Test doctor connection
doctorSocket.on('connect', () => {
  console.log('✅ Doctor WebSocket connected');
  doctorSocket.emit('join_doctor', { doctorId: 'doctor-456' });
});

doctorSocket.on('joined_doctor', (data) => {
  console.log('✅ Joined as doctor:', data.message);
});

// Test technician connection
technicianSocket.on('connect', () => {
  console.log('✅ Technician WebSocket connected');
  technicianSocket.emit('join_technician', { technicianId: 'technician-789' });
});

technicianSocket.on('joined_technician', (data) => {
  console.log('✅ Joined as technician:', data.message);
});

// Test clinic room connection
clinicRoomSocket.on('connect', () => {
  console.log('✅ Clinic Room WebSocket connected');
  clinicRoomSocket.emit('join_clinic_room', { clinicRoomId: 'room-101' });
});

clinicRoomSocket.on('joined_clinic_room', (data) => {
  console.log('✅ Joined clinic room:', data.message);
});

// Test counter connection
counterSocket.on('connect', () => {
  console.log('✅ Counter WebSocket connected');
  counterSocket.emit('join_counter', { counterId: 'counter-001' });
});

counterSocket.on('joined_counter', (data) => {
  console.log('✅ Joined counter:', data.message);
});

// Listen for prescription service updates
boothSocket.on('prescription_service_update', (data) => {
  console.log('📡 [BOOTH] Received prescription service update:', {
    type: data.type,
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
    boothCode: data.data.boothCode,
  });
});

doctorSocket.on('prescription_service_update', (data) => {
  console.log('📡 [DOCTOR] Received prescription service update:', {
    type: data.type,
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
    doctorName: data.data.doctorName,
  });
});

technicianSocket.on('prescription_service_update', (data) => {
  console.log('📡 [TECHNICIAN] Received prescription service update:', {
    type: data.type,
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
    technicianName: data.data.technicianName,
  });
});

clinicRoomSocket.on('prescription_service_update', (data) => {
  console.log('📡 [CLINIC ROOM] Received prescription service update:', {
    type: data.type,
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
    clinicRoomName: data.data.clinicRoomName,
  });
});

counterSocket.on('prescription_service_update', (data) => {
  console.log('📡 [COUNTER] Received prescription service update:', {
    type: data.type,
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
  });
});

// Listen for patient call notifications (MAIN FEATURE)
counterSocket.on('patient_call', (data) => {
  console.log('📢 [COUNTER] PATIENT CALL NOTIFICATION:', {
    type: data.type,
    callMessage: data.data.callMessage,
    callType: data.data.callType,
    urgency: data.data.urgency,
    patientName: data.data.patientName,
    serviceName: data.data.serviceName,
    status: data.data.status,
    boothCode: data.data.boothCode,
  });
});

boothSocket.on('patient_call', (data) => {
  console.log('📢 [BOOTH] PATIENT CALL NOTIFICATION:', {
    type: data.type,
    callMessage: data.data.callMessage,
    callType: data.data.callType,
    urgency: data.data.urgency,
    patientName: data.data.patientName,
    serviceName: data.data.serviceName,
    status: data.data.status,
  });
});

// Listen for service assignment notifications
boothSocket.on('service_assigned', (data) => {
  console.log('📡 [BOOTH] Service assigned:', {
    type: data.type,
    serviceName: data.data.serviceName,
    boothCode: data.data.boothCode,
    patientName: data.data.patientName,
  });
});

counterSocket.on('service_assigned', (data) => {
  console.log('📡 [COUNTER] Service assigned:', {
    type: data.type,
    serviceName: data.data.serviceName,
    boothCode: data.data.boothCode,
    patientName: data.data.patientName,
  });
});

// Test ping/pong
setTimeout(() => {
  console.log('\n🏓 Testing ping/pong...');
  boothSocket.emit('ping');
  doctorSocket.emit('ping');
  technicianSocket.emit('ping');
  clinicRoomSocket.emit('ping');
  counterSocket.emit('ping');
}, 2000);

// Listen for pong responses
[boothSocket, doctorSocket, technicianSocket, clinicRoomSocket, counterSocket].forEach(socket => {
  socket.on('pong', (data) => {
    console.log('🏓 Pong received from', socket.nsp.name, ':', data.timestamp);
  });
});

// Clean up after 15 seconds
setTimeout(() => {
  console.log('\n🧹 Cleaning up connections...');
  boothSocket.disconnect();
  doctorSocket.disconnect();
  technicianSocket.disconnect();
  clinicRoomSocket.disconnect();
  counterSocket.disconnect();
  process.exit(0);
}, 15000);

console.log('\n⏳ Waiting for connections and notifications...');
console.log('💡 To test patient call notifications, make API calls to update prescription service status');
console.log('📝 Example API calls that will trigger patient call notifications:');
console.log('   POST /prescriptions/{code}/services/{serviceId}/assign-booth');
console.log('   POST /prescriptions/{code}/services/{serviceId}/preparing');
console.log('   POST /prescriptions/{code}/services/{serviceId}/serving');
console.log('   POST /prescriptions/{code}/services/{serviceId}/completed');
console.log('\n🎯 Expected patient call notifications:');
console.log('   - PENDING: "Bệnh nhân đang chờ dịch vụ"');
console.log('   - WAITING: "Gọi bệnh nhân đến Buồng X để thực hiện dịch vụ" (HIGH urgency)');
console.log('   - PREPARING: "Bệnh nhân đang chuẩn bị thực hiện dịch vụ"');
console.log('   - SERVING: "Đang thực hiện dịch vụ cho bệnh nhân"');
console.log('   - COMPLETED: "Hoàn thành dịch vụ cho bệnh nhân"');
