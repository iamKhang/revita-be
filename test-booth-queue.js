const io = require('socket.io-client');

// Test booth queue system
console.log('🧪 Testing Booth Queue System...\n');

// Connect to booth WebSocket
const boothSocket = io('http://localhost:3000/booths');

boothSocket.on('connect', () => {
  console.log('✅ Booth WebSocket connected');
  boothSocket.emit('join_booth', { boothId: 'booth-123' });
});

boothSocket.on('joined_booth', (data) => {
  console.log('✅ Joined booth:', data.message);
});

// Listen for booth queue updates
boothSocket.on('booth_queue_update', (data) => {
  console.log('📋 [BOOTH QUEUE] Update received:', {
    eventType: data.data.eventType,
    boothId: data.data.boothId,
    queueLength: data.data.queueLength,
    queueItems: data.data.queueItems?.map(item => ({
      patientName: item.patientPriorityInfo.patientName,
      serviceName: item.patientPriorityInfo.serviceName,
      priorityLevel: item.patientPriorityInfo.priorityLevel,
      priorityScore: item.patientPriorityInfo.priorityScore,
      queueStatus: item.patientPriorityInfo.queueStatus,
      queuePosition: item.patientPriorityInfo.queuePosition,
      estimatedWaitTime: item.patientPriorityInfo.estimatedWaitTime,
    })),
  });
});

// Listen for prescription service updates
boothSocket.on('prescription_service_update', (data) => {
  console.log('📡 [BOOTH] Prescription service update:', {
    prescriptionCode: data.data.prescriptionCode,
    serviceName: data.data.serviceName,
    status: data.data.status,
    patientName: data.data.patientName,
  });
});

// Test ping/pong
setTimeout(() => {
  console.log('\n🏓 Testing ping/pong...');
  boothSocket.emit('ping');
}, 2000);

boothSocket.on('pong', (data) => {
  console.log('🏓 Pong received:', data.timestamp);
});

// Clean up after 20 seconds
setTimeout(() => {
  console.log('\n🧹 Cleaning up...');
  boothSocket.disconnect();
  process.exit(0);
}, 20000);

console.log('\n⏳ Waiting for booth queue notifications...');
console.log('💡 To test booth queue, make API calls:');
console.log('📝 Example API calls:');
console.log('   POST /prescriptions/{code}/services/{serviceId}/assign-booth');
console.log('   POST /prescriptions/{code}/services/{serviceId}/add-to-booth-queue');
console.log('   GET /prescriptions/booth/{boothId}/queue');
console.log('   GET /prescriptions/booth/{boothId}/queue/stats');
console.log('\n🎯 Expected booth queue notifications:');
console.log('   - PATIENT_ADDED_TO_QUEUE: Bệnh nhân được thêm vào queue');
console.log('   - QUEUE_ITEM_STATUS_UPDATED: Cập nhật trạng thái trong queue');
console.log('   - PATIENT_REMOVED_FROM_QUEUE: Bệnh nhân được xóa khỏi queue');
console.log('\n📊 Priority calculation rules:');
console.log('   - RETURN_AFTER_RESULT: 10000+ points (highest priority)');
console.log('   - Disabled: 500+ points');
console.log('   - Pregnant: 400+ points + (weeks × 5)');
console.log('   - Child (<6): 300+ points + ((6-age) × 10)');
console.log('   - Elderly (≥65): 200+ points + (age × 2)');
console.log('   - Normal: 100 points');
