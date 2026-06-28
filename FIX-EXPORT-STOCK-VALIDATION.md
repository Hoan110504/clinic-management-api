# Fix: Export Stock Validation Error

## Problem
Khi xuất kho với số lượng nhỏ hơn tồn kho của lô, backend vẫn báo lỗi:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Số lượng xuất vượt quá tồn kho",
    "statusCode": 400
  }
}
```

## Root Cause
Trong method `adjustInventory` ở `medicine.controller.js`, có 2 vấn đề:

1. **Logic tính `previousQuantity` không nhất quán:**
   - Code cũ ưu tiên lấy từ `latestTransaction.QuantityAfter` (giá trị cũ, có thể không đúng)
   - Fallback mới tính từ sum of `MedicineBatches.QuantityInStock` (source of truth)

2. **Kiểm tra không chính xác khi có batch number:**
   - Khi xuất kho với batch cụ thể, code vẫn kiểm tra `previousQuantity` (tổng tất cả lô) với `parsedQuantity`
   - Nhưng đáng lẽ phải chỉ kiểm tra số lượng của batch đó thôi
   - Ví dụ:
     - Lô A: 50 viên
     - Lô B: 30 viên  
     - Tổng: 80 viên
     - User xuất 25 viên từ Lô B
     - Code kiểm tra: 80 >= 25 ✓ (nhưng nếu `previousQuantity` tính sai thành 20, sẽ fail)

## Solution

### Backend Changes
**File:** `d:\DATN\backend\src\controllers\medicine.controller.js`

#### Change 1: Always calculate from MedicineBatches (source of truth)
```javascript
// OLD CODE - Inconsistent logic
let previousQuantity;
if (Number.isFinite(Number(latestTransaction?.QuantityAfter))) {
  previousQuantity = Number(latestTransaction.QuantityAfter);  // ← Potentially stale
} else {
  // complex fallback logic...
}

// NEW CODE - Direct from source of truth
let previousQuantity = 0;
try {
  const batchTotal = await sequelize.models.MedicineBatch.sum('QuantityInStock', { 
    where: { MedicineId: medicine.Id } 
  });
  previousQuantity = Number.isFinite(Number(batchTotal)) ? Number(batchTotal) : 0;
} catch (sumErr) {
  console.warn('Failed to compute batch total for previousQuantity', sumErr?.message || sumErr);
  previousQuantity = 0;
}
```

#### Change 2: Skip general check when batch is specified
```javascript
case INVENTORY_TRANSACTION_TYPES.EXPORT:
  // Skip general stock check if a specific batch is provided
  // The batch-specific check below will validate availability
  if (!trimmedBatchCode && previousQuantity < parsedQuantity) {
    throw new BadRequestError('Số lượng xuất vượt quá tồn kho');
  }
  newQuantity = previousQuantity - parsedQuantity;
  break;
```

**Key changes:**
- Loại bỏ dependency vào `latestTransaction` (có thể cũ/sai)
- Luôn tính từ tổng `MedicineBatches.QuantityInStock` (source of truth)
- Khi có `batchNumber`, bỏ qua kiểm tra tổng quan (sẽ kiểm tra ở level batch)
- Khi KHÔNG có `batchNumber`, mới kiểm tra tổng tồn kho

## How It Works Now

### Scenario 1: Export with specific batch (Frontend use case)
```
User: Xuất 25 viên từ Lô B (có 30 viên)

Backend flow:
1. Calculate previousQuantity = 80 (sum all batches)
2. Check: batchNumber provided? YES → Skip general check
3. Find batch B
4. Check: Batch B has 30 >= 25? YES ✓
5. Update: Batch B stock = 30 - 25 = 5
6. Create transaction record
```

### Scenario 2: Export without batch (auto-select)
```
User: Xuất 25 viên (không chọn lô)

Backend flow:
1. Calculate previousQuantity = 80 (sum all batches)
2. Check: batchNumber provided? NO → Check general stock
3. Check: Total 80 >= 25? YES ✓
4. Auto-select batch with earliest expiry and enough stock
5. Update that batch's stock
6. Create transaction record
```

## Verification

### Test Script
Run: `node scripts/test-export-stock.js`

Expected output:
```
Test Medicine: Khẩu trang y tế 3 lớp
  Total Batches: 2
  Total Stock: 150

Available Batches:
  1. Batch HH1: 10 units
  2. Batch L02: 140 units

Test 1: Export 5 units from batch HH1
  Expected: ✓ Should succeed (5 < 10)
  Batch check: 10 >= 5 = ✓ Pass

Test 2: Export 11 units from batch HH1
  Expected: ✗ Should fail (11 > 10)
  Batch check: 10 >= 11 = ✗ Fail (correct)

✓ Export stock validation logic test completed!
```

### Manual Testing

1. **Restart backend server:**
   ```bash
   cd d:\DATN\backend
   npm start
   ```

2. **Test in UI:**
   - Đăng nhập với tài khoản dược sĩ
   - Vào "Quản lý kho thuốc"
   - Click "Xuất kho"
   - Chọn thuốc có nhiều lô
   - Chọn một lô
   - Nhập số lượng nhỏ hơn tồn kho của lô đó
   - Click "Xác nhận"

3. **Expected result:**
   - ✓ Xuất kho thành công
   - ✗ Không còn báo lỗi "Số lượng xuất vượt quá tồn kho"

## Related Changes

This fix works together with the previous fix:
- **FIX-INVENTORY-STOCK-CALCULATION.md**: Fixed total stock display
- **This fix**: Fixed export validation logic

Both changes establish `MedicineBatches.QuantityInStock` as the single source of truth for inventory.

## Impact
- ✅ Xuất kho với batch cụ thể hoạt động chính xác
- ✅ Không còn false positive validation errors
- ✅ Logic nhất quán: MedicineBatches là source of truth
- ✅ Vẫn bảo vệ chống xuất quá số lượng thực tế

## Database Schema Reference

### Flow for Export Transaction

```
InventoryTransactions
├── TransactionType: 2 (Export)
├── MedicineId: Links to Medicine
├── MedicineBatchId: Links to specific batch
├── Quantity: Amount exported
├── QuantityBefore: Total stock before (sum of all batches)
└── QuantityAfter: Total stock after (sum - exported)

MedicineBatches
├── MedicineId: Which medicine
├── BatchNumber: Batch identifier
├── QuantityInStock: Current stock ← Updated on export
└── ExpiryDate: For auto-selection
```

## Files Changed
- `src/controllers/medicine.controller.js` (updated validation logic)
- `scripts/test-export-stock.js` (new test script)
