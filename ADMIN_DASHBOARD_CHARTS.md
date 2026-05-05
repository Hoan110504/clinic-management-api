# Admin Dashboard Charts Implementation

## Overview
Added four interactive charts to the Admin Dashboard to visualize system-wide data:
1. **Line Chart** — Appointments by month (12 months)
2. **Bar Chart** — Revenue by month (12 months)
3. **Doughnut Chart** — Appointment status distribution
4. **Doughnut Chart** — Payment status distribution

## Backend Implementation

### Data Calculations in `getAdminDashboard()`

#### Chart 1: Appointments by Month (Line Chart)
```javascript
// Fetches all appointments in the system
// Groups by month (1-12)
// Returns: [{ month: 'Jan', count: 0 }, { month: 'Feb', count: 15 }, ...]
appointmentsByMonth = [
  { month: 'Jan', count: 0 },
  { month: 'Feb', count: 15 },
  // ... all 12 months
]
```

**Logic:**
- Fetch all appointments (no filters)
- Initialize all 12 months with count = 0
- Iterate through appointments and count by month
- Return array with month names and counts

#### Chart 2: Revenue by Month (Bar Chart)
```javascript
// Fetches all paid payments in the system
// Groups by month (1-12)
// Returns: [{ month: 'Jan', revenue: 0 }, { month: 'Feb', revenue: 5000000 }, ...]
revenueByMonth = [
  { month: 'Jan', revenue: 0 },
  { month: 'Feb', revenue: 5000000 },
  // ... all 12 months
]
```

**Logic:**
- Fetch all payments with status = PAID
- Initialize all 12 months with revenue = 0
- Sum totalAmount by month
- Return array with month names and revenue

#### Chart 3: Appointment Status Distribution (Doughnut Chart)
```javascript
// Fetches all appointments in the system
// Groups by status code (1, 2, 3, 4)
// Returns: [{ label: 'Đã đặt', count: 50 }, ...]
appointmentStatusDistribution = [
  { label: 'Đã đặt', count: 50 },        // status: 1
  { label: 'Chờ khám', count: 20 },      // status: 2
  { label: 'Hoàn thành', count: 100 },   // status: 3
  { label: 'Đã hủy', count: 5 },         // status: 4
]
```

**Status Mapping:**
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

#### Chart 4: Payment Status Distribution (Doughnut Chart)
```javascript
// Fetches all payments in the system
// Groups by status code (0, 1)
// Returns: [{ label: 'Chưa thanh toán', count: 30 }, ...]
paymentStatusDistribution = [
  { label: 'Chưa thanh toán', count: 30 },  // status: 0
  { label: 'Đã thanh toán', count: 120 },   // status: 1
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

### Error Handling
All four chart data calculations are wrapped in try-catch blocks:
- If data fetch fails, returns empty array `[]`
- Logs warning message for debugging
- Dashboard displays empty chart gracefully

## Frontend Implementation

### AdminDashboard.jsx Updates

#### Imports
Already had `DashboardChartWidget` imported.

#### Chart Section
Added 2x2 responsive grid with all four charts:
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Chart 1: Line Chart */}
  <DashboardChartWidget
    type="line"
    title="Lịch hẹn theo tháng"
    data={data?.appointmentsByMonth || []}
    xAxisKey="month"
    dataKey="count"
    loading={loading}
    height={300}
  />

  {/* Chart 2: Bar Chart */}
  <DashboardChartWidget
    type="bar"
    title="Doanh thu theo tháng"
    data={data?.revenueByMonth || []}
    xAxisKey="month"
    dataKey="revenue"
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

  {/* Chart 4: Doughnut Chart - Payment Status */}
  <DashboardChartWidget
    type="doughnut"
    title="Trạng thái thanh toán"
    data={data?.paymentStatusDistribution || []}
    xAxisKey="label"
    dataKey="count"
    loading={loading}
    height={300}
  />
</div>
```

#### Cleanup
- Removed unused `useState` import
- Removed unused `Card`, `CardHeader`, `EmptyState` imports
- Removed unused `TrendingUp` icon import
- Removed unused `selectedPeriod` state
- Removed unused `userCountsData` variable
- Removed unused `getRoleLabel()` function

## Data Flow

```
Admin Login
    ↓
useDashboard Hook
    ↓
GET /api/dashboard/admin
    ↓
Backend: getAdminDashboard()
    ├─ Fetch user counts
    ├─ Fetch total patients
    ├─ Fetch today's appointments
    ├─ Fetch today's revenue
    ├─ Fetch pending payments
    ├─ Fetch low stock count
    ├─ Fetch recent appointments
    ├─ Calculate appointmentsByMonth (NEW)
    ├─ Calculate revenueByMonth (NEW)
    ├─ Calculate appointmentStatusDistribution (NEW)
    └─ Calculate paymentStatusDistribution (NEW)
    ↓
Response with chart data
    ↓
Frontend: AdminDashboard.jsx
    ├─ Display stats
    ├─ Display charts (NEW)
    └─ Display lists
```

## API Response Structure

```json
{
  "success": true,
  "data": {
    "userCounts": [ ... ],
    "totalPatients": 150,
    "todayAppointments": 12,
    "todayRevenue": 5000000,
    "pendingPayments": 8,
    "lowStockCount": 5,
    "recentAppointments": [ ... ],
    "appointmentsByMonth": [
      { "month": "Jan", "count": 0 },
      { "month": "Feb", "count": 15 },
      ...
    ],
    "revenueByMonth": [
      { "month": "Jan", "revenue": 0 },
      { "month": "Feb", "revenue": 5000000 },
      ...
    ],
    "appointmentStatusDistribution": [
      { "label": "Đã đặt", "count": 50 },
      { "label": "Chờ khám", "count": 20 },
      { "label": "Hoàn thành", "count": 100 },
      { "label": "Đã hủy", "count": 5 }
    ],
    "paymentStatusDistribution": [
      { "label": "Chưa thanh toán", "count": 30 },
      { "label": "Đã thanh toán", "count": 120 }
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

✅ **Bar Chart Features:**
- Shows all 12 months
- Color-coded bars
- Interactive tooltips
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

## Testing

To test the charts:
1. Login as admin
2. Navigate to Admin Dashboard
3. Verify all four charts display
4. Check data accuracy against appointments and payments
5. Test responsive layout on mobile

## Files Modified

- `backend/src/controllers/dashboard.controller.js` — Added chart data calculations
- `frontend/src/pages/dashboards/AdminDashboard.jsx` — Added chart components and cleaned up unused code
