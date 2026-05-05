# Dashboard System - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Dashboard Router                            │  │
│  │  (frontend/src/pages/admin/Dashboard.jsx)               │  │
│  │  - Determines user role                                 │  │
│  │  - Routes to appropriate dashboard                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                  │
│         │                 │                 │                  │
│         ▼                 ▼                 ▼                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Admin     │  │   Doctor    │  │ Receptionist│            │
│  │ Dashboard   │  │ Dashboard   │  │ Dashboard   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                 │                 │                  │
│         └─────────────────┼─────────────────┘                  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         useDashboard Hook                                │  │
│  │  (frontend/src/hooks/useDashboard.js)                   │  │
│  │  - Fetches role-specific data                           │  │
│  │  - Auto-refresh every 30s                               │  │
│  │  - Error handling & loading states                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Dashboard Service                                   │  │
│  │  (frontend/src/services/dashboard.service.js)           │  │
│  │  - API integration layer                                │  │
│  │  - Calls appropriate endpoint based on role             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Reusable Dashboard Components                       │  │
│  │  (frontend/src/components/dashboard/)                   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ DashboardStatsGrid                              │   │  │
│  │  │ - Displays statistics in responsive grid        │   │  │
│  │  │ - Supports multiple variants                    │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ DashboardChartWidget                            │   │  │
│  │  │ - Line, bar, pie, doughnut charts              │   │  │
│  │  │ - Built on Chart.js & react-chartjs-2          │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ DashboardListWidget                             │   │  │
│  │  │ - Customizable list display                     │   │  │
│  │  │ - Pagination & click handlers                   │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ DashboardLoader                                 │   │  │
│  │  │ - Loading skeleton                              │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js/Express)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Dashboard Routes                            │  │
│  │  (backend/src/routes/dashboard.routes.js)               │  │
│  │                                                          │  │
│  │  GET /api/dashboard/admin                               │  │
│  │  GET /api/dashboard/doctor                              │  │
│  │  GET /api/dashboard/receptionist                        │  │
│  │  GET /api/dashboard/pharmacist                          │  │
│  │  GET /api/dashboard/patient                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Authentication Middleware                        │  │
│  │  - Verify JWT token                                     │  │
│  │  - Extract user info                                    │  │
│  │  - Role-based access control                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Dashboard Controller                                │  │
│  │  (backend/src/controllers/dashboard.controller.js)      │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ getAdminDashboard()                             │   │  │
│  │  │ - System-wide statistics                        │   │  │
│  │  │ - No filtering                                  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ getDoctorDashboard()                            │   │  │
│  │  │ - Filter by doctorId = req.user.id              │   │  │
│  │  │ - Personal appointments & stats                 │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ getReceptionistDashboard()                      │   │  │
│  │  │ - System-wide reception stats                   │   │  │
│  │  │ - No filtering                                  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ getPharmacistDashboard()                        │   │  │
│  │  │ - Pharmacy statistics                           │   │  │
│  │  │ - No filtering                                  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ getPatientDashboard()                           │   │  │
│  │  │ - Filter by patientId = Patient.userId          │   │  │
│  │  │ - Personal health information                   │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Sequelize Models                                 │  │
│  │  - User, Patient, Appointment, MedicalRecord            │  │
│  │  - Medicine, Payment, Prescription, LabTest             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Database Queries                                 │  │
│  │  - Aggregations (COUNT, SUM, GROUP BY)                  │  │
│  │  - Joins with related tables                            │  │
│  │  - Filtering by date, status, user ID                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ SQL Queries
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    MSSQL Database                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tables:                                                        │
│  - users (id, role, isActive, ...)                             │
│  - Patients (id, userId, fullName, ...)                        │
│  - Appointments (id, patientId, assignedDoctorId, ...)         │
│  - MedicalExaminations (id, doctorId, status, ...)             │
│  - Medicines (id, quantity, min_quantity, expiryDate, ...)     │
│  - Payments (id, patientId, totalAmount, status, ...)          │
│  - Prescriptions (id, doctorId, status, ...)                   │
│  - LabTests (id, patientId, status, ...)                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
User Login
    │
    ▼
Navigate to /dashboard
    │
    ▼
Dashboard Router Component
    │
    ├─ Get currentUser from AuthContext
    │
    ├─ Determine role (1-5)
    │
    └─ Render appropriate dashboard component
        │
        ├─ AdminDashboard (role = 1)
        ├─ DoctorDashboard (role = 2)
        ├─ ReceptionistDashboard (role = 3)
        ├─ PharmacistDashboard (role = 4)
        └─ PatientDashboard (role = 5)
            │
            ▼
        useDashboard Hook
            │
            ├─ Determine API endpoint based on role
            │
            ├─ Call dashboardService.get{Role}Dashboard()
            │
            └─ Set up auto-refresh (30s interval)
                │
                ▼
            Dashboard Service
                │
                └─ Call api.get('/dashboard/{role}')
                    │
                    ▼
                Backend Route Handler
                    │
                    ├─ Verify JWT token
                    │
                    ├─ Check user role
                    │
                    └─ Call appropriate controller method
                        │
                        ├─ getAdminDashboard()
                        ├─ getDoctorDashboard()
                        ├─ getReceptionistDashboard()
                        ├─ getPharmacistDashboard()
                        └─ getPatientDashboard()
                            │
                            ├─ Query database
                            │
                            ├─ Filter data by role/user ID
                            │
                            ├─ Aggregate statistics
                            │
                            └─ Return JSON response
                                │
                                ▼
                            Frontend receives data
                                │
                                ├─ Update state
                                │
                                └─ Render dashboard components
                                    │
                                    ├─ DashboardStatsGrid
                                    ├─ DashboardChartWidget
                                    ├─ DashboardListWidget
                                    └─ Other UI elements
                                        │
                                        ▼
                                    Display to user
```

## Component Hierarchy

```
Dashboard (Router)
├── AdminDashboard
│   ├── PageHeader
│   ├── DashboardStatsGrid
│   │   └── StatsCard (x4)
│   ├── DashboardChartWidget (Doughnut)
│   └── DashboardListWidget
│
├── DoctorDashboard
│   ├── PageHeader
│   ├── DashboardStatsGrid
│   │   └── StatsCard (x4)
│   ├── Alert (if pending labs)
│   ├── DashboardListWidget
│   ├── DashboardChartWidget (Doughnut)
│   └── Card (Quick Info)
│
├── ReceptionistDashboard
│   ├── PageHeader
│   ├── DashboardStatsGrid
│   │   └── StatsCard (x4)
│   ├── Alert (if unpaid payments)
│   ├── DashboardChartWidget (Pie)
│   ├── Card (Quick Stats)
│   ├── DashboardListWidget (Appointments)
│   └── DashboardListWidget (Payments)
│
├── PharmacistDashboard
│   ├── PageHeader
│   ├── DashboardStatsGrid
│   │   └── StatsCard (x4)
│   ├── Alert (if pending prescriptions)
│   ├── Alert (if expiring medicines)
│   ├── Card (Prescription Stats)
│   ├── Card (Inventory Stats)
│   ├── DashboardListWidget (Prescriptions)
│   ├── DashboardListWidget (Low Stock)
│   └── DashboardListWidget (Expiring)
│
└── PatientDashboard
    ├── PageHeader
    ├── Card (Patient Info)
    ├── DashboardStatsGrid
    │   └── StatsCard (x4)
    ├── Alert (if unpaid payments)
    ├── Card (Appointments)
    ├── Card (Payments)
    ├── DashboardListWidget (Appointments)
    ├── DashboardListWidget (Medical Records)
    ├── DashboardListWidget (Payments)
    └── DashboardListWidget (Lab Results)
```

## State Management Flow

```
┌─────────────────────────────────────────┐
│      AuthContext (Global)               │
│  - currentUser                          │
│  - isAuthenticated                      │
│  - role                                 │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Dashboard Router Component            │
│  - Reads currentUser.role               │
│  - Determines dashboard to render       │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Role-Specific Dashboard Component     │
│  - Calls useDashboard hook              │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   useDashboard Hook (Local State)       │
│  - data (dashboard data)                │
│  - loading (boolean)                    │
│  - error (error message)                │
│  - lastRefresh (timestamp)              │
│  - refetch (function)                   │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Dashboard Components                  │
│  - Receive data as props                │
│  - Render UI                            │
│  - Handle user interactions             │
└─────────────────────────────────────────┘
```

## API Response Structure

```
{
  success: true,
  data: {
    // Role-specific data
    // Example for Admin:
    userCounts: [
      { role: 1, count: 5 },
      { role: 2, count: 10 },
      ...
    ],
    totalPatients: 500,
    todayAppointments: 25,
    todayRevenue: 5000000,
    pendingPayments: 8,
    lowStockCount: 3,
    recentAppointments: [...]
  }
}
```

## Performance Optimization

```
┌─────────────────────────────────────────┐
│   Lazy Loading                          │
│  - Dashboard pages lazy-loaded          │
│  - Reduces initial bundle size          │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Memoization                           │
│  - Components use React.memo            │
│  - Prevents unnecessary re-renders      │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Efficient Queries                     │
│  - Database indexes on key columns      │
│  - Aggregations at database level       │
│  - Selective column selection           │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Auto-Refresh                          │
│  - Configurable interval (default 30s)  │
│  - Prevents excessive API calls         │
└─────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────┐
│   Frontend                              │
│  - JWT token in localStorage            │
│  - Sent in Authorization header         │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Backend                               │
│  - Verify JWT signature                 │
│  - Extract user ID and role             │
│  - Check role authorization             │
└─────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│   Database                              │
│  - Filter data by user ID/role          │
│  - No cross-role data access            │
│  - Enforce foreign key constraints      │
└─────────────────────────────────────────┘
```

## Extensibility Points

```
1. Add New Dashboard
   └─ Create new component in /dashboards
   └─ Add to dashboardMap in Dashboard.jsx
   └─ Create backend endpoint

2. Add New Chart Type
   └─ DashboardChartWidget supports any Chart.js type
   └─ Just change type prop

3. Add New Stats Card
   └─ Add to stats array
   └─ Customize icon, variant, value

4. Add New List Widget
   └─ Use DashboardListWidget with custom columns
   └─ Define render functions for each column

5. Add New API Endpoint
   └─ Create controller method
   └─ Add route
   └─ Add service method
   └─ Update useDashboard hook
```

This architecture ensures:
- ✅ Scalability
- ✅ Maintainability
- ✅ Security
- ✅ Performance
- ✅ Extensibility
- ✅ Reusability
