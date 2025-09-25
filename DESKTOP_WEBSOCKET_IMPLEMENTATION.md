# 🚀 Hướng Dẫn Implement WebSocket Client cho Desktop Counter App

## 📋 Tổng quan

File này hướng dẫn cách implement WebSocket client trong ứng dụng Electron desktop counter để **lắng nghe real-time các ticket được bốc từ máy kiosk**.

## 🏥 **Nghiệp vụ thực tế:**

### **Flow bốc số tự động:**
1. **Bệnh nhân** đến máy kiosk (không có nhân viên trực tiếp)
2. **Chọn loại ưu tiên**: Cấp cứu 🆘, thai phụ 🤰, người già 👴, VIP 💎, thường
3. **Nhập thông tin**: Điền tên/SĐT hoặc scan QR code (lịch đặt/mã bệnh nhân)
4. **Bốc số**: Kiosk gọi `POST /api/take-number/take`
5. **Smart assignment**: Server tự động phân công vào counter phù hợp nhất dựa trên:
   - **Priority level**: Cấp cứu > người già > thai phụ > VIP > thường
   - **Queue length**: Counter nào ít bệnh nhân nhất
   - **Counter availability**: Counter đang hoạt động
6. **Real-time display**: Counter app nhận WebSocket event và hiển thị ticket mới

### **Flow tại counter:**
1. **Counter app** luôn lắng nghe WebSocket events
2. **Nhận ticket mới** → Tự động thêm vào queue
3. **Nhân viên gọi next** → `POST /api/counter-assignment/next-patient/{counterId}`
4. **Xử lý hoàn tất** → Ticket tự động remove khỏi queux

## 🔧 Cấu trúc WebSocket Server

### Gateway Information
- **Namespace**: `/counters`
- **URL**: `ws://localhost:3000/counters`
- **CORS**: Cho phép tất cả origins

### Các Events có sẵn

#### Client gửi lên Server:
- `join_counter`: Tham gia vào counter cụ thể
- `leave_counter`: Rời khỏi counter
- `ping`: Kiểm tra kết nối
- `get_online_counters`: Lấy danh sách counters online

#### Server gửi về Client:
- `joined_counter`: Xác nhận đã join counter thành công
- `left_counter`: Xác nhận đã leave counter
- `pong`: Response cho ping
- `online_counters`: Danh sách counters online
- `ticket_processed`: Có ticket mới được xử lý
- `new_ticket`: Thông báo có ticket mới trong hệ thống

## 💻 Implement trong Electron App

### 1. Cài đặt Dependencies

```bash
npm install socket.io-client
```

### 2. Tạo WebSocket Service

```javascript
// src/services/websocket.service.js
const io = require('socket.io-client');

class WebSocketService {
  constructor() {
    this.socket = null;
    this.currentCounterId = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Kết nối đến WebSocket server
   */
  connect() {
    if (this.socket && this.isConnected) {
      console.log('Already connected');
      return;
    }

    try {
      this.socket = io('ws://localhost:3000/counters', {
        transports: ['websocket', 'polling'],
        timeout: 20000,
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
      });

      this.setupEventListeners();
      console.log('Connecting to WebSocket server...');

    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.handleConnectionError(error);
    }
  }

  /**
   * Thiết lập các event listeners
   */
  setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Auto join counter if we have one
      if (this.currentCounterId) {
        this.joinCounter(this.currentCounterId);
      }

      // Notify UI
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('websocket-connected', {});
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      this.isConnected = false;

      // Notify UI
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('websocket-disconnected', { reason });
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      this.handleConnectionError(error);
    });

    // Counter events
    this.socket.on('joined_counter', (data) => {
      console.log('Joined counter:', data);
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('counter-joined', data);
      }
    });

    this.socket.on('left_counter', (data) => {
      console.log('Left counter:', data);
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('counter-left', data);
      }
    });

    // Ticket events
    this.socket.on('ticket_processed', (data) => {
      console.log('Ticket processed:', data);
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('ticket-processed', data);
      }
    });

    this.socket.on('new_ticket', (data) => {
      console.log('New ticket:', data);
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('new-ticket', data);
      }
    });

    // System events
    this.socket.on('pong', (data) => {
      console.log('Pong received:', data);
    });

    this.socket.on('online_counters', (data) => {
      console.log('Online counters:', data);
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('online-counters', data);
      }
    });
  }

  /**
   * Tham gia vào counter cụ thể
   */
  joinCounter(counterId) {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to WebSocket server');
      return false;
    }

    console.log(`Joining counter: ${counterId}`);
    this.currentCounterId = counterId;

    this.socket.emit('join_counter', { counterId });
    return true;
  }

  /**
   * Rời khỏi counter hiện tại
   */
  leaveCounter() {
    if (!this.socket || !this.isConnected) {
      console.warn('Not connected to WebSocket server');
      return false;
    }

    console.log('Leaving current counter');
    this.socket.emit('leave_counter');
    this.currentCounterId = null;
    return true;
  }

  /**
   * Ping server để kiểm tra kết nối
   */
  ping() {
    if (!this.socket || !this.isConnected) {
      return false;
    }

    this.socket.emit('ping');
    return true;
  }

  /**
   * Lấy danh sách counters online
   */
  getOnlineCounters() {
    if (!this.socket || !this.isConnected) {
      return false;
    }

    this.socket.emit('get_online_counters');
    return true;
  }

  /**
   * Ngắt kết nối
   */
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting from WebSocket server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentCounterId = null;
    }
  }

  /**
   * Xử lý lỗi kết nối
   */
  handleConnectionError(error) {
    this.isConnected = false;
    this.reconnectAttempts++;

    console.error(`Connection attempt ${this.reconnectAttempts} failed:`, error);

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('websocket-max-retries', {
          attempts: this.reconnectAttempts,
          error: error.message
        });
      }
    } else {
      if (window.electronAPI) {
        window.electronAPI.sendToRenderer('websocket-connection-error', {
          attempt: this.reconnectAttempts,
          error: error.message
        });
      }
    }
  }

  /**
   * Kiểm tra trạng thái kết nối
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      currentCounterId: this.currentCounterId,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

// Export singleton instance
const websocketService = new WebSocketService();
module.exports = websocketService;
```

### 3. Integrate vào Electron Main Process

```javascript
// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const WebSocketService = require('./src/services/websocket.service');

let mainWindow;
let websocketService;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile('src/index.html');

  // Initialize WebSocket service
  websocketService = WebSocketService;
  websocketService.connect();

  // Handle app close
  mainWindow.on('closed', () => {
    if (websocketService) {
      websocketService.disconnect();
    }
    mainWindow = null;
  });
}

// IPC handlers for WebSocket operations
ipcMain.handle('websocket:join-counter', async (event, counterId) => {
  try {
    const success = websocketService.joinCounter(counterId);
    return { success };
  } catch (error) {
    console.error('Failed to join counter:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket:leave-counter', async (event) => {
  try {
    const success = websocketService.leaveCounter();
    return { success };
  } catch (error) {
    console.error('Failed to leave counter:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket:ping', async (event) => {
  try {
    const success = websocketService.ping();
    return { success };
  } catch (error) {
    console.error('Failed to ping:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket:get-online-counters', async (event) => {
  try {
    const success = websocketService.getOnlineCounters();
    return { success };
  } catch (error) {
    console.error('Failed to get online counters:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket:get-status', async (event) => {
  try {
    const status = websocketService.getConnectionStatus();
    return { success: true, status };
  } catch (error) {
    console.error('Failed to get WebSocket status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('websocket:reconnect', async (event) => {
  try {
    if (websocketService) {
      websocketService.disconnect();
    }
    websocketService = WebSocketService;
    websocketService.connect();
    return { success: true };
  } catch (error) {
    console.error('Failed to reconnect:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (websocketService) {
    websocketService.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
```

### 4. Tạo Preload Script

```javascript
// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // WebSocket operations
  joinCounter: (counterId) => ipcRenderer.invoke('websocket:join-counter', counterId),
  leaveCounter: () => ipcRenderer.invoke('websocket:leave-counter'),
  pingWebSocket: () => ipcRenderer.invoke('websocket:ping'),
  getOnlineCounters: () => ipcRenderer.invoke('websocket:get-online-counters'),
  getWebSocketStatus: () => ipcRenderer.invoke('websocket:get-status'),
  reconnectWebSocket: () => ipcRenderer.invoke('websocket:reconnect'),

  // Event listeners from main process
  onWebSocketConnected: (callback) => ipcRenderer.on('websocket-connected', callback),
  onWebSocketDisconnected: (callback) => ipcRenderer.on('websocket-disconnected', callback),
  onCounterJoined: (callback) => ipcRenderer.on('counter-joined', callback),
  onCounterLeft: (callback) => ipcRenderer.on('counter-left', callback),
  onTicketProcessed: (callback) => ipcRenderer.on('ticket-processed', callback),
  onNewTicket: (callback) => ipcRenderer.on('new-ticket', callback),
  onOnlineCounters: (callback) => ipcRenderer.on('online-counters', callback),
  onWebSocketError: (callback) => ipcRenderer.on('websocket-connection-error', callback),
  onWebSocketMaxRetries: (callback) => ipcRenderer.on('websocket-max-retries', callback),

  // Remove listeners
  removeAllListeners: (event) => ipcRenderer.removeAllListeners(event),

  // Send data to renderer (used internally)
  sendToRenderer: (event, data) => ipcRenderer.send('send-to-renderer', event, data),
});
```

### 5. Implement UI trong Renderer Process

```javascript
// src/renderer.js
class CounterApp {
  constructor() {
    this.currentCounterId = localStorage.getItem('counterId') || null;
    this.patientQueue = [];
    this.currentPatient = null;

    this.initializeEventListeners();
    this.connectToWebSocket();
    this.loadInitialData();
  }

  /**
   * Khởi tạo event listeners
   */
  initializeEventListeners() {
    // WebSocket events
    window.electronAPI.onWebSocketConnected((event, data) => {
      this.onWebSocketConnected(data);
    });

    window.electronAPI.onWebSocketDisconnected((event, data) => {
      this.onWebSocketDisconnected(data);
    });

    window.electronAPI.onCounterJoined((event, data) => {
      this.onCounterJoined(data);
    });

    window.electronAPI.onTicketProcessed((event, data) => {
      this.onTicketProcessed(data);
    });

    window.electronAPI.onNewTicket((event, data) => {
      this.onNewTicket(data);
    });

    // UI events
    document.getElementById('join-counter-btn').addEventListener('click', () => {
      this.joinCounter();
    });

    document.getElementById('leave-counter-btn').addEventListener('click', () => {
      this.leaveCounter();
    });

    document.getElementById('next-patient-btn').addEventListener('click', () => {
      this.callNextPatient();
    });

    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });
  }

  /**
   * Kết nối WebSocket
   */
  async connectToWebSocket() {
    try {
      const result = await window.electronAPI.reconnectWebSocket();
      if (result.success) {
        this.updateConnectionStatus('Connecting...');
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      this.updateConnectionStatus('Connection failed');
    }
  }

  /**
   * Load dữ liệu ban đầu
   */
  async loadInitialData() {
    if (this.currentCounterId) {
      await this.refreshData();
    }
  }

  /**
   * Tham gia counter
   */
  async joinCounter() {
    const counterId = document.getElementById('counter-id-input').value.trim();

    if (!counterId) {
      alert('Please enter Counter ID');
      return;
    }

    try {
      this.updateStatus('Joining counter...');
      const result = await window.electronAPI.joinCounter(counterId);

      if (result.success) {
        this.currentCounterId = counterId;
        localStorage.setItem('counterId', counterId); // Lưu để tự động join lại
        await this.refreshData(); // Load queue hiện tại
        this.updateUI();
        this.showNotification(`Connected to counter ${counterId}`, 'success');
      } else {
        alert('Failed to join counter: ' + result.error);
        this.updateStatus('Failed to join counter');
      }
    } catch (error) {
      console.error('Error joining counter:', error);
      alert('Error joining counter: ' + error.message);
    }
  }

  /**
   * Rời khỏi counter
   */
  async leaveCounter() {
    try {
      const result = await window.electronAPI.leaveCounter();

      if (result.success) {
        localStorage.removeItem('counterId'); // Xóa counter ID đã lưu
        this.currentCounterId = null;
        this.patientQueue = [];
        this.currentPatient = null;
        this.updateUI();
        this.showNotification('Left counter', 'info');
      }
    } catch (error) {
      console.error('Error leaving counter:', error);
    }
  }

  /**
   * Gọi bệnh nhân tiếp theo
   */
  async callNextPatient() {
    if (!this.currentCounterId) {
      alert('Please join a counter first');
      return;
    }

    try {
      // Call API to get next patient
      const response = await fetch(`/api/counter-assignment/next-patient/${this.currentCounterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        this.currentPatient = data.patient;
        this.updateUI();
        this.showNotification('Next patient called', 'success');
      } else {
        const error = await response.json();
        alert('Failed to call next patient: ' + error.message);
      }
    } catch (error) {
      console.error('Error calling next patient:', error);
      alert('Error calling next patient');
    }
  }

  /**
   * Refresh data
   */
  async refreshData() {
    if (!this.currentCounterId) return;

    try {
      // Get current patient
      const currentResponse = await fetch(`/api/counter-assignment/counters/${this.currentCounterId}/current-patient`);
      if (currentResponse.ok) {
        const currentData = await currentResponse.json();
        this.currentPatient = currentData.patient;
      }

      // Get queue
      const queueResponse = await fetch(`/api/counter-assignment/counters/${this.currentCounterId}/queue`);
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        this.patientQueue = queueData.queue || [];
      }

      this.updateUI();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  }

  /**
   * WebSocket event handlers
   */
  onWebSocketConnected(data) {
    console.log('WebSocket connected');
    this.updateConnectionStatus('Connected');

    // Auto join counter if saved in localStorage
    const savedCounterId = localStorage.getItem('counterId');
    if (savedCounterId && !this.currentCounterId) {
      console.log('Auto joining saved counter:', savedCounterId);
      this.joinCounterFromSaved(savedCounterId);
    }
  }

  /**
   * Auto join counter from saved data
   */
  async joinCounterFromSaved(counterId) {
    try {
      const result = await window.electronAPI.joinCounter(counterId);
      if (result.success) {
        this.currentCounterId = counterId;
        await this.refreshData();
        this.updateUI();
        this.showNotification(`Auto-connected to counter ${counterId}`, 'success');
      }
    } catch (error) {
      console.error('Auto join failed:', error);
      // Don't show error for auto join
    }
  }

  onWebSocketDisconnected(data) {
    console.log('WebSocket disconnected:', data.reason);
    this.updateConnectionStatus('Disconnected');
  }

  onCounterJoined(data) {
    console.log('Joined counter:', data);
    this.updateStatus(`Joined counter ${data.counterId}`);
    this.showNotification(`Connected to counter ${data.counterId}`, 'success');
  }

  onTicketProcessed(data) {
    console.log('Ticket processed:', data);

    // Update queue if this affects our counter
    if (data.counterId === this.currentCounterId) {
      this.refreshData();
      this.showNotification(`Ticket ${data.ticketId} processed`, 'info');
    }
  }

  onNewTicket(data) {
    console.log('New ticket:', data);

    // Update queue if this affects our counter
    if (data.counterId === this.currentCounterId) {
      this.patientQueue.push(data);
      this.updateUI();
      this.showNotification('New patient in queue', 'info');
    }
  }

  /**
   * Update UI
   */
  updateUI() {
    // Update connection status
    this.updateConnectionStatus(this.currentCounterId ? 'Connected' : 'Not connected');

    // Update counter status
    const counterStatus = document.getElementById('counter-status');
    if (this.currentCounterId) {
      counterStatus.textContent = `Counter: ${this.currentCounterId}`;
      counterStatus.className = 'status active';
    } else {
      counterStatus.textContent = 'No counter selected';
      counterStatus.className = 'status inactive';
    }

    // Update current patient
    const currentPatientDiv = document.getElementById('current-patient');
    if (this.currentPatient) {
      currentPatientDiv.innerHTML = `
        <h3>Current Patient</h3>
        <div class="patient-card current">
          <div class="patient-info">
            <strong>${this.currentPatient.patientName}</strong><br>
            <small>Ticket: ${this.currentPatient.queueNumber}</small><br>
            <small>Priority: ${this.currentPatient.priorityLevel}</small>
          </div>
        </div>
      `;
    } else {
      currentPatientDiv.innerHTML = '<p>No current patient</p>';
    }

    // Update queue
    const queueDiv = document.getElementById('patient-queue');
    queueDiv.innerHTML = '<h3>Patient Queue</h3>';

    if (this.patientQueue.length === 0) {
      queueDiv.innerHTML += '<p>No patients in queue</p>';
    } else {
      this.patientQueue.forEach((patient, index) => {
        const patientCard = document.createElement('div');
        patientCard.className = 'patient-card';
        patientCard.innerHTML = `
          <div class="patient-info">
            <strong>${patient.patientName}</strong><br>
            <small>Ticket: ${patient.queueNumber}</small><br>
            <small>Priority: ${patient.priorityLevel}</small>
          </div>
          <div class="queue-position">#${index + 1}</div>
        `;
        queueDiv.appendChild(patientCard);
      });
    }
  }

  updateConnectionStatus(status) {
    const statusDiv = document.getElementById('connection-status');
    statusDiv.textContent = `WebSocket: ${status}`;

    if (status === 'Connected') {
      statusDiv.className = 'status active';
    } else {
      statusDiv.className = 'status inactive';
    }
  }

  updateStatus(message) {
    const statusDiv = document.getElementById('app-status');
    statusDiv.textContent = message;

    // Clear status after 3 seconds
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
  }

  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.counterApp = new CounterApp();
});
```

### 6. HTML Template

```html
<!-- src/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Counter Desktop App</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }

        .status {
            padding: 8px 16px;
            border-radius: 4px;
            font-weight: bold;
            display: inline-block;
            margin: 5px 0;
        }

        .status.active {
            background-color: #d4edda;
            color: #155724;
        }

        .status.inactive {
            background-color: #f8d7da;
            color: #721c24;
        }

        .controls {
            display: flex;
            gap: 10px;
            align-items: center;
            margin-bottom: 20px;
        }

        input, button {
            padding: 8px 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
        }

        button {
            background-color: #007bff;
            color: white;
            border: none;
            cursor: pointer;
        }

        button:hover {
            background-color: #0056b3;
        }

        button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }

        .main-content {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }

        .panel {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .patient-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
            background: #f8f9fa;
        }

        .patient-card.current {
            background: #e3f2fd;
            border-color: #2196f3;
        }

        .patient-info {
            flex-grow: 1;
        }

        .queue-position {
            background: #007bff;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            align-self: flex-start;
        }

        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease-out;
        }

        .notification.success {
            background-color: #28a745;
        }

        .notification.error {
            background-color: #dc3545;
        }

        .notification.info {
            background-color: #17a2b8;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Counter Desktop Application</h1>

        <div class="controls">
            <div id="connection-status" class="status inactive">WebSocket: Disconnected</div>
            <div id="counter-status" class="status inactive">No counter selected</div>
            <div id="app-status"></div>
        </div>

        <div class="controls">
            <input type="text" id="counter-id-input" placeholder="Enter Counter ID (e.g: CTR001)" />
            <button id="join-counter-btn">Join Counter</button>
            <button id="leave-counter-btn">Leave Counter</button>
            <button id="next-patient-btn">Call Next Patient</button>
            <button id="refresh-btn">Refresh</button>
        </div>

        <script>
            // Auto fill saved counter ID
            document.addEventListener('DOMContentLoaded', function() {
                const savedCounterId = localStorage.getItem('counterId');
                if (savedCounterId) {
                    document.getElementById('counter-id-input').value = savedCounterId;
                }
            });
        </script>
    </div>

    <div class="main-content">
        <div class="panel">
            <div id="current-patient">
                <h3>Current Patient</h3>
                <p>No current patient</p>
            </div>
        </div>

        <div class="panel">
            <div id="patient-queue">
                <h3>Patient Queue</h3>
                <p>No patients in queue</p>
            </div>
        </div>
    </div>

    <script src="renderer.js"></script>
</body>
</html>
```

### 7. Cập nhật main.js để forward WebSocket events

```javascript
// Trong main.js, thêm code để forward events từ WebSocket service

// WebSocket event forwarding
websocketService.socket?.on('joined_counter', (data) => {
  mainWindow.webContents.send('counter-joined', data);
});

websocketService.socket?.on('left_counter', (data) => {
  mainWindow.webContents.send('counter-left', data);
});

websocketService.socket?.on('ticket_processed', (data) => {
  mainWindow.webContents.send('ticket-processed', data);
});

websocketService.socket?.on('new_ticket', (data) => {
  mainWindow.webContents.send('new-ticket', data);
});

websocketService.socket?.on('online_counters', (data) => {
  mainWindow.webContents.send('online-counters', data);
});
```

## 📋 API Endpoints cần thiết cho Desktop App

### 🎫 **TAKE NUMBER SYSTEM** (CHÍNH) - Kiosk Flow:
- `POST /api/take-number/take` - **MÁY KIOSK gọi để bốc số & phân công tự động**
  - Input: Thông tin bệnh nhân + ưu tiên (cấp cứu, thai phụ, người già, VIP)
  - Logic: Server tự động phân công vào counter phù hợp nhất
  - Output: Số thứ tự + thông tin counter
- `GET /api/take-number/tickets/counter/{counterId}` - **Counter app lấy tickets của mình**
- WebSocket events: Nhận real-time khi có ticket mới cho counter

### 🔧 **COUNTER MANAGEMENT** (Counter App Operations):
- `POST /api/counter-assignment/next-patient/{counterId}` ⭐ **MAIN ACTION** - Gọi bệnh nhân tiếp theo
- `POST /api/counter-assignment/skip-current/{counterId}` - Bỏ qua bệnh nhân hiện tại
- `GET /api/counter-assignment/counters/{counterId}/current-patient` - Lấy bệnh nhân đang phục vụ
- `GET /api/counter-assignment/counters/{counterId}/queue` - Xem queue của counter

### ❌ **ĐÃ XÓA - 4 endpoints phân công thủ công:**
- ~~`POST /api/counter-assignment/assign`~~ - Phân công thủ công
- ~~`POST /api/counter-assignment/scan-invoice`~~ - Scan invoice manual
- ~~`POST /api/counter-assignment/direct-assignment`~~ - Walk-in manual
- ~~`POST /api/counter-assignment/simple-assignment`~~ - Emergency manual


### 🌐 **WebSocket Events** (Real-time Updates):
- `ticket_processed` - Có ticket được xử lý
- `new_ticket` - Có ticket mới trong hệ thống
- `joined_counter` - Tham gia counter thành công
- `online_counters` - Danh sách counters online

## 🎯 **Vai trò của Desktop Counter App:**

### **❌ KHÔNG phải:**
- Gọi API bốc số (`POST /api/take-number/take`)
- Phân công bệnh nhân thủ công (đã xóa 4 endpoints backup)
- Quản lý kiosk
- Tham gia vào logic assignment

### **✅ CHỈ:**
- **Lắng nghe real-time** các ticket từ kiosk tự động
- **Hiển thị queue** bệnh nhân được kiosk phân công
- **Quản lý counter operations** (gọi next, skip, complete)
- **Cập nhật UI** khi kiosk tạo ticket mới

## 🚀 **Các bước triển khai:**

1. **Cài đặt dependencies**: `socket.io-client`
2. **Tạo WebSocket service** để kết nối đến namespace `/counters`
3. **Implement join counter** để lắng nghe events của counter cụ thể
4. **Xử lý WebSocket events**: `new_ticket`, `ticket_processed`, etc.
5. **Tạo UI** hiển thị current patient + patient queue từ kiosk
6. **Implement counter operations**: Chỉ `next-patient`, `skip-current` (không cần manual assignment)
7. **Auto-reconnect** và error handling
8. **Persist counter ID** trong localStorage để tự động kết nối lại

### **🎯 Luồng hoạt động:**
```
1. Counter app khởi động → Tự động join counter đã lưu
2. Kiosk tạo ticket → WebSocket broadcast `new_ticket`
3. Counter app nhận → Thêm vào queue display
4. Nhân viên nhấn "Next" → Gọi API next-patient
5. Ticket được xử lý → WebSocket broadcast `ticket_processed`
```

## 🔧 Troubleshooting:

### Connection Issues:
- Kiểm tra server có chạy trên port 3000
- Verify CORS settings
- Check firewall settings

### WebSocket Events không nhận được:
- Đảm bảo đã join counter đúng
- Kiểm tra counterId có tồn tại
- Verify event names match với server

### UI không update:
- Check WebSocket connection status
- Verify event forwarding từ main process
- Debug với console.log trong renderer

File này cung cấp framework hoàn chỉnh để implement WebSocket client cho desktop counter app!
