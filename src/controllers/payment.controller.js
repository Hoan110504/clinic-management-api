/**
 * Controller Thanh Toán & Hóa Đơn
 * Canonical implementation for dbo.Payments.
 */
import { Op } from 'sequelize';
import {
  Payment,
  Patient,
  User,
  MedicalExamination,
  Prescription,
  PrescriptionItem,
  Medicine,
  LabOrder,
  LabOrderItem,
  LabService,
} from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';

const PAYMENT_STATUS_CODE = {
  UNPAID: 0,
  PARTIAL: 1,
  PAID: 2,
};

const PAYMENT_METHOD_CODE = {
  CASH: 0,
  CARD: 1,
  TRANSFER: 2,
};

const toFiniteNumber = (value, defaultValue = 0) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
};

const toPositiveInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  const intValue = Math.trunc(numberValue);
  return intValue > 0 ? intValue : null;
};

const normalizePaymentMethodCode = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['tiền mặt', 'tien mat', 'cash', '0'].includes(normalized)) return PAYMENT_METHOD_CODE.CASH;
  if (['thẻ', 'the', 'card', '1'].includes(normalized)) return PAYMENT_METHOD_CODE.CARD;
  if (['chuyển khoản', 'chuyen khoan', 'qr code', 'transfer', 'bank transfer', 'cả tiền mặt và chuyển khoản', 'ca tien mat va chuyen khoan', '2'].includes(normalized)) {
    return PAYMENT_METHOD_CODE.TRANSFER;
  }
  return null;
};

const paymentMethodLabel = (value) => {
  const code = normalizePaymentMethodCode(value);
  if (code === PAYMENT_METHOD_CODE.CASH) return 'Tiền mặt';
  if (code === PAYMENT_METHOD_CODE.CARD) return 'Chuyển khoản';
  if (code === PAYMENT_METHOD_CODE.TRANSFER) return 'Cả tiền mặt và chuyển khoản';
  return value === null || value === undefined ? '' : String(value);
};

const aggregatePaymentMethodCode = (currentValue, incomingValue) => {
  const currentCode = normalizePaymentMethodCode(currentValue);
  const incomingCode = normalizePaymentMethodCode(incomingValue);

  if (currentCode === PAYMENT_METHOD_CODE.TRANSFER) return PAYMENT_METHOD_CODE.TRANSFER;
  if (incomingCode === null) return currentCode;
  if (incomingCode === PAYMENT_METHOD_CODE.TRANSFER) return PAYMENT_METHOD_CODE.TRANSFER;
  if (currentCode === null) return incomingCode;
  if (currentCode === incomingCode) return currentCode;
  return PAYMENT_METHOD_CODE.TRANSFER;
};

const normalizePaymentStatusCode = (value) => {
  if (value === null || value === undefined || value === '') return PAYMENT_STATUS_CODE.UNPAID;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return PAYMENT_STATUS_CODE.UNPAID;
  if (['chưa thanh toán', 'chua thanh toan', 'unpaid', '0'].includes(normalized)) return PAYMENT_STATUS_CODE.UNPAID;
  if (['còn nợ', 'con no', 'thanh toán một phần', 'thanh toan mot phan', 'partial', '1'].includes(normalized)) return PAYMENT_STATUS_CODE.PARTIAL;
  if (['đã thanh toán', 'da thanh toan', 'paid', '2'].includes(normalized)) return PAYMENT_STATUS_CODE.PAID;
  return PAYMENT_STATUS_CODE.UNPAID;
};

const paymentStatusLabel = (value) => {
  const code = normalizePaymentStatusCode(value);
  if (code === PAYMENT_STATUS_CODE.PAID) return 'Đã thanh toán';
  if (code === PAYMENT_STATUS_CODE.PARTIAL) return 'Còn nợ';
  return 'Chưa thanh toán';
};

const derivePaymentType = (payment) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  if (raw.labOrderId || raw.LabOrderID) return 'Xét nghiệm';
  if (raw.prescriptionId || raw.PrescriptionID) return 'Đơn thuốc';
  if (raw.examinationId || raw.ExaminationID) return 'Khám bệnh';
  return 'Thanh toán';
};

const summarizeRelatedEntity = (entity, idField, labelField) => {
  if (!entity) return null;
  const raw = entity.get ? entity.get({ plain: true }) : entity;
  const id = raw[idField] ?? raw[idField?.toLowerCase?.()] ?? raw.id ?? null;
  return {
    id: id !== null && id !== undefined ? String(id) : null,
    label: raw[labelField] ?? raw.fullName ?? raw.name ?? null,
  };
};

const resolveInvoiceDate = (payment) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  return raw.invoiceDate ?? raw.InvoiceDate ?? raw.createdAt ?? raw.CreatedAt ?? null;
};

const resolveTotalAmount = (payment) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  return toFiniteNumber(raw.totalAmount ?? raw.TotalAmount ?? raw.total ?? 0, 0);
};

const resolvePaidAmount = (payment) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  return toFiniteNumber(raw.paidAmount ?? raw.PaidAmount ?? raw.amountPaid ?? 0, 0);
};

const resolveDebtAmount = (payment) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  // Use FinalAmount if available, otherwise fall back to totalAmount
  const finalAmount = toFiniteNumber(raw.finalAmount ?? raw.FinalAmount, null);
  const amountToUse = finalAmount !== null ? finalAmount : resolveTotalAmount(raw);
  const paidAmount = resolvePaidAmount(raw);
  return toFiniteNumber(raw.debtAmount ?? raw.DebtAmount ?? Math.max(0, amountToUse - paidAmount), 0);
};

const getPlain = (value) => (value?.get ? value.get({ plain: true }) : (value || {}));

const formatCashierDisplay = (user) => {
  return user?.full_name || user?.fullName || user?.username || '';
};

const buildInvoiceBreakdownFromExamination = async (examinationId) => {
  if (!examinationId) {
    return {
      services: [],
      medicines: [],
      consultationFee: 0,
      labTestFee: 0,
      medicineFee: 0,
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
    };
  }

  const examination = await MedicalExamination.findByPk(examinationId, {
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender', 'address'], required: false },
      { model: User, as: 'doctor', attributes: ['id', 'fullName', 'full_name'], required: false },
    ],
  });

  if (!examination) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  const [labOrders, prescriptions] = await Promise.all([
    LabOrder.findAll({
      where: { examinationId },
      include: [
        {
          model: LabOrderItem,
          as: 'items',
          required: false,
          include: [{ model: LabService, as: 'Service', required: false }],
        },
      ],
    }),
    Prescription.findAll({
      where: { examinationId, status: 1 },
      include: [
        {
          model: PrescriptionItem,
          as: 'prescriptionItems',
          required: false,
          include: [{ model: Medicine, as: 'medicine', required: false }],
        },
      ],
    }),
  ]);

  const services = [];
  for (const labOrder of labOrders) {
    const orderPlain = getPlain(labOrder);
    const items = Array.isArray(orderPlain.items) ? orderPlain.items : [];
    items.forEach((item) => {
      const itemPlain = getPlain(item);
      if (Number(itemPlain.status ?? itemPlain.Status ?? 0) !== 2) return;
      const service = getPlain(itemPlain.Service || itemPlain.service || {});
      const price = toFiniteNumber(service.price ?? service.Price ?? 0, 0);
      services.push({
        id: String(itemPlain.labOrderItemId ?? itemPlain.LabOrderItemID ?? itemPlain.id ?? ''),
        name: service.serviceName ?? service.ServiceName ?? 'Dịch vụ xét nghiệm',
        room: service.roomId ?? service.RoomID ?? itemPlain.roomId ?? itemPlain.RoomID ?? null,
        price,
        amount: price,
      });
    });
  }

  const medicines = [];
  for (const prescription of prescriptions) {
    const prescriptionPlain = getPlain(prescription);
    const items = Array.isArray(prescriptionPlain.prescriptionItems) ? prescriptionPlain.prescriptionItems : [];
    items.forEach((item) => {
      const itemPlain = getPlain(item);
      const medicine = getPlain(itemPlain.medicine || itemPlain.Medicine || {});
      const quantity = Math.max(0, Math.trunc(toFiniteNumber(itemPlain.quantity ?? itemPlain.quantityPrescribed ?? itemPlain.QuantityPrescribed, 0)));
      const price = toFiniteNumber(medicine.price ?? medicine.Price ?? 0, 0);
      medicines.push({
        id: String(itemPlain.id ?? itemPlain.PrescriptionItemID ?? ''),
        medicineId: String(itemPlain.medicineId ?? itemPlain.MedicineId ?? medicine.id ?? medicine.Id ?? ''),
        medicineName: medicine.name ?? medicine.Name ?? 'Thuốc',
        unit: medicine.unit ?? medicine.Unit ?? null,
        dosage: itemPlain.dosage ?? itemPlain.Dosage ?? '',
        quantity,
        price,
        amount: price * quantity,
      });
    });
  }

  const consultationFee = 0;
  const labTestFee = services.reduce((sum, row) => sum + toFiniteNumber(row.amount, 0), 0);
  const medicineFee = medicines.reduce((sum, row) => sum + toFiniteNumber(row.amount, 0), 0);
  const subtotal = consultationFee + labTestFee + medicineFee;

  return {
    examinationId: getPlain(examination)?.ExaminationID ?? getPlain(examination)?.examinationId ?? null,
    examination: getPlain(examination),
    patient: getPlain(getPlain(examination).patient),
    patientId: getPlain(getPlain(examination).patient)?.id ?? null,
    doctor: getPlain(getPlain(examination).doctor),
    doctorName: getPlain(getPlain(examination).doctor)?.fullName || getPlain(getPlain(examination).doctor)?.full_name || null,
    services,
    medicines,
    consultationFee,
    labTestFee,
    medicineFee,
    subtotal,
    discountAmount: 0,
    totalAmount: subtotal,
  };
};

const buildPaymentPreviewFromBreakdown = (breakdown) => serializePayment({
  patient: breakdown.patient,
  patientId: breakdown.patientId,
  examinationId: breakdown.examinationId,
  examination: breakdown.examination,
  doctor: breakdown.doctor,
  services: breakdown.services,
  medicines: breakdown.medicines,
  consultationFee: breakdown.consultationFee,
  labTestFee: breakdown.labTestFee,
  medicineFee: breakdown.medicineFee,
  subtotal: breakdown.subtotal,
  totalAmount: breakdown.totalAmount,
  paidAmount: 0,
  debtAmount: breakdown.totalAmount,
  paymentMethod: null,
  status: PAYMENT_STATUS_CODE.UNPAID,
  invoiceDate: new Date(),
}, {
  paidAmount: 0,
  debtAmount: breakdown.totalAmount,
  doctorName: breakdown.doctorName,
  patientId: breakdown.patientId,
  examinationId: breakdown.examinationId,
});

const paymentAmountFromRequest = (body = {}) => {
  const consultationFee = Math.max(0, toFiniteNumber(body.consultationFee, 0));
  const labTestFee = Math.max(0, toFiniteNumber(body.labTestFee, 0));
  const medicineFee = Math.max(0, toFiniteNumber(body.medicineFee, 0));
  const subtotal = consultationFee + labTestFee + medicineFee;

  let discountAmount = 0;
  if (body.discountType === 'percent') {
    discountAmount = (subtotal * toFiniteNumber(body.discountValue, 0)) / 100;
  } else if (body.discountType === 'amount') {
    discountAmount = toFiniteNumber(body.discountValue, 0);
  }

  const derivedTotal = Math.max(0, subtotal - discountAmount);
  const finalAmount = Math.max(0, toFiniteNumber(body.finalAmount ?? body.total, derivedTotal));
  return {
    subtotal,
    discountAmount,
    finalAmount,
    totalAmount: Math.max(0, toFiniteNumber(body.totalAmount ?? body.total, derivedTotal)),
    consultationFee,
    labTestFee,
    medicineFee,
  };
};

const serializePayment = (payment, overrides = {}) => {
  const raw = payment?.get ? payment.get({ plain: true }) : (payment || {});
  const patient = raw.patient || {};
  const examination = raw.examination || {};
  const prescription = raw.prescription || {};
  const labOrder = raw.labOrder || {};
  const doctor = examination.doctor || raw.doctor || {};
  const cashier = raw.createdByUser || raw.createdBy || raw.cashier || {};
  const invoiceDate = resolveInvoiceDate(raw);
  const totalAmount = resolveTotalAmount(raw);
  const paymentMethodCode = normalizePaymentMethodCode(raw.paymentMethod ?? raw.PaymentMethod);
  const statusCode = normalizePaymentStatusCode(raw.status ?? raw.Status);
  const paidAmount = overrides.paidAmount ?? resolvePaidAmount(raw);
  const debtAmount = overrides.debtAmount ?? resolveDebtAmount(raw);

  return {
    id: raw.id !== undefined && raw.id !== null ? String(raw.id) : null,
    patientId: raw.patientId !== undefined && raw.patientId !== null ? String(raw.patientId) : null,
    examinationId: raw.examinationId !== undefined && raw.examinationId !== null ? String(raw.examinationId) : null,
    prescriptionId: raw.prescriptionId !== undefined && raw.prescriptionId !== null ? String(raw.prescriptionId) : null,
    labOrderId: raw.labOrderId !== undefined && raw.labOrderId !== null ? String(raw.labOrderId) : null,
    invoiceDate,
    totalAmount,
    total: totalAmount,
    paymentMethodCode,
    paymentMethod: paymentMethodLabel(paymentMethodCode),
    statusCode,
    status: paymentStatusLabel(statusCode),
    createdAt: raw.createdAt ?? raw.CreatedAt ?? invoiceDate,
    updatedAt: raw.updatedAt ?? raw.UpdatedAt ?? null,
    type: derivePaymentType(raw),
    patientName: patient.fullName ?? raw.patientName ?? '',
    patientPhone: patient.phone ?? raw.patientPhone ?? '',
    patientBirthDate: patient.dateOfBirth ?? raw.patientBirthDate ?? null,
    patientGender: patient.gender ?? raw.patientGender ?? '',
    patientAddress: patient.address ?? raw.patientAddress ?? '',
    cashierName: overrides.cashierName ?? formatCashierDisplay(cashier),
    doctorName: doctor.fullName ?? doctor.full_name ?? raw.doctorName ?? overrides.doctorName ?? '',
    consultationFee: toFiniteNumber(raw.consultationFee ?? 0, 0),
    labTestFee: toFiniteNumber(raw.labTestFee ?? 0, 0),
    medicineFee: toFiniteNumber(raw.medicineFee ?? 0, 0),
    subtotal: toFiniteNumber(raw.subtotal ?? totalAmount, totalAmount),
    discountType: raw.discountType ?? null,
    discountValue: toFiniteNumber(raw.discountValue ?? 0, 0),
    discountAmount: toFiniteNumber(raw.discountAmount ?? 0, 0),
    finalAmount: toFiniteNumber(raw.finalAmount ?? totalAmount, totalAmount),
    paidAmount,
    amountPaid: paidAmount,
    debtAmount,
    changeAmount: overrides.changeAmount ?? 0,
    paidAt: overrides.paidAt ?? invoiceDate,
    notes: raw.notes ?? null,
    services: raw.services ?? [],
    medicines: raw.medicines ?? [],
    patient: raw.patient ? summarizeRelatedEntity(patient, 'id', 'fullName') : (patient?.id ? summarizeRelatedEntity(patient, 'id', 'fullName') : null),
    examination: raw.examination ? summarizeRelatedEntity(examination, 'examinationId', 'examinationCode') : null,
    prescription: raw.prescription ? summarizeRelatedEntity(prescription, 'prescriptionId', 'prescriptionCode') : null,
    labOrder: raw.labOrder ? summarizeRelatedEntity(labOrder, 'labOrderId', 'labOrderCode') : null,
    ...overrides,
  };
};

const buildPaymentIncludes = () => ([
  {
    model: Patient,
    as: 'patient',
    attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender', 'address'],
    required: false,
  },
  {
    model: MedicalExamination,
    as: 'examination',
    include: [
      {
        model: User,
        as: 'doctor',
        attributes: ['id', 'fullName', 'full_name'],
        required: false,
      },
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender', 'address'],
        required: false,
      },
    ],
    required: false,
  },
  {
    model: Prescription,
    as: 'prescription',
    required: false,
  },
  {
    model: LabOrder,
    as: 'labOrder',
    required: false,
  },
  {
    model: User,
    as: 'createdByUser',
    attributes: ['id', 'full_name', 'fullName', 'username'],
    required: false,
  },
]);

const buildPaymentWhere = (query = {}) => {
  const where = {};
  const { status, patientId, examinationId, prescriptionId, labOrderId, fromDate, toDate, search } = query;

  if (patientId) where.patientId = patientId;
  if (examinationId) where.examinationId = examinationId;
  if (prescriptionId) where.prescriptionId = prescriptionId;
  if (labOrderId) where.labOrderId = labOrderId;
  if (status !== undefined && status !== null && status !== '') where.status = normalizePaymentStatusCode(status);

  if (fromDate && toDate) {
    where.invoiceDate = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  if (search) {
    const like = `%${search}%`;
    where[Op.or] = [
      { id: { [Op.like]: like } },
      { '$patient.fullName$': { [Op.like]: like } },
      { '$patient.phone$': { [Op.like]: like } },
    ];
  }

  return where;
};

const resolvePaymentPayload = (body = {}) => {
  const paymentAmount = paymentAmountFromRequest(body);
  const paidAmount = Math.max(0, toFiniteNumber(body.paidAmount ?? body.amountPaid, 0));
  
  // Use discountAmount from body if provided, otherwise use calculated value
  const discountAmount = body.discountAmount !== undefined && body.discountAmount !== null
    ? Math.max(0, toFiniteNumber(body.discountAmount, 0))
    : paymentAmount.discountAmount;
  
  // Use finalAmount from body if provided, otherwise use calculated value
  const finalAmount = body.finalAmount !== undefined && body.finalAmount !== null
    ? Math.max(0, toFiniteNumber(body.finalAmount, 0))
    : paymentAmount.finalAmount;
  
  const debtAmount = Math.max(0, toFiniteNumber(body.debtAmount ?? Math.max(0, finalAmount - paidAmount), 0));
  // If debtAmount <= 0 => fully paid (PAID). If debtAmount > 0 => partial (Còn nợ).
  const derivedStatus = debtAmount > 0
    ? PAYMENT_STATUS_CODE.PARTIAL
    : PAYMENT_STATUS_CODE.PAID;
  return {
    patientId: toPositiveInteger(body.patientId),
    examinationId: toPositiveInteger(body.examinationId ?? body.medicalRecordId ?? body.ExaminationID ?? body.recordId),
    prescriptionId: toPositiveInteger(body.prescriptionId ?? body.PrescriptionID),
    labOrderId: toPositiveInteger(body.labOrderId ?? body.LabOrderID),
    invoiceDate: body.invoiceDate ? new Date(body.invoiceDate) : new Date(),
    totalAmount: paymentAmount.totalAmount,
    finalAmount,
    discountAmount,
    paidAmount,
    debtAmount,
    paymentMethod: normalizePaymentMethodCode(body.paymentMethod),
    status: body.status !== undefined && body.status !== null && body.status !== ''
      ? normalizePaymentStatusCode(body.status)
      : derivedStatus,
  };
};

const getAllPayments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { sort } = req.query;
  const where = buildPaymentWhere(req.query);
  const order = parseSort(sort, ['invoiceDate', 'totalAmount', 'status', 'createdAt', 'updatedAt'], 'invoiceDate:desc');

  const { count, rows } = await Payment.findAndCountAll({
    where,
    order,
    limit,
    offset,
    distinct: true,
    include: buildPaymentIncludes(),
  });

  return paginatedResponse(res, {
    data: rows.map((row) => serializePayment(row)),
    page,
    limit,
    total: count,
  });
});

const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await Payment.findByPk(id, {
    include: buildPaymentIncludes(),
  });

  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  const breakdown = await buildInvoiceBreakdownFromExamination(payment.examinationId ?? payment.ExaminationID);
  return successResponse(res, serializePayment(payment, breakdown));
});

const getPaymentPreview = asyncHandler(async (req, res) => {
  const examinationId = toPositiveInteger(req.params.examinationId ?? req.query.examinationId);
  if (!examinationId) {
    throw new BadRequestError('ExaminationID không hợp lệ');
  }

  const breakdown = await buildInvoiceBreakdownFromExamination(examinationId);
  return successResponse(res, buildPaymentPreviewFromBreakdown(breakdown));
});

const createPayment = asyncHandler(async (req, res) => {
  const payload = resolvePaymentPayload(req.body);
  const breakdown = await buildInvoiceBreakdownFromExamination(payload.examinationId);
  const resolvedPatientId = payload.patientId ?? toPositiveInteger(breakdown.patient?.id ?? breakdown.patient?.PatientId ?? breakdown.examination?.patientId);
  if (!resolvedPatientId) {
    throw new BadRequestError('PatientId không hợp lệ');
  }

  const existingPayment = payload.examinationId
    ? await Payment.findOne({
        where: { examinationId: payload.examinationId },
        include: buildPaymentIncludes(),
      })
    : null;

  if (existingPayment) {
    await existingPayment.update({
      ...payload,
      patientId: resolvedPatientId,
      createdBy: req.user?.id ?? existingPayment.createdBy ?? null,
      totalAmount: payload.totalAmount,
      finalAmount: payload.finalAmount,
      discountAmount: payload.discountAmount,
      debtAmount: undefined,
    });

    const refreshedExisting = await Payment.findByPk(existingPayment.id, { include: buildPaymentIncludes() });
    const nextExistingPayload = {
      ...breakdown,
      paidAmount: payload.paidAmount,
      status: payload.status,
      paymentMethod: payload.paymentMethod,
      patientId: resolvedPatientId,
      doctorName: breakdown.doctorName,
      cashierName: formatCashierDisplay(req.user),
    };

    return successResponse(res, serializePayment(refreshedExisting || existingPayment, nextExistingPayload), 'Cập nhật hóa đơn thành công');
  }

  const payment = await Payment.create({
    ...payload,
    patientId: resolvedPatientId,
    createdBy: req.user?.id ?? null,
    totalAmount: payload.totalAmount,
    finalAmount: payload.finalAmount,
    discountAmount: payload.discountAmount,
    debtAmount: undefined,
  });
  const created = await Payment.findByPk(payment.id, { include: buildPaymentIncludes() });
  const nextPayload = {
    ...breakdown,
    paidAmount: payload.paidAmount,
    status: payload.status,
    paymentMethod: payload.paymentMethod,
    patientId: resolvedPatientId,
    doctorName: breakdown.doctorName,
    cashierName: formatCashierDisplay(req.user),
  };

  return createdResponse(res, serializePayment(created || payment, nextPayload), 'Tạo hóa đơn thành công');
});

const processPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod } = req.body;
  const paidInput = req.body.paidAmount ?? req.body.amountPaid;
  const requestedTotalAmount = req.body.totalAmount ?? req.body.total;
  const discountType = req.body.discountType;
  const discountValue = toFiniteNumber(req.body.discountValue, 0);

  const payment = await Payment.findByPk(id, { include: buildPaymentIncludes() });
  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  const currentStatus = normalizePaymentStatusCode(payment.status);
  if (currentStatus === PAYMENT_STATUS_CODE.PAID) {
    throw new BadRequestError('Hóa đơn đã được thanh toán');
  }

  const paidAmount = toFiniteNumber(paidInput, 0);
  const totalAmount = requestedTotalAmount !== undefined && requestedTotalAmount !== null && requestedTotalAmount !== ''
    ? Math.max(0, toFiniteNumber(requestedTotalAmount, resolveTotalAmount(payment)))
    : resolveTotalAmount(payment);
  
  const requestedDiscountAmount = req.body.discountAmount ?? req.body.DiscountAmount;
  const requestedFinalAmount = req.body.finalAmount ?? req.body.FinalAmount;
  
  // Use discountAmount from request if provided, otherwise calculate from discountType/discountValue or keep existing
  let discountAmount = toFiniteNumber(payment.discountAmount ?? 0, 0);
  if (requestedDiscountAmount !== undefined && requestedDiscountAmount !== null) {
    discountAmount = Math.max(0, toFiniteNumber(requestedDiscountAmount, 0));
  } else if (discountType && discountValue !== null && discountValue !== undefined) {
    if (discountType === 'percent') {
      discountAmount = (totalAmount * discountValue) / 100;
    } else if (discountType === 'amount') {
      discountAmount = discountValue;
    }
  }
  
  // Use finalAmount from request if provided, otherwise calculate from totalAmount - discountAmount
  const finalAmount = requestedFinalAmount !== undefined && requestedFinalAmount !== null
    ? Math.max(0, toFiniteNumber(requestedFinalAmount, 0))
    : Math.max(0, totalAmount - discountAmount);
  const nextPaidAmount = Math.max(0, resolvePaidAmount(payment) + paidAmount);
  const debtAmount = Math.max(0, finalAmount - nextPaidAmount);
  const changeAmount = Math.max(0, nextPaidAmount - finalAmount);
  const nextMethodCode = aggregatePaymentMethodCode(payment.paymentMethod, paymentMethod);
  const nextStatus = debtAmount > 0 ? PAYMENT_STATUS_CODE.PARTIAL : PAYMENT_STATUS_CODE.PAID;

  await payment.update({
    paymentMethod: nextMethodCode,
    paidAmount: nextPaidAmount,
    totalAmount,
    finalAmount,
    discountAmount,
    status: nextStatus,
    createdBy: req.user?.id ?? null,
  });

  const refreshed = await Payment.findByPk(id, { include: buildPaymentIncludes() });
  return successResponse(
    res,
    serializePayment(refreshed || payment, {
      paidAmount: nextPaidAmount,
      amountPaid: nextPaidAmount,
      debtAmount,
      changeAmount,
      paidAt: new Date().toISOString(),
    }),
    'Thanh toán thành công'
  );
});

const updatePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await Payment.findByPk(id, { include: buildPaymentIncludes() });

  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  if (normalizePaymentStatusCode(payment.status) === PAYMENT_STATUS_CODE.PAID) {
    throw new BadRequestError('Không thể cập nhật hóa đơn đã thanh toán');
  }

  const updateData = {};
  if (req.body.patientId !== undefined) updateData.patientId = toPositiveInteger(req.body.patientId);
  if (req.body.examinationId !== undefined || req.body.medicalRecordId !== undefined || req.body.ExaminationID !== undefined) {
    updateData.examinationId = toPositiveInteger(req.body.examinationId ?? req.body.medicalRecordId ?? req.body.ExaminationID);
  }
  if (req.body.prescriptionId !== undefined || req.body.PrescriptionID !== undefined) {
    updateData.prescriptionId = toPositiveInteger(req.body.prescriptionId ?? req.body.PrescriptionID);
  }
  if (req.body.labOrderId !== undefined || req.body.LabOrderID !== undefined) {
    updateData.labOrderId = toPositiveInteger(req.body.labOrderId ?? req.body.LabOrderID);
  }
  if (req.body.invoiceDate !== undefined) updateData.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : null;

  const amountData = paymentAmountFromRequest(req.body);
  if (req.body.totalAmount !== undefined || req.body.total !== undefined || req.body.consultationFee !== undefined || req.body.labTestFee !== undefined || req.body.medicineFee !== undefined) {
    updateData.totalAmount = amountData.totalAmount;
  }
  if (req.body.paidAmount !== undefined || req.body.amountPaid !== undefined) {
    updateData.paidAmount = Math.max(0, toFiniteNumber(req.body.paidAmount ?? req.body.amountPaid, 0));
  }
  if (req.body.paymentMethod !== undefined) updateData.paymentMethod = normalizePaymentMethodCode(req.body.paymentMethod);
  if (req.body.status !== undefined) updateData.status = normalizePaymentStatusCode(req.body.status);

  await payment.update(updateData);
  const refreshed = await Payment.findByPk(id, { include: buildPaymentIncludes() });

  return successResponse(res, serializePayment(refreshed || payment), 'Cập nhật hóa đơn thành công');
});

const deletePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payment = await Payment.findByPk(id);

  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  if (normalizePaymentStatusCode(payment.status) === PAYMENT_STATUS_CODE.PAID) {
    throw new BadRequestError('Không thể xóa hóa đơn đã thanh toán');
  }

  await payment.destroy();
  return noContentResponse(res);
});

const getUnpaidPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.findAll({
    where: { status: { [Op.in]: [PAYMENT_STATUS_CODE.UNPAID, PAYMENT_STATUS_CODE.PARTIAL] } },
    order: [['createdAt', 'DESC']],
    include: buildPaymentIncludes(),
  });

  return successResponse(res, payments.map((payment) => serializePayment(payment)));
});

const getPaymentStatistics = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;

  const dateFilter = {};
  if (fromDate && toDate) {
    dateFilter.invoiceDate = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateFilter.invoiceDate = {
      [Op.between]: [today, tomorrow],
    };
  }

  const paidPayments = await Payment.findAll({
    where: { ...dateFilter, status: PAYMENT_STATUS_CODE.PAID },
    include: buildPaymentIncludes(),
  });

  const totalRevenue = paidPayments.reduce((sum, row) => sum + resolveTotalAmount(row), 0);

  const revenueByTypeMap = new Map();
  paidPayments.forEach((row) => {
    const type = derivePaymentType(row);
    const current = revenueByTypeMap.get(type) || { type, total: 0, count: 0 };
    current.total += resolveTotalAmount(row);
    current.count += 1;
    revenueByTypeMap.set(type, current);
  });

  const unpaidCount = await Payment.count({ where: { status: { [Op.in]: [PAYMENT_STATUS_CODE.UNPAID, PAYMENT_STATUS_CODE.PARTIAL] } } });

  return successResponse(res, {
    totalRevenue,
    revenueByType: Array.from(revenueByTypeMap.values()),
    paidCount: paidPayments.length,
    unpaidCount,
  });
});

export {
  getAllPayments,
  getPaymentById,
  getPaymentPreview,
  createPayment,
  processPayment,
  updatePayment,
  deletePayment,
  getUnpaidPayments,
  getPaymentStatistics,
};
