/**
 * AI Controller
 * 
 * Handles AI Medical Chatbot endpoints with two-pass flow orchestration.
 * 
 * Two-Pass Flow:
 * 1. Pass 1: Query Selection - AI selects relevant query_ids from whitelist
 * 2. Query Execution - Execute selected queries with role-based filtering
 * 3. Pass 2: Answer Synthesis - AI generates natural language response
 * 
 */

import geminiService from '../services/gemini.service.js';
import queryHandler from '../services/queryHandler.service.js';
import conversationManager from '../services/conversationManager.js';
import chatLogger from '../services/chatLogger.service.js';
import metricsService from '../services/metrics.service.js';
import medicalSummaryService from '../services/medicalSummary.service.js';
import { getAvailableQueries } from '../config/queryWhitelist.js';
import { getRateLimitStatus } from '../middleware/aiRateLimiter.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import aiLogger, { logRequest, logError as logAiError } from '../utils/aiLogger.js';
import models, { Sequelize } from '../models/index.js';
import patientSafetyService from '../services/patientSafetyService.js';

const { MedicalExamination } = models;

/**
 * Request timeout in milliseconds (30 seconds)
 */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Create a timeout promise that rejects after specified milliseconds
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects with timeout error
 */
function createRequestTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(
        'Request timeout. Please try again.',
        408,
        'REQUEST_TIMEOUT'
      ));
    }, ms);
  });
}

export const chat = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Bọc toàn bộ logic xử lý với timeout
    await Promise.race([
      chatHandler(req, res, next, startTime),
      createRequestTimeout(REQUEST_TIMEOUT_MS)
    ]);
  } catch (error) {
    // Xử lý lỗi
    const responseTimeMs = Date.now() - startTime;
    const errorType = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Unknown error occurred';
    const stackTrace = error.stack || '';
    
    // ghi log lỗi có cấu trúc
    logAiError({
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace,
      user_id: req.user?.id,
      ip_address: req.ip || req.connection.remoteAddress || 'unknown',
      user_message: req.body?.message || '',
    });
    
    // Ghi nhận các chỉ số thống kê về lỗi
    metricsService.recordRequest({
      response_time_ms: responseTimeMs,
      is_error: true,
      is_rate_limited: error.statusCode === 429,
      user_id: req.user?.id,
    });
    
    try {
      await chatLogger.logError({
        userId: req.user?.id,
        userRole: req.user?.role,
        userMessage: req.body?.message || '',
        errorMessage,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        sessionId: `session_${req.user?.id}`,
        responseTimeMs,
      });
    } catch (logError) {
      logger.error('Failed to log error', {
        error: logError.message,
      });
    }
    
    next(error);
  }
};

/**
 * Internal chat handler function (separated for timeout wrapping)
 * @private
 */
async function chatHandler(req, res, next, startTime) {
  const { message } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const sessionId = `session_${userId}`;
  
  //Kiểm tra tính hợp lệ của message
  if (!message || typeof message !== 'string') {
    throw new AppError('Message field is required and must be a string', 400, 'INVALID_INPUT');
  }
  
  // Lấy lịch sử hội thoại hiện tại của người dùng
  const conversationHistory = conversationManager.getHistory(userId);
  
  // Thêm tin nhắn của người dùng vào lịch sử hội thoại
  conversationManager.appendMessage(userId, 'user', message);
  
  // Lấy danh sách các truy vấn có sẵn dựa trên vai trò
  const availableQueries = getAvailableQueries(userRole);
  
  logger.info('AI chat request started', {
    userId,
    userRole,
    messageLength: message.length,
    availableQueriesCount: availableQueries.length,
  });
  
  // ========================================================================
  // Xác định các truy vấn liên quan
  // ========================================================================
  
  let selectedQueryIds = [];
  try {
    selectedQueryIds = await geminiService.selectQueries(
      message,
      availableQueries,
      conversationHistory
    );
    
    logger.info('Pass 1 completed', {
      userId,
      selectedQueryIds,
      queryCount: selectedQueryIds.length,
    });
  } catch (error) {
    logger.error('Pass 1 failed', {
      userId,
      error: error.message,
    });
    
    // If Pass 1 fails, continue with empty query results
    // The AI can still respond based on general knowledge
    selectedQueryIds = [];
  }
  
  // ========================================================================
  // Thực thi các truy vấn đã chọn
  // ========================================================================
  
  let queryResults = [];
  if (selectedQueryIds.length > 0) {
    try {
      queryResults = await queryHandler.executeMultipleQueries(
        selectedQueryIds,
        userId,
        userRole
      );
      
      logger.info('Query execution completed', {
        userId,
        queryCount: queryResults.length,
        successCount: queryResults.filter(r => !r.error).length,
      });
    } catch (error) {
      logger.error('Query execution failed', {
        userId,
        error: error.message,
      });
      
      // Continue with empty results if query execution fails
      queryResults = [];
    }
  }
  
  // ========================================================================
  // PASS 2: AI tổng hợp câu trả lời
  // ========================================================================
  
  let aiResponse;
  try {
    // Format query results for Pass 2
    const formattedResults = queryResults.map(result => ({
      queryId: result.query_id,
      data: result.data,
      metadata: {
        rowCount: result.row_count,
        executionTimeMs: result.execution_time_ms,
      },
    }));
    
    aiResponse = await geminiService.synthesizeAnswer(
      message,
      formattedResults,
      conversationHistory
    );
    
    logger.info('Pass 2 completed', {
      userId,
      responseLength: aiResponse.length,
    });
  } catch (error) {
    logger.error('Pass 2 failed', {
      userId,
      error: error.message,
    });
    
    throw new AppError(
      'AI service error. Please try again.',
      500,
      'AI_SERVICE_ERROR'
    );
  }
  
  // Lưu lịch sử hội thoại
  conversationManager.appendMessage(userId, 'model', aiResponse);
  
  // Tính thời gian phản hồi
  const responseTimeMs = Date.now() - startTime;
  
  // ========================================================================
  // Ghi log và ghi nhận các chỉ số thống kê
  // ========================================================================
  
  logRequest({
    user_id: userId,
    user_role: userRole,
    message_length: message.length,
    response_time_ms: responseTimeMs,
    ip_address: ipAddress,
    query_ids: selectedQueryIds,
  });
  
  metricsService.recordRequest({
    response_time_ms: responseTimeMs,
    is_error: false,
    is_rate_limited: false,
    user_id: userId,
  });
  
  // ========================================================================
  // Ghi lại trò chuyện chatbot
  // ========================================================================
  
  try {
    await chatLogger.logInteraction({
      userId,
      userRole,
      userMessage: message,
      aiResponse,
      selectedQueryIds,
      ipAddress,
      sessionId,
      responseTimeMs,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to log chat interaction', {
      userId,
      error: error.message,
    });
  }
  
  // ========================================================================
  // Trả phản hồi thành công và giới hạn còn lại
  // ========================================================================
  
  const remainingRequests = req.rateLimitInfo?.userRemaining ?? 0;
  
  res.status(200).json({
    success: true,
    data: {
      response: aiResponse,
      queryIds: selectedQueryIds,
      remainingRequests,
    },
  });
}

/**
 * GET /api/ai/history
 * 
 * Retrieve conversation history for the authenticated user.
 * Returns the last 10 messages from the current session.
 * 
 */
export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get conversation history from manager
    const messages = conversationManager.getHistory(userId);
    
    logger.info('History retrieved', {
      userId,
      messageCount: messages.length,
    });
    
    res.status(200).json({
      success: true,
      data: {
        messages,
        count: messages.length,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/rate-status
 * 
 * Check current rate limit status for the authenticated user.
 * Returns user and IP rate limit information.

 */
export const getRateStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Get rate limit status from middleware
    const rateLimitStatus = getRateLimitStatus(userId, ipAddress);
    
    logger.info('Rate status retrieved', {
      userId,
      userRemaining: rateLimitStatus.userRemaining,
      ipRemaining: rateLimitStatus.ipRemaining,
    });
    
    res.status(200).json({
      success: true,
      data: rateLimitStatus,
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ai/history
 * 
 * Clear conversation history for the authenticated user.
 * Removes all messages from the current session.
 * 
 */
export const clearHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Clear conversation history
    const cleared = conversationManager.clearHistory(userId);
    
    logger.info('History cleared', {
      userId,
      cleared,
    });
    
    res.status(200).json({
      success: true,
      data: {
        message: 'Conversation history cleared',
        cleared,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/metrics
 * 
 * Get AI chatbot usage metrics (Admin only).
 * Thống kê chatbot cho qtv
 * 
 */
export const getMetrics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify admin role (role = 1)
    if (userRole !== 1) {
      throw new AppError(
        'Insufficient permissions. Admin access required.',
        403,
        'FORBIDDEN'
      );
    }
    
    // Get combined metrics (current session + last 24 hours)
    const metrics = await metricsService.getCombinedMetrics();
    
    logger.info('Metrics retrieved', {
      userId,
      timestamp: metrics.timestamp,
    });
    
    res.status(200).json({
      success: true,
      data: metrics,
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/ai/summarize-medical-record
 * 
 * Generate AI summary for a medical record.
 * Only accessible by doctors (role = 2).
 * 
 */
export const summarizeMedicalRecord = async (req, res, next) => {
  try {
    const { medicalRecordId, patientId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify user role is doctor (role === 2)
    if (userRole !== 2) {
      throw new AppError(
        'Chỉ bác sĩ mới có quyền sử dụng tính năng này',
        403,
        'FORBIDDEN'
      );
    }
    
    const examination = await MedicalExamination.findOne({
      where: { ExaminationID: medicalRecordId },
    });
    
    if (!examination) {
      throw new AppError(
        'Không tìm thấy phiếu khám',
        404,
        'RECORD_NOT_FOUND'
      );
    }
    
    if (examination.PatientId !== patientId) {
      throw new AppError(
        'Phiếu khám không thuộc về bệnh nhân này',
        404,
        'RECORD_NOT_FOUND'
      );
    }
    
    // Generate summary using medical summary service
    const result = await medicalSummaryService.generateSummary(
      medicalRecordId,
      patientId,
      userId,
      userRole
    );
    
    // Get remaining requests from rate limiter middleware
    const remainingRequests = req.rateLimitInfo?.perPatientRemaining ?? 0;
    
    // Return success response
    res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        queryIds: result.queryIds,
        generatedAt: result.generatedAt,
        remainingRequests,
        cached: result.cached || false,
      },
    });
    
  } catch (error) {
    // Map service errors to HTTP status codes
    if (error instanceof AppError) {
      next(error);
    } else {
      // Unexpected error
      logger.error('Unexpected error in summarizeMedicalRecord', {
        error: error.message,
        stack: error.stack,
      });
      
      next(new AppError(
        'Không thể tạo tóm tắt bệnh án',
        500,
        'INTERNAL_SERVER_ERROR'
      ));
    }
  }
};

/**
 * POST /api/ai/check-prescription
 * 
 * Check prescription safety using AI.
 * Takes patient information and a list of medicines to check for interactions.
 * Accessible by doctors (role = 2).
 */
export const checkPrescriptionSafety = async (req, res, next) => {
  try {
    const { patientId, medicines, currentDiagnosis } = req.body;
    const userRole = req.user.role;
    
    if (userRole !== 2) {
      throw new AppError(
        'Chỉ bác sĩ mới có quyền sử dụng tính năng này',
        403,
        'FORBIDDEN'
      );
    }
    
    if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
      throw new AppError('Danh sách thuốc không được để trống', 400, 'INVALID_INPUT');
    }

    // Fetch patient data for medical history and allergies
    const patientRecord = await models.Patient.findByPk(patientId);
    let patientData = { currentDiagnosis };
    
    if (patientRecord) {
      // Calculate age
      let age = null;
      if (patientRecord.dateOfBirth) {
        const diffMs = Date.now() - new Date(patientRecord.dateOfBirth).getTime();
        const ageDt = new Date(diffMs); 
        age = Math.abs(ageDt.getUTCFullYear() - 1970);
      }

      patientData = {
        ...patientData,
        medicalHistory: patientRecord.medicalHistory,
        allergies: patientRecord.allergies,
        age,
        gender: patientRecord.gender === 'M' ? 'Nam' : (patientRecord.gender === 'F' ? 'Nữ' : null)
      };
    }

    // truy vấn ds đơn thuốc trong vòng 30 ngày
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const existingPrescriptions = await models.Prescription.findAll({
      where: {
        Status: { [Sequelize.Op.in]: [0, 1] },
        PrescriptionDate: { [Sequelize.Op.gte]: thirtyDaysAgo }
      },
      include: [
        {
          model: models.MedicalExamination,
          as: 'examination',
          where: { PatientId: patientId },
          required: true
        },
        {
          model: models.PrescriptionItem,
          as: 'prescriptionItems',
          include: [{ model: models.Medicine, as: 'medicine' }]
        }
      ]
    });

    const existingMedicines = [];
    existingPrescriptions.forEach(p => {
      if (p.prescriptionItems) {
        p.prescriptionItems.forEach(item => {
          existingMedicines.push({
            medicineName: item.medicine?.name || 'Không rõ',
            dosage: item.dosage,
            instructions: item.instructions
          });
        });
      }
    });

    // gọi hàm trong service kiểm tra an toàn đơn thuốc
    const safetyReport = await patientSafetyService.checkPrescriptionSafety(patientData, medicines, existingMedicines);

    res.status(200).json({
      success: true,
      data: safetyReport
    });
    
  } catch (error) {
    next(error);
  }
};

export default {
  chat,
  getHistory,
  getRateStatus,
  clearHistory,
  getMetrics,
  summarizeMedicalRecord,
  checkPrescriptionSafety,
};
