const API_BASE = 'http://localhost:5004/api';

// Test login và tạo bệnh nhân mới
async function testCreatePatient() {
  console.log('🔐 Đang đăng nhập...');
  
  try {
    // Login
    const loginResponse = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });

    const loginData = await loginResponse.json();
    if (!loginData.success || !loginData.data.accessToken) {
      throw new Error('Login failed: ' + JSON.stringify(loginData));
    }

    const token = loginData.data.accessToken;
    console.log('✅ Đăng nhập thành công');

    // Tạo bệnh nhân mới
    console.log('\n📝 Tạo bệnh nhân mới...');
    const patientData = {
      fullName: 'Nguyễn Văn Test',
      dateOfBirth: '1990-01-01',
      gender: 'Nam',
      phone: '0901234567',
      email: 'test@example.com',
      address: 'Hà Nội',
      idNumber: '123456789012'
      // Không truyền status để test default value
    };

    const createResponse = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patientData)
    });

    const createData = await createResponse.json();
    
    if (createData.success) {
      console.log('✅ Tạo bệnh nhân thành công');
      console.log(`ID: ${createData.data.id}`);
      console.log(`Tên: ${createData.data.fullName}`);
      console.log(`Status: ${createData.data.status} (${createData.data.status === 1 ? 'Hoạt động' : 'Không hoạt động'})`);
      
      if (createData.data.status === 1) {
        console.log('🎉 Status mặc định đã được set thành 1 (Hoạt động) - THÀNH CÔNG!');
      } else {
        console.log('❌ Status mặc định không phải là 1 - CẦN KIỂM TRA!');
      }
    } else {
      console.log('❌ Tạo bệnh nhân thất bại:', createData.error?.message || 'Unknown error');
    }

  } catch (error) {
    console.error('❌ Lỗi:', error.message);
  }
}

testCreatePatient();