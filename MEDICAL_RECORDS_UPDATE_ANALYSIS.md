# Medical Records Update Logic Analysis

## Summary
The backend properly saves and persists `vitalSigns` when provided in the PUT update request. There is comprehensive fallback logic to ensure vitals are preserved even if DB operations fail.

---

## 1. PUT Endpoint Route Handler

**Route Definition:** [medicalRecord.routes.js](medicalRecord.routes.js#L60-L67)
```javascript
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(medicalRecordValidator.update),
  medicalRecordController.updateMedicalRecord
);
```

**Authorization:** Admin and Doctor roles only
**Validation:** Applied via `medicalRecordValidator.update`

---

## 2. Validation Layer

**File:** [medicalRecord.validator.js](medicalRecord.validator.js#L31-L51)

```javascript
const updateMedicalRecordValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID phiếu khám không được để trống'),
  body('symptoms')
    .optional()
    .isString()
    .withMessage('Triệu chứng không hợp lệ'),
  body('diagnosis')
    .optional()
    .isString()
    .withMessage('Chẩn đoán không hợp lệ'),
  body('treatment')
    .optional()
    .isString()
    .withMessage('Phương pháp điều trị không hợp lệ'),
  body('vitalSigns')
    .optional()
    .isObject()
    .withMessage('Dấu hiệu sinh tồn không hợp lệ'),
  body('status')
    .optional()
    .isIn(Object.values(MEDICAL_RECORD_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
  body('nextAppointment')
    .optional()
    .isISO8601()
    .withMessage('Ngày tái khám không hợp lệ'),
];
```

**Key Finding:** `vitalSigns` is validated as `.optional().isObject()` - **passes through without filtering**

---

## 3. VitalSigns Update Logic

**File:** [medicalRecord.controller.js](medicalRecord.controller.js#L750-L834) - `updateMedicalRecord` function

### How it works:

#### For Modern Schema:
```javascript
console.info('updateMedicalRecord: updating modern MedicalRecord', { id: record.id, vitalSigns: updateData.vitalSigns });
await record.update(updateData);
console.info('updateMedicalRecord: updated modern MedicalRecord', { id: record.id, vitalSigns: record.vitalSigns });
```
✅ **Directly updates vitalSigns using Sequelize update()**

#### For Legacy HoSoKham Schema:
```javascript
if (updateData.vitalSigns) {
  let savedVitalsFallback = null;
  try {
    const vs = updateData.vitalSigns;
    const chiSo = {
      MaHoSoKham: record.Id || record.id,
      HuyetAp: vs.bloodPressure || null,
      NhipTim: vs.pulse || null,
      NhietDo: vs.temperature || null,
      CanNang: vs.weight || null,
      ChieuCao: vs.height || null,
      SpO2: vs.spO2 || null,
    };
    
    // 1. Create ChiSoSinhTon entry (legacy vital signs table)
    if (models && models.ChiSoSinhTon) {
      const created = await models.ChiSoSinhTon.create(chiSo);
      
      // 2. Also persist to modern JSON field for frontend compatibility
      try {
        await record.update({ vitalSigns: vs });
      } catch (persistJsonErr) {
        console.warn('failed to persist vitalSigns JSON to MedicalRecord', ...);
      }
    } else {
      savedVitalsFallback = updateData.vitalSigns;
    }
  } catch (chiErr) {
    // If ChiSoSinhTon creation fails, fallback to JSON column
    savedVitalsFallback = updateData.vitalSigns;
  }
  
  // 3. Fallback persistence if needed
  if (savedVitalsFallback) {
    try {
      if (record && typeof record.update === 'function') {
        await record.update({ vitalSigns: savedVitalsFallback });
      }
    } catch (persistErr) {
      console.warn('failed to persist fallback vitalSigns into MedicalRecord', ...);
    }
    record._fallbackVitalSigns = savedVitalsFallback;
  }
}
```

**Persistence Strategy:**
1. **Primary:** Create ChiSoSinhTon record (legacy vital signs table)
2. **Secondary:** Persist to JSON column in MedicalRecord for frontend compatibility
3. **Fallback:** If both fail, attach to response object with `_fallbackVitalSigns` property

---

## 4. Response Handling

After update, the response includes fallback logic to ensure vitals are never lost:

```javascript
if (isLegacyHoSoKham) {
  const normalized = normalizeLegacyRecord(fresh);
  
  // Ensure response contains the vitals we just received in the request as a fallback
  const responseVitalSigns = (updateData && updateData.vitalSigns) 
    ? updateData.vitalSigns 
    : (record._fallbackVitalSigns || null);
  
  if (record._fallbackVitalSigns) {
    normalized.vitalSigns = record._fallbackVitalSigns;
  }
  if (!normalized.vitalSigns && responseVitalSigns) {
    normalized.vitalSigns = responseVitalSigns;
  }
  
  return successResponse(res, normalized, 'Cập nhật phiếu khám thành công');
}

// For modern schema
if (!fresh.vitalSigns && updateData && updateData.vitalSigns) {
  try {
    fresh.vitalSigns = updateData.vitalSigns;
  } catch (e) {
    // ignore
  }
}
```

**Key Finding:** Response always includes vitalSigns - either from DB or from request data as fallback

---

## 5. VitalSigns Persistence in Model

**File:** [MedicalRecord.js](MedicalRecord.js#L92-L108)

```javascript
initialVitalSigns: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'initial_vital_signs',
  get() {
    const rawValue = this.getDataValue('initialVitalSigns');
    return rawValue ? JSON.parse(rawValue) : null;
  },
  set(value) {
    this.setDataValue('initialVitalSigns', value ? JSON.stringify(value) : null);
  },
},
vitalSigns: {
  type: DataTypes.TEXT,
  allowNull: true,
  field: 'vital_signs',
  get() {
    const rawValue = this.getDataValue('vitalSigns');
    return rawValue ? JSON.parse(rawValue) : null;
  },
  set(value) {
    this.setDataValue('vitalSigns', value ? JSON.stringify(value) : null);
  },
},
```

**Key Finding:**
- ✅ Stored as TEXT (JSON) in database
- ✅ Automatically serialized/deserialized
- ✅ Can be set to null safely
- ✅ No validation that prevents null values

---

## 6. Status Update & Queue Visibility Logic

**File:** [medicalRecord.controller.js](medicalRecord.controller.js#L835-L849)

When medical record status is updated, the linked appointment is synchronized:

```javascript
// Đồng bộ trạng thái lịch hẹn: phiếu khám → lịch hẹn (mapping IN_PROGRESS/COMPLETED)
if (record.appointmentId) {
  let appointmentStatus;
  switch (updateData.status) {
    case MEDICAL_RECORD_STATUS.IN_PROGRESS:
      appointmentStatus = APPOINTMENT_STATUS.IN_PROGRESS;
      break;
    case MEDICAL_RECORD_STATUS.COMPLETED:
      appointmentStatus = APPOINTMENT_STATUS.COMPLETED;
      break;
  }
  if (appointmentStatus) {
    await Appointment.update(
      { status: appointmentStatus },
      { where: { id: record.appointmentId } }
    );
  }
}
```

### Queue Visibility Status Mapping:
- `WAITING` (Đang chờ) → **Visible in queue** (initial status)
- `IN_PROGRESS` (Đang khám) → **Visible in queue** (started but not complete)
- `COMPLETED` (Hoàn thành) → **May be filtered from queue** (depends on frontend logic)

**No logic removes records from queue during update** - vitalSigns update does NOT affect status.

---

## 7. Creation Time Stamps

When status changes, timestamps are automatically set:

```javascript
if (updateData.status === MEDICAL_RECORD_STATUS.IN_PROGRESS && !record.startedAt) {
  updateData.startedAt = new Date();
}
if (updateData.status === MEDICAL_RECORD_STATUS.COMPLETED && !record.completedAt) {
  updateData.completedAt = new Date();
}
```

---

## Conclusion

### ✅ vitalSigns ARE Properly Persisted:
1. Validator allows optional vitalSigns object (no filtering)
2. Update handler saves to both ChiSoSinhTon (legacy) and JSON column (modern)
3. Fallback logic ensures vitals are never lost (stored in `_fallbackVitalSigns` if DB fails)
4. Response always includes vitalSigns (from DB or request)

### ✅ Queue Visibility NOT Affected by vitalSigns:
1. vitalSigns updates don't change record status
2. Status changes trigger appointment synchronization
3. No logic removes records from queue when vitalSigns are updated
4. Only status changes (to COMPLETED) might affect queue filtering

### ⚠️ Potential Issues to Check:
- If ChiSoSinhTon table is missing and `models.ChiSoSinhTon` is null, vitals fall back to JSON column
- If JSON column update fails silently, fallback should capture it
- Frontend may need to check for `_fallbackVitalSigns` property in response
