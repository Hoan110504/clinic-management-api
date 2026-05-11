/**
 * Test Script: Verify Socket Notification Logic
 * 
 * Mục đích: Kiểm tra xem thông báo có được gửi đúng cho bác sĩ theo UserID không
 * 
 * Cách chạy:
 * 1. Đảm bảo backend server đang chạy (npm run dev)
 * 2. Chạy script: node test-socket-notification.mjs
 */

import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

// Mock data
const DOCTOR_USER_ID = 2; // Thay bằng ID bác sĩ thực tế trong DB
const RECEPTIONIST_USER_ID = 3; // Thay bằng ID lễ tân thực tế trong DB

console.log('🔌 Connecting to Socket.IO server...');

// Simulate Doctor connection
const doctorSocket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  path: '/socket.io'
});

// Simulate Receptionist connection
const receptionistSocket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  path: '/socket.io'
});

doctorSocket.on('connect', () => {
  console.log('✅ Doctor connected:', doctorSocket.id);
  doctorSocket.emit('user:join', {
    userId: DOCTOR_USER_ID,
    role: 2, // ROLES.DOCTOR
  });
});

receptionistSocket.on('connect', () => {
  console.log('✅ Receptionist connected:', receptionistSocket.id);
  receptionistSocket.emit('user:join', {
    userId: RECEPTIONIST_USER_ID,
    role: 3, // ROLES.RECEPTIONIST
  });
});

// Doctor listens for notifications
doctorSocket.on('notification:new', (data) => {
  console.log('📬 [Doctor] Received notification:new:', data);
});

doctorSocket.on('appointment:new', (data) => {
  console.log('📅 [Doctor] Received appointment:new:', data);
});

doctorSocket.on('patient:arrived', (data) => {
  console.log('🏥 [Doctor] Received patient:arrived:', data);
});

// Receptionist listens for notifications
receptionistSocket.on('notification:new', (data) => {
  console.log('📬 [Receptionist] Received notification:new:', data);
});

receptionistSocket.on('appointment:new', (data) => {
  console.log('📅 [Receptionist] Received appointment:new:', data);
});

// Error handlers
doctorSocket.on('connect_error', (error) => {
  console.error('❌ Doctor connection error:', error.message);
});

receptionistSocket.on('connect_error', (error) => {
  console.error('❌ Receptionist connection error:', error.message);
});

// Keep script running
console.log('\n📡 Listening for notifications...');
console.log('💡 Tip: Tạo lịch hẹn mới hoặc xác nhận đã tới để test\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Disconnecting...');
  doctorSocket.disconnect();
  receptionistSocket.disconnect();
  process.exit(0);
});
