# Dashboard System - Quick Start Guide

## Overview

A production-ready, role-based dashboard system for the clinic management application with real-time data updates and comprehensive statistics.

## What's Included

### Frontend Components
- **5 Role-Specific Dashboards**: Admin, Doctor, Receptionist, Pharmacist, Patient
- **Reusable Dashboard Components**: Stats grid, charts, lists, loaders
- **Custom Hook**: `useDashboard` for data fetching and auto-refresh
- **Chart Support**: Line, bar, pie, doughnut charts via Chart.js

### Backend
- **5 API Endpoints**: One for each role with filtered data
- **Role-Based Access Control**: Middleware-protected endpoints
- **Optimized Queries**: Aggregated data with proper indexing

## Quick Start

### 1. Frontend Setup

The dashboard system is already integrated. Just ensure you have the required dependencies:

```bash
cd frontend
npm install
```

Required packages (already in package.json):
- `react-chartjs-2` - Chart components
- `chart.js` - Chart library
- `recharts` - Alternative charts (optional)

### 2. Backend Setup

The dashboard controller is already implemented. Ensure the database is set up:

```bash
cd backend
npm run db:migrate
npm run db:seed
```

### 3. Run the Application

**Backend** (Terminal 1):
```bash
cd backend
npm run dev
```

**Frontend** (Terminal 2):
```bash
cd frontend
npm run dev
```

Visit `http://localhost:5173` and log in with your credentials.

## Dashboard Access

Each role automatically sees their dashboard:

| Role | URL | Features |
|------|-----|----------|
| Admin | `/dashboard` | System-wide stats, user distribution, revenue |
| Doctor | `/dashboard` | Today's appointments, patient status, lab results |
| Receptionist | `/dashboard` | Appointment status, new patients, unpaid invoices |
| Pharmacist | `/dashboard` | Pending prescriptions, low stock, expiring medicines |
| Patient | `/dashboard` | Appointments, medical records, payments, lab results |

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── DashboardStatsGrid.jsx      # Reusable stats grid
│   │       ├── DashboardChartWidget.jsx    # Reusable chart component
│   │       ├── DashboardListWidget.jsx     # Reusable list component
│   │       ├── DashboardLoader.jsx         # Loading skeleton
│   │       └── index.js
│   ├── hooks/
│   │   └── useDashboard.js                 # Dashboard data hook
│   ├── pages/
│   │   └── dashboards/
│   │       ├── AdminDashboard.jsx
│   │       ├── DoctorDashboard.jsx
│   │       ├── ReceptionistDashboard.jsx
│   │       ├── PharmacistDashboard.jsx
│   │       ├── PatientDashboard.jsx
│   │       ├── index.js
│   │       └── README.md
│   └── services/
│       └── dashboard.service.js            # API integration

backend/
├── src/
│   ├── controllers/
│   │   ├── dashboard.controller.js         # Dashboard logic
│   │   └── DASHBOARD_IMPLEMENTATION.md
│   └── routes/
│       └── dashboard.routes.js             # Dashboard endpoints
```

## Key Features

### 1. Role-Based Filtering
Each dashboard automatically filters data based on the logged-in user's role:
- **Admin**: No filtering (system-wide)
- **Doctor**: Filtered by `doctorId`
- **Receptionist**: No filtering (system-wide)
- **Pharmacist**: No filtering (system-wide)
- **Patient**: Filtered by `patientId`

### 2. Real-Time Updates
Dashboards auto-refresh every 30 seconds (configurable):
```javascript
const { data, loading, error, refetch } = useDashboard(30000); // 30 seconds
```

### 3. Responsive Design
- Mobile-first approach
- Adapts to all screen sizes
- Touch-friendly on mobile devices

### 4. Chart Support
Multiple chart types available:
- **Line Charts**: Trends over time
- **Bar Charts**: Comparisons
- **Pie Charts**: Distribution
- **Doughnut Charts**: Proportions

### 5. Error Handling
- Graceful error messages
- Retry functionality
- Loading states

## Usage Examples

### Using a Dashboard

```javascript
import { AdminDashboard } from '@pages/dashboards';

function App() {
  return <AdminDashboard />;
}
```

### Using Dashboard Components

```javascript
import { DashboardStatsGrid, DashboardChartWidget } from '@components/dashboard';

function MyDashboard() {
  const stats = [
    {
      id: 'users',
      title: 'Total Users',
      value: 150,
      icon: <Users className="w-6 h-6" />,
      variant: 'blue',
    },
  ];

  return (
    <>
      <DashboardStatsGrid stats={stats} />
      <DashboardChartWidget
        type="bar"
        title="Monthly Revenue"
        data={chartData}
      />
    </>
  );
}
```

### Using useDashboard Hook

```javascript
import { useDashboard } from '@hooks/useDashboard';

function MyComponent() {
  const { data, loading, error, refetch } = useDashboard();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return <div>{/* Render data */}</div>;
}
```

## API Endpoints

All endpoints require authentication (JWT token).

```
GET /api/dashboard/admin        # Admin statistics
GET /api/dashboard/doctor       # Doctor schedule and stats
GET /api/dashboard/receptionist # Reception statistics
GET /api/dashboard/pharmacist   # Pharmacy statistics
GET /api/dashboard/patient      # Patient information
```

## Customization

### Change Auto-Refresh Interval

```javascript
// Refresh every 60 seconds
const { data } = useDashboard(60000);

// Disable auto-refresh
const { data } = useDashboard(null);
```

### Add New Stats Card

```javascript
const stats = [
  {
    id: 'new-stat',
    title: 'New Metric',
    value: 42,
    description: 'optional',
    icon: <Icon className="w-6 h-6" />,
    variant: 'blue', // blue, green, warning, danger, info, purple, yellow
  },
];
```

### Add New Chart

```javascript
<DashboardChartWidget
  type="line"  // line, bar, pie, doughnut
  title="My Chart"
  data={[
    { label: 'Jan', value: 100 },
    { label: 'Feb', value: 120 },
  ]}
  xAxisKey="label"
  dataKey="value"
  colors={['rgb(59, 130, 246)']}
/>
```

## Troubleshooting

### Dashboard Not Loading

1. Check if you're logged in
2. Verify your role is set correctly
3. Check browser console for errors
4. Ensure backend is running on port 5000

### Data Not Updating

1. Check network tab for failed requests
2. Verify API endpoint is correct
3. Check authentication token
4. Try manual refresh: `refetch()`

### Charts Not Rendering

1. Verify Chart.js is installed: `npm list chart.js`
2. Check data format is correct
3. Ensure chart type is supported
4. Check browser console for errors

## Performance Tips

1. **Lazy Loading**: Dashboards are lazy-loaded for better performance
2. **Memoization**: Components use React.memo to prevent unnecessary re-renders
3. **Efficient Queries**: Backend uses optimized queries with proper indexing
4. **Caching**: Consider implementing Redis caching for frequently accessed data

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Documentation

- **Frontend**: `frontend/src/pages/dashboards/README.md`
- **Backend**: `backend/src/controllers/DASHBOARD_IMPLEMENTATION.md`

## Support

For issues or questions:
1. Check the README files
2. Review the implementation guide
3. Check browser console for errors
4. Review network requests in DevTools

## Next Steps

1. ✅ Dashboards are ready to use
2. Customize colors and styling as needed
3. Add additional metrics or charts
4. Implement export functionality
5. Add real-time WebSocket updates
6. Set up monitoring and alerts

## Production Checklist

- [ ] Test all dashboards with different roles
- [ ] Verify data accuracy
- [ ] Test error handling
- [ ] Optimize database queries
- [ ] Set up monitoring
- [ ] Configure auto-refresh intervals
- [ ] Test on mobile devices
- [ ] Set up error logging
- [ ] Document custom modifications
- [ ] Train users on dashboard features
