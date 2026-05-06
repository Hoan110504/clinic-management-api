/**
 * Query Whitelist Configuration
 * 
 * Defines all allowed queries for the AI Medical Chatbot with role-based access control.
 * Each query includes:
 * - id: Unique query identifier
 * - description: Human-readable description for AI query selection
 * - requiredRoles: Array of role IDs that can execute this query
 * - handler: Async function that executes the query with role-based filtering
 * 
 * Role IDs: 1=Admin, 2=Doctor, 3=Receptionist, 4=Pharmacist, 5=Patient, 6=LabTech
 * 
 * Implements Requirements 2.1, 2.4, 2.6, 2.7, 23.2
 */

import { ROLES } from './constants.js';
import db from '../models/index.js';
import { Op } from 'sequelize';

/**
 * Query Whitelist Map
 * Key: query_id (string)
 * Value: Query configuration object
 */
const QUERY_WHITELIST = new Map();

// ============================================================================
// PATIENT-SCOPED QUERIES
// These queries return data specific to the authenticated patient user
// ============================================================================

/**
 * Query: my_appointments
 * Returns appointments for the authenticated patient
 * Roles: Patient (5)
 */
QUERY_WHITELIST.set('my_appointments', {
  id: 'my_appointments',
  description: 'Get my upcoming and past appointments with doctors',
  requiredRoles: [ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Find patient record linked to this user
    const patient = await db.Patient.findOne({
      where: { userId }
    });
    
    if (!patient) {
      return [];
    }
    
    // Get appointments for this patient
    const appointments = await db.Appointment.findAll({
      where: {
        patientId: patient.id
      },
      include: [
        {
          model: db.User,
          as: 'assignedDoctor',
          attributes: ['id', 'fullName', 'email']
        }
      ],
      order: [['appointmentDate', 'DESC'], ['timeSlot', 'ASC']],
      limit: 50 // Limit to recent 50 appointments
    });
    
    return appointments;
  }
});

/**
 * Query: my_prescriptions
 * Returns prescriptions for the authenticated patient
 * Roles: Patient (5)
 */
QUERY_WHITELIST.set('my_prescriptions', {
  id: 'my_prescriptions',
  description: 'Get my medication prescriptions and prescription details',
  requiredRoles: [ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Find patient record linked to this user
    const patient = await db.Patient.findOne({
      where: { userId }
    });
    
    if (!patient) {
      return [];
    }
    
    // Get prescriptions through medical examinations
    const prescriptions = await db.Prescription.findAll({
      include: [
        {
          model: db.MedicalExamination,
          as: 'examination',
          where: { PatientId: patient.id },
          required: true,
          attributes: ['ExaminationID', 'ExaminationDate', 'Diagnosis']
        },
        {
          model: db.User,
          as: 'doctor',
          attributes: ['id', 'fullName']
        },
        {
          model: db.PrescriptionItem,
          as: 'prescriptionItems',
          include: [
            {
              model: db.Medicine,
              as: 'medicine',
              attributes: ['id', 'name', 'unit', 'category']
            }
          ]
        }
      ],
      order: [['prescriptionDate', 'DESC']],
      limit: 30 // Limit to recent 30 prescriptions
    });
    
    return prescriptions;
  }
});

/**
 * Query: my_lab_results
 * Returns lab test results for the authenticated patient
 * Roles: Patient (5)
 */
QUERY_WHITELIST.set('my_lab_results', {
  id: 'my_lab_results',
  description: 'Get my laboratory test results and clinical findings',
  requiredRoles: [ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Find patient record linked to this user
    const patient = await db.Patient.findOne({
      where: { userId }
    });
    
    if (!patient) {
      return [];
    }
    
    // Get lab results through medical examinations
    const labResults = await db.LabResult.findAll({
      include: [
        {
          model: db.MedicalExamination,
          as: 'Examination',
          where: { PatientId: patient.id },
          required: true,
          attributes: ['ExaminationID', 'ExaminationDate']
        },
        {
          model: db.LabService,
          as: 'Service',
          attributes: ['ServiceID', 'ServiceName', 'Unit', 'NormalRange']
        },
        {
          model: db.User,
          as: 'Doctor',
          attributes: ['id', 'fullName']
        }
      ],
      order: [['resultDate', 'DESC']],
      limit: 50 // Limit to recent 50 lab results
    });
    
    return labResults;
  }
});

/**
 * Query: my_medical_history
 * Returns medical examination history for the authenticated patient
 * Roles: Patient (5)
 */
QUERY_WHITELIST.set('my_medical_history', {
  id: 'my_medical_history',
  description: 'Get my medical examination history, diagnoses, and treatment advice',
  requiredRoles: [ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Find patient record linked to this user
    const patient = await db.Patient.findOne({
      where: { userId }
    });
    
    if (!patient) {
      return [];
    }
    
    // Get medical examinations for this patient
    const examinations = await db.MedicalExamination.findAll({
      where: { PatientId: patient.id },
      include: [
        {
          model: db.User,
          as: 'doctor',
          attributes: ['id', 'fullName']
        },
        {
          model: db.Appointment,
          as: 'appointment',
          attributes: ['id', 'appointmentDate', 'timeSlot']
        }
      ],
      order: [['ExaminationDate', 'DESC']],
      limit: 30 // Limit to recent 30 examinations
    });
    
    return examinations;
  }
});

// ============================================================================
// CLINICAL QUERIES
// These queries return clinical data with role-based access control
// ============================================================================

/**
 * Query: lab_services_info
 * Returns information about laboratory services and their prices
 * Roles: Admin (1), Doctor (2), Receptionist (3), Patient (5), LabTech (6)
 */
QUERY_WHITELIST.set('lab_services_info', {
  id: 'lab_services_info',
  description: 'Get information about laboratory services including ultrasound, ECG, and lab tests with prices',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT, 6], // 6 = LabTech
  handler: async (userId, userRole) => {
    // Get active lab services with their information
    const labServices = await db.LabService.findAll({
      where: {
        isActive: true
      },
      attributes: ['serviceId', 'serviceName', 'price', 'serviceType'],
      order: [['serviceType', 'ASC'], ['serviceName', 'ASC']],
      limit: 100 // Limit to 100 services
    });
    
    // Add service type descriptions
    const servicesWithTypes = labServices.map(service => {
      const serviceData = service.toJSON();
      let serviceTypeDescription = '';
      
      switch (service.serviceType) {
        case 1:
          serviceTypeDescription = 'Siêu âm (Ultrasound)';
          break;
        case 2:
          serviceTypeDescription = 'Điện tim (ECG)';
          break;
        case 3:
          serviceTypeDescription = 'Xét nghiệm (Lab Test)';
          break;
        default:
          serviceTypeDescription = 'Dịch vụ khác';
      }
      
      return {
        ...serviceData,
        serviceTypeDescription
      };
    });
    
    return servicesWithTypes;
  }
});

/**
 * Query: clinic_info
 * Returns general clinic information including operating hours
 * Roles: All roles
 */
QUERY_WHITELIST.set('clinic_info', {
  id: 'clinic_info',
  description: 'Get general clinic information including operating hours, contact info, and services',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.PATIENT, 6], // All roles
  handler: async (userId, userRole) => {
    // Return static clinic information
    return [{
      clinicName: 'Phòng khám Nội khoa',
      operatingHours: {
        weekdays: '7:30 - 17:30',
        weekend: '7:30 - 17:30',
        description: 'Thứ 2 đến Chủ nhật: 7:30 - 17:30 (Mở cửa cả tuần)'
      },
      services: [
        'Khám nội khoa tổng quát',
        'Siêu âm',
        'Điện tim',
        'Xét nghiệm máu',
        'Tư vấn sức khỏe',
        'Kê đơn thuốc'
      ],
      contact: {
        phone: 'Liên hệ lễ tân để biết số điện thoại',
        address: 'Địa chỉ phòng khám'
      },
      appointmentPolicy: 'Có thể đặt lịch hẹn trước hoặc khám trực tiếp trong giờ làm việc (7:30 - 17:30 hàng ngày)'
    }];
  }
});

/**
 * Query: medicines_and_services
 * Returns comprehensive information about medicines and services with prices
 * Roles: All roles - this is the primary query for price inquiries
 */
QUERY_WHITELIST.set('medicines_and_services', {
  id: 'medicines_and_services',
  description: 'Get comprehensive information about all medicines and medical services with prices - use this for any price-related questions',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.PATIENT, 6],
  handler: async (userId, userRole) => {
    // Get all medicines
    const medicines = await db.Medicine.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'unit', 'category', 'price'],
      order: [['name', 'ASC']],
      limit: 100
    });
    
    // Get all lab services
    const labServices = await db.LabService.findAll({
      where: {
        isActive: true
      },
      attributes: ['serviceId', 'serviceName', 'price', 'serviceType'],
      order: [['serviceName', 'ASC']],
      limit: 50
    });
    
    // Format lab services with type descriptions
    const formattedServices = labServices.map(service => {
      let serviceTypeDescription = '';
      switch (service.serviceType) {
        case 1: serviceTypeDescription = 'Siêu âm'; break;
        case 2: serviceTypeDescription = 'Điện tim'; break;
        case 3: serviceTypeDescription = 'Xét nghiệm'; break;
        default: serviceTypeDescription = 'Dịch vụ khác';
      }
      
      return {
        id: service.serviceId,
        name: service.serviceName,
        price: service.price,
        category: serviceTypeDescription,
        type: 'service'
      };
    });
    
    // Format medicines
    const formattedMedicines = medicines.map(medicine => ({
      id: medicine.id,
      name: medicine.name,
      price: medicine.price,
      category: medicine.category,
      unit: medicine.unit,
      type: 'medicine'
    }));
    
    // Combine and return
    return {
      medicines: formattedMedicines,
      services: formattedServices,
      totalMedicines: formattedMedicines.length,
      totalServices: formattedServices.length
    };
  }
});
/**
 * Query: medicines_info
 * Returns complete list of all available medicines with names, categories, units, and prices
 * Roles: Admin (1), Doctor (2), Receptionist (3), Pharmacist (4), Patient (5)
 */
QUERY_WHITELIST.set('medicines_info', {
  id: 'medicines_info',
  description: 'Get complete list of all available medicines with names, categories, units, and prices - use when user asks about medicine catalog or general medicine information',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Get active medicines with basic information
    const medicines = await db.Medicine.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'unit', 'category', 'price'],
      order: [['name', 'ASC']],
      limit: 100 // Limit to 100 medicines to avoid overwhelming the AI
    });
    
    return medicines;
  }
});

/**
 * Query: medicine_search
 * Search for specific medicines by name or category
 * Roles: Admin (1), Doctor (2), Receptionist (3), Pharmacist (4), Patient (5)
 */
QUERY_WHITELIST.set('medicine_search', {
  id: 'medicine_search',
  description: 'Search for specific medicines when user mentions a particular medicine name or medical condition',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PHARMACIST, ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Since we can't get search term from AI, return common medicines
    // This query should be used when user asks about specific medicines
    const commonMedicines = await db.Medicine.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          { name: { [Op.like]: '%paracetamol%' } },
          { name: { [Op.like]: '%amoxicillin%' } },
          { name: { [Op.like]: '%ibuprofen%' } },
          { name: { [Op.like]: '%aspirin%' } },
          { category: { [Op.like]: '%đau%' } },
          { category: { [Op.like]: '%sốt%' } },
          { category: { [Op.like]: '%kháng sinh%' } }
        ]
      },
      attributes: ['id', 'name', 'unit', 'category', 'price'],
      order: [['name', 'ASC']],
      limit: 50
    });
    
    return commonMedicines;
  }
});

/**
 * Query: service_prices
 * Get pricing information for all clinic services
 * Roles: Admin (1), Doctor (2), Receptionist (3), Patient (5)
 */
QUERY_WHITELIST.set('service_prices', {
  id: 'service_prices',
  description: 'Get pricing information for medical examinations and laboratory services',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT],
  handler: async (userId, userRole) => {
    // Get lab services prices
    const labServices = await db.LabService.findAll({
      where: { isActive: true },
      attributes: ['serviceId', 'serviceName', 'price', 'serviceType'],
      order: [['serviceType', 'ASC'], ['serviceName', 'ASC']]
    });
    
    // Format with service type descriptions
    const servicesWithPrices = labServices.map(service => {
      let serviceTypeDescription = '';
      switch (service.serviceType) {
        case 1: serviceTypeDescription = 'Siêu âm'; break;
        case 2: serviceTypeDescription = 'Điện tim'; break;
        case 3: serviceTypeDescription = 'Xét nghiệm'; break;
        default: serviceTypeDescription = 'Dịch vụ khác';
      }
      
      return {
        serviceId: service.serviceId,
        serviceName: service.serviceName,
        price: service.price,
        serviceType: serviceTypeDescription,
        category: 'Dịch vụ y tế'
      };
    });
    
    // Add general consultation fee (static info)
    servicesWithPrices.unshift({
      serviceId: 'consultation',
      serviceName: 'Khám nội khoa tổng quát',
      price: 200000, // Example price - adjust as needed
      serviceType: 'Khám bệnh',
      category: 'Khám bệnh'
    });
    
    return servicesWithPrices;
  }
});

/**
 * Query: patient_medical_history
 * Returns medical history for a specific patient (doctors only)
 * Note: This query requires additional filtering in the AI prompt to specify patient
 * Roles: Doctor (2)
 */
QUERY_WHITELIST.set('patient_medical_history', {
  id: 'patient_medical_history',
  description: 'Get medical examination history for patients (doctors can access their assigned patients)',
  requiredRoles: [ROLES.DOCTOR],
  handler: async (userId, userRole) => {
    // Get recent examinations where this doctor was assigned
    const examinations = await db.MedicalExamination.findAll({
      where: {
        DoctorID: userId
      },
      include: [
        {
          model: db.Patient,
          as: 'patient',
          attributes: ['id', 'fullName', 'dateOfBirth', 'gender']
        }
      ],
      order: [['ExaminationDate', 'DESC']],
      limit: 50 // Limit to recent 50 examinations by this doctor
    });
    
    return examinations;
  }
});

/**
 * Query: lab_tests_pending
 * Returns pending lab tests that need results entry
 * Roles: Doctor (2), LabTech (6)
 */
QUERY_WHITELIST.set('lab_tests_pending', {
  id: 'lab_tests_pending',
  description: 'Get pending laboratory tests that are waiting for results',
  requiredRoles: [ROLES.DOCTOR, 6], // 6 = LabTech
  handler: async (userId, userRole) => {
    // Get lab order items that don't have results yet
    const pendingTests = await db.LabOrderItem.findAll({
      where: {
        status: 0 // Pending status
      },
      include: [
        {
          model: db.LabOrder,
          as: 'labOrder',
          include: [
            {
              model: db.MedicalExamination,
              as: 'examination',
              include: [
                {
                  model: db.Patient,
                  as: 'patient',
                  attributes: ['id', 'fullName', 'phone']
                }
              ]
            }
          ]
        },
        {
          model: db.LabService,
          as: 'service',
          attributes: ['ServiceID', 'ServiceName', 'Unit']
        }
      ],
      order: [['createdAt', 'ASC']],
      limit: 50 // Limit to 50 pending tests
    });
    
    return pendingTests;
  }
});

/**
 * Query: low_stock_medicines
 * Returns medicines with low stock levels
 * Roles: Admin (1), Pharmacist (4)
 */
QUERY_WHITELIST.set('low_stock_medicines', {
  id: 'low_stock_medicines',
  description: 'Get medicines with low stock levels that need reordering',
  requiredRoles: [ROLES.ADMIN, ROLES.PHARMACIST],
  handler: async (userId, userRole) => {
    // For now, return all medicines since we don't have stock data
    // This can be enhanced later when MedicineBatch data is available
    const medicines = await db.Medicine.findAll({
      where: {
        isActive: true
      },
      attributes: ['id', 'name', 'unit', 'category', 'price'],
      order: [['name', 'ASC']],
      limit: 50
    });
    
    return medicines;
  }
});

/**
 * Query: appointment_schedule
 * Returns appointment schedule for doctors and receptionists
 * Roles: Admin (1), Doctor (2), Receptionist (3)
 */
QUERY_WHITELIST.set('appointment_schedule', {
  id: 'appointment_schedule',
  description: 'Get upcoming appointment schedule for the clinic',
  requiredRoles: [ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST],
  handler: async (userId, userRole) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // For doctors, show only their appointments
    // For admin and receptionist, show all appointments
    const whereClause = {
      appointmentDate: {
        [Op.gte]: today
      },
      status: {
        [Op.in]: [1, 2] // Scheduled or Waiting status
      }
    };
    
    // If doctor, filter by assigned doctor
    if (userRole === ROLES.DOCTOR) {
      whereClause.assignedDoctorId = userId;
    }
    
    const appointments = await db.Appointment.findAll({
      where: whereClause,
      include: [
        {
          model: db.Patient,
          as: 'patient',
          attributes: ['id', 'fullName', 'phone']
        },
        {
          model: db.User,
          as: 'assignedDoctor',
          attributes: ['id', 'fullName']
        }
      ],
      order: [['appointmentDate', 'ASC'], ['timeSlot', 'ASC']],
      limit: 50 // Limit to next 50 appointments
    });
    
    return appointments;
  }
});

/**
 * Get available queries for a specific user role
 * @param {number} userRole - The user's role ID
 * @returns {Array<Object>} Array of available query configurations
 */
export function getAvailableQueries(userRole) {
  const availableQueries = [];
  
  for (const [queryId, config] of QUERY_WHITELIST.entries()) {
    if (config.requiredRoles.includes(userRole)) {
      availableQueries.push({
        id: config.id,
        description: config.description
      });
    }
  }
  
  return availableQueries;
}

/**
 * Get a specific query configuration by ID
 * @param {string} queryId - The query identifier
 * @returns {Object|null} Query configuration or null if not found
 */
export function getQuery(queryId) {
  return QUERY_WHITELIST.get(queryId) || null;
}

/**
 * Check if a query exists in the whitelist
 * @param {string} queryId - The query identifier
 * @returns {boolean} True if query exists
 */
export function isQueryWhitelisted(queryId) {
  return QUERY_WHITELIST.has(queryId);
}

/**
 * Check if a user role has permission to execute a query
 * @param {string} queryId - The query identifier
 * @param {number} userRole - The user's role ID
 * @returns {boolean} True if user has permission
 */
export function hasQueryPermission(queryId, userRole) {
  const query = QUERY_WHITELIST.get(queryId);
  if (!query) return false;
  
  return query.requiredRoles.includes(userRole);
}

export default QUERY_WHITELIST;
