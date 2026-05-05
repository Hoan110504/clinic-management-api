# Patient Dashboard Charts Implementation

## Overview
Added two interactive charts to the Patient Dashboard to visualize appointment data:
1. **Line Chart** — Appointments by month (12 months)
2. **Doughnut Chart** — Appointment status distribution

## Backend Implementation

### Data Calculations in `getPatientDashboard()`

#### Chart 1: Appointments by Month (Line Chart)
```javascript
// Fetches all appointments for the patient
// Groups by month (1-12)
// Returns: [{ month: 'Jan', count: 0 }, { month: 'Feb', count: 1 }, ...]
appointmentsByMonth = [
  { month: 'Jan', count: 0 },
  { month: 'Feb', count: 2 },
  // ... all 12 months
]
```

**Logic:**
- Fetch all appointments for the patient
- Initialize all 12 months with count = 0
- Iterate through appointments and count by month
- Return array with month names and counts

#### Chart 2: Appointment Status Distribution (Doughnut Chart)
```javascript
// Fetches all appointments for the patient
// Groups by status code (0, 1, 2, 3)
// Returns: [{ label: 'Đã lên lịch', count: 5 }, ...]
appointmentStatusDistribution = [
  { label: 'Đã lên lịch', count: 5 },      // status: 0
  { label: 'Xác nhận', count: 3 },         // status: 1
  { label: 'Hoàn thành', count: 12 },      // status: 2
  { label: 'Hủy', count: 1 },              // status: 3
]
```

**Status Mapping:**
- `0` = Đã lên lịch (Scheduled)
- `1` = Xác nhận (Confirmed)
- `2` = Hoàn thành (Completed)
- `3` = Hủy (Cancelled)

**Logic:**
- Fetch all appointments for the patient
- Initialize status map with all 4 statuses
- Count appointments by status
- Filter out statuses with count = 0
- Return array with labels and counts

### Error Handling
Both chart data calculations are wrapped in try-catch blocks:
- If data fetch fails, returns empty array `[]`
- Logs warning message for debugging
- Dashboard displays empty chart gracefully

## Frontend Implementation

### PatientDashboard.jsx Updates

#### Imports
Added `DashboardChartWidget` to component imports:
```javascript
import {
  DashboardStatsGrid,
  DashboardListWidget,
  DashboardChartWidget,  // NEW
  DashboardLoader,
} from '@components/dashboard';
```

#### Chart Section
Added 2-column responsive grid with both charts:
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Line Chart */}
  <DashboardChartWidget
    title="Lịch hẹn theo tháng"
    type="line"
    data={{
      labels: data?.appointmentsByMonth?.map(d => d.month) || [],
      datasets: [{ ... }]
    }}
    loading={loading}
  />

  {/* Doughnut Chart */}
  <DashboardChartWidget
    title="Trạng thái lịch hẹn"
    type="doughnut"
    data={{
      labels: data?.appointmentStatusDistribution?.map(d => d.label) || [],
      datasets: [{ ... }]
    }}
    loading={loading}
  />
</div>
```

#### Chart Styling

**Line Chart:**
- Border color: Blue (#3b82f6)
- Background: Light blue with transparency
- Points: Blue with white border
- Tension: 0.4 (smooth curve)
- Fill: True (area under line)

**Doughnut Chart:**
- Colors: Blue, Green, Purple, Red
- Border: White with 2px width
- Responsive sizing

#### Positioning
Charts are positioned:
- After main stats grid
- Before alerts section
- Above quick stats cards
- Above detailed lists

## Data Flow

```
Patient Login
    ↓
useDashboard Hook
    ↓
GET /api/dashboard/patient
    ↓
Backend: getPatientDashboard()
    ├─ Fetch patient info
    ├─ Fetch upcoming appointments
    ├─ Fetch recent records
    ├─ Fetch pending payments
    ├─ Fetch lab results
    ├─ Calculate appointmentsByMonth (NEW)
    └─ Calculate appointmentStatusDistribution (NEW)
    ↓
Response with chart data
    ↓
Frontend: PatientDashboard.jsx
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
    "patient": { ... },
    "upcomingAppointments": [ ... ],
    "recentRecords": [ ... ],
    "pendingPayments": [ ... ],
    "recentLabResults": [ ... ],
    "appointmentsByMonth": [
      { "month": "Jan", "count": 0 },
      { "month": "Feb", "count": 2 },
      ...
    ],
    "appointmentStatusDistribution": [
      { "label": "Đã lên lịch", "count": 5 },
      { "label": "Xác nhận", "count": 3 },
      ...
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

✅ **Doughnut Chart Features:**
- Color-coded by status
- Only shows statuses with data
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
1. Login as a patient
2. Navigate to Patient Dashboard
3. Verify both charts display
4. Check data accuracy against appointments
5. Test responsive layout on mobile

## Files Modified

- `backend/src/controllers/dashboard.controller.js` — Added chart data calculations
- `frontend/src/pages/dashboards/PatientDashboard.jsx` — Added chart components and styling
