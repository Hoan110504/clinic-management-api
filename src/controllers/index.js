/**
 * Controllers Index
 * Central export for all controllers
 */

module.exports = {
  authController: require('./auth.controller'),
  userController: require('./user.controller'),
  patientController: require('./patient.controller'),
  appointmentController: require('./appointment.controller'),
  medicalRecordController: require('./medicalRecord.controller'),
  medicineController: require('./medicine.controller'),
  labTestController: require('./labTest.controller'),
  prescriptionController: require('./prescription.controller'),
  paymentController: require('./payment.controller'),
  dashboardController: require('./dashboard.controller'),
};
