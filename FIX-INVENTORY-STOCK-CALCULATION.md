# Fix: Inventory Stock Calculation

## Problem
Trường "Tồn kho" hiển thị ở "Số Lô" thì đúng nhưng tổng là chưa đúng. Frontend đang tính tổng tồn kho từ `InventoryTransactions` (giao dịch xuất/nhập) thay vì tính từ `MedicineBatches` (các lô thuốc thực tế).

## Root Cause
1. **Backend API** (`getAllMedicinesUnpaginated`) chỉ trả về thông tin cơ bản của thuốc (tên, đơn vị, giá) nhưng KHÔNG bao gồm số lượng tồn kho
2. **Frontend** cố gắng tính tồn kho từ bảng `InventoryTransactions` bằng cách lấy `newQuantity` của giao dịch cuối cùng
3. Số lượng tồn kho thực tế được lưu trong bảng `MedicineBatches` (mỗi thuốc có thể có nhiều lô, mỗi lô có `QuantityInStock` riêng)

## Solution

### Backend Changes
**File:** `d:\DATN\backend\src\controllers\medicine.controller.js`

Cập nhật method `getAllMedicinesUnpaginated` để tính tổng tồn kho từ tất cả các lô:

```javascript
const getAllMedicinesUnpaginated = asyncHandler(async (req, res) => {
  // ... existing code ...

  const rows = await Medicine.findAll({
    where,
    order: parseSort(sort || 'Id:desc', ['Id', 'Name', 'Category', 'Unit', 'Price']),
    attributes: [
      'Id', 
      'Name', 
      'Unit', 
      'Category', 
      'Price', 
      'IsActive',
      // Sum total stock from all batches
      [
        sequelize.literal(`(
          SELECT ISNULL(SUM(QuantityInStock), 0) 
          FROM MedicineBatches 
          WHERE MedicineBatches.MedicineId = Medicine.Id
        )`),
        'totalStock'
      ]
    ],
    raw: true,
  });

  const data = (rows || []).map(r => ({
    id: r.Id,
    name: r.Name,
    category: r.Category,
    unit: r.Unit,
    price: r.Price,
    isActive: r.IsActive,
    quantity: Number(r.totalStock || 0), // ← New field!
  }));

  return successResponse(res, data);
});
```

**Key changes:**
- Thêm subquery để tính tổng `QuantityInStock` từ tất cả các lô (`MedicineBatches`) của mỗi thuốc
- Trả về field `quantity` chứa tổng tồn kho thực tế

### Frontend Changes
**File:** `d:\DATN\frontend\src\pages\pharmacist\Pharmacy.jsx`

Cập nhật logic trong `inventoryRows` để sử dụng `quantity` từ API thay vì tính từ transactions:

```javascript
const inventoryRows = useMemo(() => {
  const rows = allMedicines.map((medicine) => {
    // Use the quantity from API which is already summed from all batches
    const currentStock = Number(medicine.quantity || 0);  // ← Changed!

    // ... rest of the code (minThreshold, nearestExpiry) ...
  });

  return rows.sort((a, b) => Number(b.id) - Number(a.id));
}, [allMedicines, transactions]);
```

**Key changes:**
- Loại bỏ logic tính tồn kho từ `transactions` và `lastTx.newQuantity`
- Sử dụng trực tiếp `medicine.quantity` từ API (đã được backend tính sẵn)

## Verification

Test script: `d:\DATN\backend\scripts\test-medicine-stock.js`

Chạy test:
```bash
cd d:\DATN\backend
node scripts/test-medicine-stock.js
```

Kết quả mong đợi:
```
✓ Stock calculation correct
✓ Stock calculation correct
...
```

Test script sẽ:
1. Query medicines với total stock từ API
2. Verify bằng cách query trực tiếp từ `MedicineBatches`
3. So sánh 2 kết quả để đảm bảo khớp nhau

## How to Test

1. **Restart backend server:**
   ```bash
   cd d:\DATN\backend
   npm start
   ```

2. **Clear browser cache:**
   - Ctrl + Shift + R (hard refresh)
   - Hoặc Clear browser cache

3. **Test trong UI:**
   - Đăng nhập với tài khoản dược sĩ
   - Vào chức năng "Quản lý kho thuốc"
   - Kiểm tra cột "Tồn kho" trong bảng
   - Kiểm tra trường "Tổng" phía trên bảng

4. **Expected result:**
   - "Tồng kho" của từng thuốc = Tổng `QuantityInStock` từ tất cả các lô của thuốc đó
   - Trường "Tổng" = Tổng tất cả số lượng thuốc trong kho

## Database Schema Reference

### MedicineBatches Table
```sql
CREATE TABLE MedicineBatches (
  Id BIGINT PRIMARY KEY,
  MedicineId BIGINT NOT NULL,
  BatchNumber NVARCHAR(50),
  QuantityInStock INT NOT NULL,  -- ← Số lượng tồn kho của lô này
  ExpiryDate DATE,
  ImportPrice DECIMAL(18,2),
  Status TINYINT,
  -- ...
)
```

### Medicines Table
```sql
CREATE TABLE Medicines (
  Id BIGINT PRIMARY KEY,
  Name NVARCHAR(200),
  Unit NVARCHAR(50),
  Category NVARCHAR(100),
  Price DECIMAL(18,2),
  IsActive BIT,
  -- NOTE: Không có field quantity trong bảng này!
)
```

## Impact
- ✅ Tổng tồn kho hiển thị chính xác
- ✅ Phản ánh đúng số lượng thực tế trong các lô thuốc
- ✅ Không cần phụ thuộc vào lịch sử giao dịch để tính tồn kho
- ✅ Performance tốt hơn (1 query thay vì nhiều queries)

## Related Files
- Backend:
  - `src/controllers/medicine.controller.js` (updated)
  - `src/models/MedicineBatch.js`
  - `src/models/Medicine.js`
  - `scripts/test-medicine-stock.js` (new test)

- Frontend:
  - `src/pages/pharmacist/Pharmacy.jsx` (updated)
  - `src/hooks/queries/usePharmacyQueryHelpers.js`
