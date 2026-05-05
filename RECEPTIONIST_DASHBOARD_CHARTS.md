# Receptionist Dashboard Charts Implementation

## Overview
Added three interactive charts to the Receptionist Dashboard to visualize appointment and payment data:
1. **Line Chart** — Appointments by month (12 months)
2. **Doughnut Chart** — Payment status distribution
3. **Doughnut Chart** — Appointment status distribution (with corrected status mapping)

## Backend Implementation

### Data Calculations in `getReceptionistDashboard()`

#### Chart 1: Appointments by Month (Line Chart)
```javascript
// Fetches all appointments in the system
// Groups by month (1-12)
// Returns: [{ month: 'Jan', count: 0 }, { month: 'Feb', count: 5 }, ...]
appointmentsByMonth = [
  { month: 'Jan', count: 0 },
  { month: 'Feb', count: 5 },
  // ... all 12 months
]
```

**Logic:**
- Fetch all appointments (no date filter)
- Initialize all 12 months with count = 0
- Iterate through appointments and count by month
- Return array with month names and counts

#### Chart 2: Payment Status Distribution (Doughnut Chart)
```javascript
// Fetches all payments in the system
// Groups by status code (0, 1)
// Returns: [{ label: 'Chưa thanh toán', count: 15 }, ...]
paymentStatusDistribution = [
  { label: 'Chưa thanh toán', count: 15 },  // status: 0
  { label: 'Đã thanh toán', count: 42 },    // status: 1
]
```

**Status Mapping:**
- `0` = Chưa thanh toán (Unpaid)
- `1` = Đã thanh toán (Paid)

**Logic:**
- Fetch all payments
- Initialize status map with both statuses
- Count payments by status
- Filter out statuses with count = 0
- Return array with labels and counts

#### Chart 3: Appointment Status Distribution (Doughnut Chart)
```javascript
// Fetches all appointments in the system
// Groups by status code (1, 2, 3, 4)
// Returns: [{ label: 'Đã đặt', count: 20 }, ...]
appointmentStatusDistribution = [
  { label: 'Đã đặt', count: 20 },        // status: 1
  { label: 'Chờ khám', count: 8 },       // status: 2
  { label: 'Hoàn thành', count: 35 },    // status: 3
  { label: 'Đã hủy', count: 2 },         // status: 4
]
```

**Status Mapping (Corrected):**
- `1` = Đã đặt (Scheduled)
- `2` = Chờ khám (Waiting for Examination)
- `3` = Hoàn thành (Completed)
- `4` = Đã hủy (Cancelled)

**Logic:**
- Fetch all appointments
- Initialize status map with all 4 statuses
- Count appointments by status
- Filter out statuses with count = 0
- Return array with labels and counts

### Error Handling
All three chart data calculations are wrapped in try-catch blocks:
- If data fetch fails, returns empty array `[]`
- Logs warning message for debugging
- Dashboard displays empty chart gracefully

## Frontend Implementation

### ReceptionistDashboard.jsx Updates

#### Imports
Already had `DashboardChartWidget` imported.

#### Chart Section
Added 3-column responsive grid with all three charts:
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Chart 1: Line Chart */}
  <DashboardChartWidget
    type="line"
    title="Số lịch hẹn theo tháng"
    data={data?.appointmentsByMonth || []}
    xAxisKey="month"
    dataKey="count"
    loading={loading}
    height={300}
  />

  {/* Chart 2: Doughnut Chart - Payment Status */}
  <DashboardChartWidget
    type="doughnut"
    title="Trạng thái thanh toán"
    data={data?.paymentStatusDistribution || []}
    xAxisKey="label"
    dataKey="count"
    loading={loading}
    height={300}
  />

  {/* Chart 3: Doughnut Chart - Appointment Status */}
  <DashboardChartWidget
    type="doughnut"
    title="Trạng thái lịch hẹn"
    data={data?.appointmentStatusDistribution || []}
    xAxisKey="label"
    dataKey="count"
    loading={loading}
    height={300}
  />
</div>
```

#### Positioning
Charts are positioned:
- After main stats grid
- After alerts section
- Before upcoming appointments list

#### Cleanup
- Removed unused `Card` and `CardHeader` imports
- Removed unused `statusChartData` variable
- Removed unused `getStatusLabel()` function
- Removed unused `StatRow` component

## Data Flow

```
Receptionist Login
    ↓
useDashboard Hook
    ↓
GET /api/dashboard/receptionist
    ↓
Backend: getReceptionistDashboard()
    ├─ Fetch appointments by status (today)
    ├─ Fetch upcoming appointments
    ├─ Fetch unpaid payments
    ├─ Calculate appointmentsByMonth (NEW)
    ├─ Calculate paymentStatusDistribution (NEW)
    └─ Calculate appointmentStatusDistribution (NEW - with corrected mapping)
    ↓
Response with chart data
    ↓
Frontend: ReceptionistDashboard.jsx
    ├─ Display stats
    ├─ Display charts (NEW)
    ├─ Display alerts
    └─ Display lists
```

## API Response Structure

```json
{
  "success": true,
  "data": {
    "appointmentsByStatus": [ ... ],
    "upcomingAppointments": [ ... ],
    "unpaidPayments": [ ... ],
    "newPatientsToday": 0,
    "appointmentsByMonth": [
      { "month": "Jan", "count": 0 },
      { "month": "Feb", "count": 5 },
      ...
    ],
    "paymentStatusDistribution": [
      { "label": "Chưa thanh toán", "count": 15 },
      { "label": "Đã thanh toán", "count": 42 }
    ],
    "appointmentStatusDistribution": [
      { "label": "Đã đặt", "count": 20 },
      { "label": "Chờ khám", "count": 8 },
      { "label": "Hoàn thành", "count": 35 },
      { "label": "Đã hủy", "count": 2 }
    ]
  }
}
```

## Features

✅ **Line Chart Features:**
- Shows all 12 months
- Smooth curve with tension
- Interactive points with hover effect
- Area fill under line
- Responsive sizing

✅ **Doughnut Charts Features:**
- Color-coded by category
- Only shows categories with data
- Interactive tooltips
- Responsive sizing

✅ **Error Handling:**
- Graceful fallback to empty charts
- No 500 errors
- Console warnings for debugging

✅ **Performance:**
- In-memory filtering (no complex DB queries)
- Efficient data grouping
- Minimal API payload

## Status Mapping Corrections

### Appointment Status (Corrected)
Changed from 0-3 to 1-4 mapping:
- Old: 0=Đã lên lịch, 1=Xác nhận, 2=Hoàn thành, 3=Hủy
- New: 1=Đã đặt, 2=Chờ khám, 3=Hoàn thành, 4=Đã hủy

This correction applies to:
- Receptionist Dashboard (new)
- Patient Dashboard (updated)

## Testing

To test the charts:
1. Login as receptionist
2. Navigate to Receptionist Dashboard
3. Verify all three charts display
4. Check data accuracy against appointments and payments
5. Test responsive layout on mobile

## Files Modified

- `backend/src/controllers/dashboard.controller.js` — Added chart data calculations
- `frontend/src/pages/dashboards/ReceptionistDashboard.jsx` — Added chart components and cleaned up unused code
