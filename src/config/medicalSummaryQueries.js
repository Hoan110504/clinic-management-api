/**
 * Medical Summary Pre-Defined Queries
 * Whitelist of read-only queries for AI medical record summarization
 * 
 * Security: All queries use parameterized statements with patientId only
 * Access Control: Role-based filtering ensures doctors only access authorized patient data
 */

import { Op, QueryTypes } from 'sequelize';
import { ROLES } from './constants.js';
import { sequelize } from '../models/database.js';
import models from '../models/index.js';

const { Patient, MedicalExamination, Prescription, PrescriptionItem, Medicine, LabResult, LabService } = models;

/**
 * Medical Summary Query Whitelist
 * Each query includes: id, description, allowedRoles, handler function
 */
const MEDICAL_SUMMARY_QUERIES = [
  {
    id: 'getPatientBasicInfo',
    description: 'Get patient basic information',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const patient = await Patient.findOne({
        where: { id: patientId },
        attributes: [
          'fullName',
          'dateOfBirth',
          'gender',
          'phone',
          'address',
          'insuranceNumber',
          'allergies',
          'emergencyContact',
          'emergencyPhone',
        ],
      });
      return patient ? patient.toJSON() : null;
    },
  },

  {
    id: 'getMedicalHistory',
    description: 'Get patient medical history (last 10 examinations)',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const examinations = await MedicalExamination.findAll({
        where: { PatientId: patientId },
        attributes: [
          'ExaminationDate',
          'Symptoms',
          'Diagnosis',
          'ICD10Code',
          'TreatmentAdvice',
        ],
        order: [['ExaminationDate', 'DESC']],
        limit: 10,
      });
      return examinations.map((exam) => exam.toJSON());
    },
  },

  {
    id: 'getChronicDiseases',
    description: 'Get chronic or recurring diagnoses',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      // Query for diagnoses that appear 2+ times
      const results = await sequelize.query(
        `
        SELECT Diagnosis, ICD10Code, COUNT(*) as OccurrenceCount
        FROM MedicalExaminations
        WHERE PatientId = :patientId 
          AND Diagnosis IS NOT NULL
        GROUP BY Diagnosis, ICD10Code
        HAVING COUNT(*) >= 2
        ORDER BY OccurrenceCount DESC
        `,
        {
          replacements: { patientId },
          type: QueryTypes.SELECT,
        }
      );
      return results;
    },
  },

  {
    id: 'getAllergies',
    description: 'Get patient allergies',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const patient = await Patient.findOne({
        where: { id: patientId },
        attributes: ['allergies'],
      });
      
      const allergies = patient?.allergies;
      return allergies && allergies.trim() !== '' 
        ? allergies 
        : 'Không có dị ứng ghi nhận';
    },
  },

  {
    id: 'getRecentLabTests',
    description: 'Get lab test results from last 6 months',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Get lab results for this patient from last 6 months
      const labResults = await LabResult.findAll({
        include: [
          {
            model: MedicalExamination,
            as: 'Examination',
            where: { PatientId: patientId },
            attributes: [],
          },
          {
            model: LabService,
            as: 'Service',
            attributes: ['serviceName'],
          },
        ],
        where: {
          resultDate: { [Op.gte]: sixMonthsAgo },
        },
        attributes: ['resultText', 'conclusion', 'resultDate'],
        order: [['resultDate', 'DESC']],
      });

      return labResults.map((result) => ({
        testName: result.Service?.serviceName || 'N/A',
        result: result.resultText,
        conclusion: result.conclusion,
        testDate: result.resultDate,
      }));
    },
  },

  {
    id: 'getCurrentMedications',
    description: 'Get active prescriptions',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      // Get recent prescriptions for this patient (status 0 = waiting, 1 = dispensed)
      const prescriptions = await Prescription.findAll({
        include: [
          {
            model: MedicalExamination,
            as: 'examination',
            where: { PatientId: patientId },
            attributes: [],
          },
          {
            model: PrescriptionItem,
            as: 'prescriptionItems',
            include: [
              {
                model: Medicine,
                as: 'medicine',
                attributes: ['name', 'unit'],
              },
            ],
            attributes: ['dosage', 'frequency', 'duration', 'quantityPrescribed'],
          },
        ],
        where: {
          status: { [Op.in]: [0, 1] }, // Active prescriptions
        },
        attributes: ['prescriptionDate'],
        order: [['prescriptionDate', 'DESC']],
        limit: 5,
      });

      const medications = [];
      prescriptions.forEach((prescription) => {
        prescription.prescriptionItems?.forEach((item) => {
          medications.push({
            medicineName: item.medicine?.name || 'N/A',
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            startDate: prescription.prescriptionDate,
          });
        });
      });

      return medications;
    },
  },

  {
    id: 'getPreviousDiagnoses',
    description: 'Get all unique diagnoses',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const diagnoses = await sequelize.query(
        `
        SELECT DISTINCT Diagnosis, ICD10Code
        FROM MedicalExaminations
        WHERE PatientId = :patientId
          AND Diagnosis IS NOT NULL
        ORDER BY Diagnosis
        `,
        {
          replacements: { patientId },
          type: QueryTypes.SELECT,
        }
      );
      return diagnoses;
    },
  },

  {
    id: 'getVitalSignsHistory',
    description: 'Get vital signs from last 5 examinations',
    allowedRoles: [ROLES.DOCTOR],
    handler: async (userId, userRole, patientId) => {
      const examinations = await MedicalExamination.findAll({
        where: { PatientId: patientId },
        attributes: [
          'ExaminationDate',
          'BloodPressure',
          'Pulse',
          'Temperature',
          'SpO2',
          'Weight',
          'Height',
          'BMI',
        ],
        order: [['ExaminationDate', 'DESC']],
        limit: 5,
      });
      return examinations.map((exam) => exam.toJSON());
    },
  },
];

/**
 * Get query by ID
 * @param {string} queryId - Query identifier
 * @returns {Object|null} Query definition or null if not found
 */
export const getQueryById = (queryId) => {
  return MEDICAL_SUMMARY_QUERIES.find((q) => q.id === queryId) || null;
};

/**
 * Validate query ID exists in whitelist
 * @param {string} queryId - Query identifier
 * @returns {boolean} True if query exists
 */
export const isValidQueryId = (queryId) => {
  return MEDICAL_SUMMARY_QUERIES.some((q) => q.id === queryId);
};

/**
 * Get all query IDs
 * @returns {string[]} Array of query IDs
 */
export const getAllQueryIds = () => {
  return MEDICAL_SUMMARY_QUERIES.map((q) => q.id);
};

/**
 * Execute a single query by ID
 * @param {string} queryId - Query identifier
 * @param {number} userId - User ID (doctor)
 * @param {number} userRole - User role
 * @param {number} patientId - Patient ID
 * @returns {Promise<Object>} Query result
 * @throws {Error} If query not found or role not allowed
 */
export const executeQuery = async (queryId, userId, userRole, patientId) => {
  const query = getQueryById(queryId);
  
  if (!query) {
    throw new Error(`Query not found: ${queryId}`);
  }
  
  if (!query.allowedRoles.includes(userRole)) {
    throw new Error(`Role ${userRole} not allowed for query: ${queryId}`);
  }
  
  return await query.handler(userId, userRole, patientId);
};

export default MEDICAL_SUMMARY_QUERIES;
