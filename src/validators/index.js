/**
 * Validators Index
 * Central export for all validators
 */

module.exports = {
  authValidator: require('./auth.validator'),
  userValidator: require('./user.validator'),
  patientValidator: require('./patient.validator'),
  appointmentValidator: require('./appointment.validator'),
  medicalRecordValidator: require('./medicalRecord.validator'),
  medicineValidator: require('./medicine.validator'),
  paymentValidator: require('./payment.validator'),
  labTestValidator: require('./labTest.validator'),
  prescriptionValidator: require('./prescription.validator'),
};
