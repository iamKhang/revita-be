const io = require('socket.io-client');

// Test booth WebSocket connection
const boothSocket = io('http://localhost:3000/booths');

boothSocket.on('connect', () => {
  console.log('✅ Connected to booth WebSocket server');
  
  // Test joining a booth
  boothSocket.emit('join_booth', { boothId: 'booth-123' });
});

boothSocket.on('joined_booth', (data) => {
  console.log('✅ Joined booth:', data);
  
  // Test getting online booths
  boothSocket.emit('get_online_booths');
});

boothSocket.on('online_booths', (data) => {
  console.log('📋 Online booths:', data);
});

boothSocket.on('booth_status_update', (data) => {
  console.log('🔄 Booth status update:', data);
});

boothSocket.on('work_session_start', (data) => {
  console.log('🚀 Work session started:', data);
});

boothSocket.on('work_session_end', (data) => {
  console.log('🏁 Work session ended:', data);
});

boothSocket.on('error', (error) => {
  console.error('❌ Error:', error);
});

boothSocket.on('disconnect', () => {
  console.log('🔌 Disconnected from booth WebSocket server');
});

// Test booth status update
setTimeout(() => {
  console.log('📤 Testing booth status update...');
  boothSocket.emit('booth_status_update', {
    boothId: 'booth-123',
    status: 'ACTIVE',
    workSessionId: 'session-456'
  });
}, 2000);

// Test work session start
setTimeout(() => {
  console.log('📤 Testing work session start...');
  boothSocket.emit('work_session_start', {
    boothId: 'booth-123',
    workSessionId: 'session-456',
    doctorId: 'doctor-789'
  });
}, 4000);

// Test work session end
setTimeout(() => {
  console.log('📤 Testing work session end...');
  boothSocket.emit('work_session_end', {
    boothId: 'booth-123',
    workSessionId: 'session-456'
  });
}, 6000);

// Test ping
setTimeout(() => {
  console.log('📤 Testing ping...');
  boothSocket.emit('ping');
}, 8000);

boothSocket.on('pong', (data) => {
  console.log('🏓 Pong received:', data);
});

// Clean up after 10 seconds
setTimeout(() => {
  console.log('🧹 Cleaning up...');
  boothSocket.emit('leave_booth');
  boothSocket.disconnect();
}, 10000);

