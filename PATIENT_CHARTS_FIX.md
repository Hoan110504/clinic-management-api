# Patient Dashboard Charts - Bug Fix

## Issue
Error: `TypeError: data.map is not a function` at `DashboardChartWidget.jsx:58`

## Root Cause
The Patient Dashboard was passing chart data in Chart.js format directly to `DashboardChartWidget`, but the component expects a simple array format with `xAxisKey` and `dataKey` properties.

**Wrong format:**
```javascript
data={{
  labels: [...],
  datasets: [{ ... }]
}}
```

**Correct format:**
```javascript
data={[
  { month: 'Jan', count: 0 },
  { month: 'Feb', count: 2 },
  ...
]}
```

## Solution

### Frontend Fix (PatientDashboard.jsx)
Changed chart component calls to use the correct format:

**Line Chart:**
```jsx
<DashboardChartWidget
  type="line"
  title="Lịch hẹn theo tháng"
  data={data?.appointmentsByMonth || []}
  xAxisKey="month"
  dataKey="count"
  loading={loading}
  height={300}
/>
```

**Doughnut Chart:**
```jsx
<DashboardChartWidget
  type="doughnut"
  title="Trạng thái lịch hẹn"
  data={data?.appointmentStatusDistribution || []}
  xAxisKey="label"
  dataKey="count"
  loading={loading}
  height={300}
/>
```

### Backend Fix (dashboard.controller.js)
Improved status mapping to handle edge cases:

```javascript
const statusMap = {
  0: { label: 'Đã lên lịch', count: 0 },
  1: { label: 'Xác nhận', count: 0 },
  2: { label: 'Hoàn thành', count: 0 },
  3: { label: 'Hủy', count: 0 },
};

allAppointments.forEach(a => {
  if (statusMap[a.status] !== undefined) {  // Check !== undefined
    statusMap[a.status].count += 1;
  }
});

appointmentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
```

## Status Mapping
- `0` = Đã lên lịch (Scheduled)
- `1` = Xác nhận (Confirmed)
- `2` = Hoàn thành (Completed)
- `3` = Hủy (Cancelled)

## Result
✅ Charts now render correctly
✅ Status labels display in Vietnamese
✅ No more `data.map is not a function` error
✅ Consistent with Pharmacist Dashboard implementation

## Files Modified
- `frontend/src/pages/dashboards/PatientDashboard.jsx`
- `backend/src/controllers/dashboard.controller.js`
