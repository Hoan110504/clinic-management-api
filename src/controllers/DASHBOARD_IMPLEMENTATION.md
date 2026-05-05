# Dashboard Implementation Guide

## Overview

The dashboard system provides role-based statistics and metrics for all user types in the clinic management system. Each role has a dedicated endpoint that returns filtered, aggregated data.

## API Endpoints

All endpoints require authentication (JWT token in Authorization header).

### Admin Dashboard
**Endpoint**: `GET /api/dashboard/admin`
**Access**: Admin only
**Description**: System-wide statistics and metrics

**Response**:
```javascript
{
  success: true,
  data: {
    userCounts: [
      { role: 1, count: 5 },      // Admin count
      { role: 2, count: 10 },     // Doctor count
      { role: 3, count: 8 },      // Receptionist count
      { role: 4, count: 3 },      // Pharmacist count
      { role: 5, count: 500 }     // Patient count
    ],
    totalPatients: 500,
    todayAppointments: 25,
    todayRevenue: 5000000,        // VND
    pendingPayments: 8,           // Count of unpaid invoices
    lowStockCount: 3,             // Medicines with quantity <= min_quantity
    recentAppointments: [
      {
        id: 1,
        patientName: 'Nguyễn Văn A',
        appointmentDate: '2024-01-15',
        timeSlot: '09:00',
        status: 'Đã đặt lịch',
        // ... full appointment object
      }
    ]
  }
}
```

### Doctor Dashboard
**Endpoint**: `GET /api/dashboard/doctor`
**Access**: Doctor only
**Description**: Doctor-specific statistics filtered by doctorId

**Response**:
```javascript
{
  success: true,
  data: {
    todayAppointments: [
      {
        id: 1,
        patientName: 'Nguyễn Văn A',
        appointmentDate: '2024-01-15',
        timeSlot: '09:00',
        status: 'Chờ khám',
        patient: {
          id: 1,
          fullName: 'Nguyễn Văn A',
          phone: '0123456789',
          dateOfBirth: '1990-01-01',
          gender: 'Nam',
          allergies: 'Penicillin'
        }
      }
    ],
    waitingPatients: 5,           // Count of patients with status = WAITING
    inProgressCount: 2,           // Count of patients with status = IN_PROGRESS
    completedToday: 8,            // Count of patients with status = COMPLETED
    pendingLabResults: 3          // Count of lab tests not yet completed
  }
}
```

### Receptionist Dashboard
**Endpoint**: `GET /api/dashboard/receptionist`
**Access**: Receptionist only
**Description**: Reception-specific statistics

**Response**:
```javascript
{
  success: true,
  data: {
    appointmentsByStatus: [
      { status: 'Đã đặt lịch', count: 10 },
      { status: 'Đã xác nhận', count: 8 },
      { status: 'Chờ khám', count: 5 },
      { status: 'Đang khám', count: 2 },
      { status: 'Đã hoàn thành', count: 0 },
      { status: 'Đã hủy', count: 1 }
    ],
    upcomingAppointments: [
      {
        id: 1,
        patientName: 'Nguyễn Văn A',
        appointmentDate: '2024-01-15',
        timeSlot: '09:00',
        status: 'Đã đặt lịch'
      }
    ],
    unpaidPayments: [
      {
        id: 1,
        patientId: 1,
        totalAmount: 500000,
        invoiceDate: '2024-01-14',
        patient: {
          id: 1,
          fullName: 'Nguyễn Văn A',
          phone: '0123456789'
        }
      }
    ],
    newPatientsToday: 3           // Count of patients created today
  }
}
```

### Pharmacist Dashboard
**Endpoint**: `GET /api/dashboard/pharmacist`
**Access**: Pharmacist only
**Description**: Pharmacy-specific statistics

**Response**:
```javascript
{
  success: true,
  data: {
    pendingPrescriptions: [
      {
        prescriptionId: 1,
        examinationId: 1,
        doctorId: 2,
        prescriptionDate: '2024-01-15',
        notes: 'Take with food',
        status: 0,                // 0 = waiting, 1 = dispensed, 2 = cancelled
        patient: {
          id: 1,
          fullName: 'Nguyễn Văn A',
          phone: '0123456789'
        },
        doctor: {
          id: 2,
          fullName: 'Trần Thị B'
        }
      }
    ],
    lowStockMedicines: [
      {
        medicineId: 1,
        medicineName: 'Aspirin',
        quantity: 5,
        min_quantity: 10
      }
    ],
    expiringMedicines: [
      {
        medicineId: 2,
        medicineName: 'Paracetamol',
        expiryDate: '2024-02-15',
        quantity: 50
      }
    ],
    dispensedToday: 12            // Count of prescriptions dispensed today
  }
}
```

### Patient Dashboard
**Endpoint**: `GET /api/dashboard/patient`
**Access**: Patient only
**Description**: Patient-specific information filtered by patientId

**Response**:
```javascript
{
  success: true,
  data: {
    patient: {
      id: 1,
      userId: 1,
      fullName: 'Nguyễn Văn A',
      dateOfBirth: '1990-01-01',
      gender: 'Nam',
      phone: '0123456789',
      email: 'patient@example.com',
      address: '123 Main St',
      idNumber: '123456789',
      medicalHistory: 'Hypertension',
      allergies: 'Penicillin'
    },
    upcomingAppointments: [
      {
        id: 1,
        patientId: 1,
        appointmentDate: '2024-01-20',
        timeSlot: '10:00',
        status: 'Đã đặt lịch',
        assignedDoctor: {
          id: 2,
          fullName: 'Trần Thị B'
        }
      }
    ],
    recentRecords: [
      {
        id: 1,
        patientId: 1,
        doctorId: 2,
        createdAt: '2024-01-15',
        diagnosis: 'Hypertension',
        doctor: {
          id: 2,
          fullName: 'Trần Thị B'
        }
      }
    ],
    pendingPayments: [
      {
        id: 1,
        patientId: 1,
        totalAmount: 500000,
        invoiceDate: '2024-01-14',
        status: 0                 // 0 = unpaid
      }
    ],
    recentLabResults: [
      {
        id: 1,
        patientId: 1,
        testName: 'Blood Test',
        resultDate: '2024-01-15',
        status: 'Hoàn thành'
      }
    ]
  }
}
```

## Implementation Details

### Database Queries

#### Admin Dashboard
- **User Counts**: `SELECT role, COUNT(*) FROM users WHERE isActive = true GROUP BY role`
- **Total Patients**: `SELECT COUNT(*) FROM Patients`
- **Today's Appointments**: `SELECT COUNT(*) FROM Appointments WHERE appointmentDate BETWEEN today AND tomorrow`
- **Today's Revenue**: `SELECT SUM(totalAmount) FROM Payments WHERE invoiceDate BETWEEN today AND tomorrow AND status = PAID`
- **Pending Payments**: `SELECT COUNT(*) FROM Payments WHERE status = UNPAID`
- **Low Stock**: `SELECT COUNT(*) FROM Medicines WHERE isActive = true AND quantity <= min_quantity`
- **Recent Appointments**: `SELECT * FROM Appointments WHERE appointmentDate >= today ORDER BY appointmentDate, timeSlot LIMIT 10`

#### Doctor Dashboard
- **Today's Appointments**: Filtered by `assignedDoctorId = req.user.id`
- **Waiting Patients**: Count of MedicalRecords with `doctorId = req.user.id AND status = WAITING`
- **In Progress**: Count of MedicalRecords with `doctorId = req.user.id AND status = IN_PROGRESS`
- **Completed Today**: Count of MedicalRecords with `doctorId = req.user.id AND status = COMPLETED AND completedAt TODAY`
- **Pending Lab Results**: Count of LabTests with `orderedById = req.user.id AND status IN (PENDING, IN_PROGRESS)`

#### Receptionist Dashboard
- **Appointments by Status**: `SELECT status, COUNT(*) FROM Appointments WHERE appointmentDate BETWEEN today AND tomorrow GROUP BY status`
- **Upcoming Appointments**: `SELECT * FROM Appointments WHERE appointmentDate BETWEEN today AND tomorrow AND status IN (SCHEDULED, CONFIRMED) ORDER BY timeSlot LIMIT 10`
- **Unpaid Payments**: `SELECT * FROM Payments WHERE status = UNPAID ORDER BY createdAt LIMIT 10`
- **New Patients Today**: `SELECT COUNT(*) FROM Patients WHERE createdAt BETWEEN today AND tomorrow`

#### Pharmacist Dashboard
- **Pending Prescriptions**: `SELECT * FROM Prescriptions WHERE status = 0 ORDER BY prescriptionDate LIMIT 20`
- **Low Stock**: `SELECT * FROM Medicines WHERE isActive = true AND quantity <= min_quantity ORDER BY quantity LIMIT 10`
- **Expiring Medicines**: `SELECT * FROM Medicines WHERE isActive = true AND expiryDate BETWEEN now AND now+30days ORDER BY expiryDate LIMIT 10`
- **Dispensed Today**: `SELECT COUNT(*) FROM Prescriptions WHERE status = 1 AND dispensedAt BETWEEN today AND tomorrow`

#### Patient Dashboard
- **Patient Info**: `SELECT * FROM Patients WHERE userId = req.user.id`
- **Upcoming Appointments**: `SELECT * FROM Appointments WHERE patientId = patient.id AND appointmentDate >= today AND status NOT IN (CANCELLED, COMPLETED) ORDER BY appointmentDate, timeSlot LIMIT 5`
- **Recent Records**: `SELECT * FROM MedicalRecords WHERE patientId = patient.id ORDER BY createdAt DESC LIMIT 5`
- **Pending Payments**: `SELECT * FROM Payments WHERE patientId = patient.id AND status = UNPAID ORDER BY createdAt DESC LIMIT 5`
- **Lab Results**: `SELECT * FROM LabTests WHERE patientId = patient.id AND status = COMPLETED ORDER BY resultDate DESC LIMIT 5`

### Error Handling

All endpoints use the `asyncHandler` wrapper which automatically catches errors and returns:

```javascript
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: 'Error message',
    statusCode: 500
  }
}
```

### Performance Considerations

1. **Indexes**: Ensure indexes on:
   - `Appointments.appointmentDate`
   - `Appointments.assignedDoctorId`
   - `Appointments.status`
   - `Payments.invoiceDate`
   - `Payments.status`
   - `Medicines.quantity`
   - `Medicines.expiryDate`
   - `Prescriptions.status`
   - `MedicalRecords.doctorId`
   - `MedicalRecords.status`

2. **Query Optimization**:
   - Use `include` for eager loading related data
   - Limit result sets with `limit` and `offset`
   - Use `attributes` to select only needed columns
   - Group queries where possible

3. **Caching** (Future Enhancement):
   - Cache dashboard data for 30-60 seconds
   - Invalidate cache on data mutations
   - Use Redis for distributed caching

## Testing

### Unit Tests

```javascript
describe('Dashboard Controller', () => {
  describe('getAdminDashboard', () => {
    it('should return admin dashboard data', async () => {
      const req = { user: { id: 1, role: ROLES.ADMIN } };
      const res = { json: jest.fn() };
      
      await getAdminDashboard(req, res);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            userCounts: expect.any(Array),
            totalPatients: expect.any(Number),
          })
        })
      );
    });
  });
});
```

### Integration Tests

```javascript
describe('Dashboard API', () => {
  it('GET /api/dashboard/admin should return admin data', async () => {
    const response = await request(app)
      .get('/api/dashboard/admin')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('userCounts');
  });
});
```

## Maintenance

### Regular Tasks

1. **Monitor Performance**: Check query execution times
2. **Update Indexes**: Add indexes for new filters
3. **Review Data Accuracy**: Verify calculations match business logic
4. **Test Edge Cases**: Empty data, large datasets, etc.

### Common Issues

1. **Slow Queries**: Add indexes, optimize joins
2. **Incorrect Counts**: Verify WHERE clauses and status codes
3. **Missing Data**: Check relationships and foreign keys
4. **Timezone Issues**: Ensure consistent timezone handling

## Future Enhancements

- [ ] Add date range filtering
- [ ] Add export to PDF/Excel
- [ ] Add real-time WebSocket updates
- [ ] Add caching layer
- [ ] Add advanced filtering
- [ ] Add comparison views (YoY, MoM)
- [ ] Add predictive analytics
- [ ] Add custom report builder
