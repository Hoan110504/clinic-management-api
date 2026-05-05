# Pharmacist Dashboard Charts - Update & Fixes

## Overview
Updated the Pharmacist Dashboard with three new charts and fixed the existing medicine inventory chart:

1. **Doughnut Chart (FIXED)** — Tình trạng tồn kho thuốc (corrected label)
2. **Bar Chart (NEW)** — Top 5 thuốc được cấp nhiều nhất
3. **Pie Chart (NEW)** — Trạng thái đơn thuốc

## Backend Implementation

### Data Calculations in `getPharmacistDashboard()`

#### Chart 1: Tình trạng tồn kho thuốc (Doughnut Chart) - FIXED
**Label changed from:** "Tình trạng kho thuốc" → "Tình trạng tồn kho thuốc"

```javascript
medicineInventoryStatus = [
  { label: 'Thuốc còn nhiều', value: 45 },      // quantity > min_quantity
  { label: 'Thuốc sắp hết', value: 12 },        // 0 < quantity <= min_quantity
  { label: 'Thuốc hết hàng', value: 3 },        // quantity = 0
]
```

**Logic:**
- Fetch all active medicines
- Categorize by stock level:
  - In Stock: quantity > min_quantity
  - Low Stock: 0 < quantity ≤ min_quantity
  - Out of Stock: quantity = 0
- Return array with labels and counts

#### Chart 2: Top 5 thuốc được cấp nhiều nhất (Bar Chart)
```javascript
topMedicinesDispensed = [
  { label: 'Paracetamol 500mg', value: 45 },
  { label: 'Ibuprofen 400mg', value: 38 },
  { label: 'Amoxicillin 500mg', value: 32 },
  { label: 'Vitamin C 1000mg', value: 28 },
  { label: 'Aspirin 100mg', value: 25 },
]
```

**Logic:**
- Fetch all dispensed prescriptions (status = 1)
- Group by medicineName
- Count occurrences
- Sort by count descending
- Limit to top 5
- Return array with medicine names and counts

#### Chart 3: Trạng thái đơn thuốc (Pie Chart)
```javascript
prescriptionStatusDistribution = [
  { label: 'Chờ phát', count: 15 },    // status: 0
  { label: 'Đã phát', count: 120 },    // status: 1
]
```

**Status Mapping:**
- `0` = Chờ phát (Waiting for Dispensing)
- `1` = Đã phát (Dispensed)

**Logic:**
- Fetch all prescriptions
- Initialize status map with both statuses
- Count prescriptions by status
- Filter out statuses with count = 0
- Return array with labels and counts

### Error Handling
All three chart data calculations are wrapped in try-catch blocks:
- If data fetch fails, returns empty array `[]`
- Logs warning message for debugging
- Dashboard displays empty chart gracefully

## Frontend Implementation

### PharmacistDashboard.jsx Updates

#### Chart Section
Updated to 2x2 responsive grid with all four charts:

```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Chart 1: Bar Chart - Prescriptions by Month */}
  <DashboardChartWidget
    type="bar"
    title="Số đơn thuốc theo tháng"
    data={data?.prescriptionsByMonth || []}
    xAxisKey="month"
    dataKey="count"
    loading={loading}
    height={300}
  />

  {/* Chart 2: Doughnut Chart - Medicine Inventory (FIXED) */}
  <DashboardChartWidget
    type="doughnut"
    title="Tình trạng tồn kho thuốc"
    data={data?.medicineInventoryStatus || []}
    xAxisKey="label"
    dataKey="value"
    loading={loading}
    height={300}
  />

  {/* Chart 3: Bar Chart - Top 5 Medicines (NEW) */}
  <DashboardChartWidget
    type="bar"
    title="Top 5 thuốc được cấp nhiều nhất"
    data={data?.topMedicinesDispensed || []}
    xAxisKey="label"
    dataKey="value"
    loading={loading}
    height={300}
  />

  {/* Chart 4: Pie Chart - Prescription Status (NEW) */}
  <DashboardChartWidget
    type="pie"
    title="Trạng thái đơn thuốc"
    data={data?.prescriptionStatusDistribution || []}
    xAxisKey="label"
    dataKey="count"
    loading={loading}
    height={300}
  />
</div>
```

## Data Flow

```
Pharmacist Login
    ↓
useDashboard Hook
    ↓
GET /api/dashboard/pharmacist
    ↓
Backend: getPharmacistDashboard()
    ├─ Fetch pending prescriptions
    ├─ Fetch low stock medicines
    ├─ Fetch expiring medicines
    ├─ Fetch dispensed today count
    ├─ Calculate prescriptionsByMonth
    ├─ Calculate medicineInventoryStatus (FIXED)
    ├─ Calculate topMedicinesDispensed (NEW)
    └─ Calculate prescriptionStatusDistribution (NEW)
    ↓
Response with chart data
    ↓
Frontend: PharmacistDashboard.jsx
    ├─ Display stats
    ├─ Display charts (4 total)
    ├─ Display alerts
    └─ Display lists
```

## API Response Structure

```json
{
  "success": true,
  "data": {
    "pendingPrescriptions": [ ... ],
    "lowStockMedicines": [ ... ],
    "expiringMedicines": [ ... ],
    "dispensedToday": 12,
    "prescriptionsByMonth": [
      { "month": "Jan", "count": 5 },
      { "month": "Feb", "count": 8 },
      ...
    ],
    "medicineInventoryStatus": [
      { "label": "Thuốc còn nhiều", "value": 45 },
      { "label": "Thuốc sắp hết", "value": 12 },
      { "label": "Thuốc hết hàng", "value": 3 }
    ],
    "topMedicinesDispensed": [
      { "label": "Paracetamol 500mg", "value": 45 },
      { "label": "Ibuprofen 400mg", "value": 38 },
      ...
    ],
    "prescriptionStatusDistribution": [
      { "label": "Chờ phát", "count": 15 },
      { "label": "Đã phát", "count": 120 }
    ]
  }
}
```

## Features

✅ **Bar Chart (Prescriptions by Month):**
- Shows all 12 months
- Color-coded bars
- Interactive tooltips
- Responsive sizing

✅ **Doughnut Chart (Medicine Inventory):**
- Color-coded by stock level
- Only shows categories with data
- Interactive tooltips
- Responsive sizing

✅ **Bar Chart (Top 5 Medicines):**
- Shows top 5 most dispensed medicines
- Horizontal bars for better readability
- Interactive tooltips
- Responsive sizing

✅ **Pie Chart (Prescription Status):**
- Shows distribution of prescription statuses
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
1. Login as pharmacist
2. Navigate to Pharmacist Dashboard
3. Verify all four charts display
4. Check data accuracy:
   - Prescriptions by month: count all prescriptions
   - Medicine inventory: categorize by stock level
   - Top 5 medicines: verify top 5 most dispensed
   - Prescription status: count by status
5. Test responsive layout on mobile

## Files Modified

- `backend/src/controllers/dashboard.controller.js` — Added/updated chart data calculations
- `frontend/src/pages/dashboards/PharmacistDashboard.jsx` — Updated chart section with 4 charts

## Changes Summary

| Chart | Type | Status | Notes |
|-------|------|--------|-------|
| Số đơn thuốc theo tháng | Bar | Existing | No changes |
| Tình trạng tồn kho thuốc | Doughnut | FIXED | Label updated |
| Top 5 thuốc được cấp nhiều nhất | Bar | NEW | Added |
| Trạng thái đơn thuốc | Pie | NEW | Added |
