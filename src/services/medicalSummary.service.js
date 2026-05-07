/**
 * Medical Summary Service
 * 
 * Orchestrates the medical record summarization process using Google Gemini AI.
 * Implements a secure, read-only architecture with pre-defined queries.
 * 
 * Requirements: 5.1-5.7, 6.1-6.6, 11.1-11.4, 12.1-12.6, 13.1-13.6
 */

import geminiService from './gemini.service.js';
import chatLogger from './chatLogger.service.js';
import models from '../models/index.js';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';
import { executeQuery, getAllQueryIds } from '../config/medicalSummaryQueries.js';

const { MedicalExamination } = models;

/**
 * System prompt for medical record summarization
 * Instructs AI to act as an experienced internal medicine doctor
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
const MEDICAL_SUMMARY_SYSTEM_PROMPT = `Bạn là một bác sĩ nội khoa giàu kinh nghiệm và là chuyên gia tư vấn y khoa chuyên nghiệp.

NHIỆM VỤ CỦA BẠN:
Tóm tắt hồ sơ bệnh án của bệnh nhân thành 3-5 dòng ngắn gọn, chuyên nghiệp để hỗ trợ bác sĩ trước khi khám bệnh.

CẤU TRÚC TÓM TẮT:
1. Tiền sử bệnh (Medical History): Các bệnh lý đã có, bệnh mãn tính
2. Bệnh lý hiện tại (Current Conditions): Tình trạng sức khỏe hiện tại, triệu chứng gần đây
3. Điểm cần lưu ý (Important Notes): Dị ứng, thuốc đang dùng, dấu hiệu nguy hiểm

QUY TẮC BẮT BUỘC:
1. Sử dụng ngôn ngữ y khoa chuyên nghiệp bằng tiếng Việt
2. Chỉ tóm tắt dữ liệu có sẵn, KHÔNG đưa ra chẩn đoán mới
3. KHÔNG đưa ra khuyến nghị điều trị
4. Nhấn mạnh các dấu hiệu nguy hiểm nếu có (tăng huyết áp nặng, đường huyết cao, suy tim, ...)
5. Giữ tông giọng thận trọng, khách quan, chuyên nghiệp
6. Nếu không đủ dữ liệu: trả về "Không đủ dữ liệu để tóm tắt"

VÍ DỤ TÓM TẮT TỐT:
"Tiền sử: Bệnh nhân có tiền sử tăng huyết áp 5 năm, đái tháo đường type 2 được 3 năm. 
Bệnh lý hiện tại: Huyết áp dao động 150-160/90-100 mmHg, đường huyết lúc đói 8-9 mmol/L. 
Điểm cần lưu ý: Dị ứng Penicillin, đang dùng Metformin 500mg x2/ngày và Amlodipine 5mg x1/ngày. 
Cần theo dõi chức năng thận do HbA1c tăng 8.2%."

Hãy tóm tắt dựa trên dữ liệu bệnh án được cung cấp.`;

/**
 * Retry configuration for Gemini API calls
 * Requirements: 12.1, 12.4
 */
const RETRY_CONFIG = {
  MAX_ATTEMPTS: 3,
  DELAYS_MS: [2000, 4000, 8000], // Exponential backoff: 2s, 4s, 8s
};

/**
 * Timeout for AI processing
 * Requirements: 5.7, 12.4
 */
const AI_TIMEOUT_MS = config.ai.summary.timeout || 30000; // 30 seconds

/**
 * Cache TTL for summaries
 * Requirements: 13.4
 */
const CACHE_TTL_MS = config.ai.summary.cacheTTL || 3600000; // 1 hour

class MedicalSummaryService {
  /**
   * Generate AI summary for a medical record
   * 
   * @param {number} medicalRecordId - Medical examination ID
   * @param {number} patientId - Patient ID
   * @param {number} userId - Doctor's user ID
   * @param {number} userRole - Doctor's role (must be 2)
   * @returns {Promise<Object>} Summary data with metadata
   * @throws {AppError} If generation fails
   * 
   * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 11.1, 11.3, 8.1, 8.2
   */
  async generateSummary(medicalRecordId, patientId, userId, userRole) {
    const startTime = Date.now();
    
    try {
      // Step 1: Check for cached summary
      // Requirements: 13.4
      const cachedSummary = await this.getCachedSummary(medicalRecordId);
      if (cachedSummary) {
        return {
          summary: cachedSummary.summary,
          queryIds: getAllQueryIds(),
          generatedAt: cachedSummary.generatedAt,
          cached: true,
        };
      }

      // Step 2: Execute all pre-defined queries in parallel
      // Requirements: 3.2, 3.3, 5.1, 13.3
      const queryResults = await this.executeAllQueries(patientId, userId, userRole);

      // Step 3: Format query results for AI consumption
      // Requirements: 5.2
      const formattedData = this.formatQueryResultsForAI(queryResults);

      // Step 4: Call Gemini API with retry logic
      // Requirements: 5.3, 5.4, 5.5, 5.6, 12.1, 12.4
      const summary = await this.callGeminiWithRetry(formattedData);

      // Step 5: Save summary to database
      // Requirements: 11.1, 11.3
      const generatedAt = new Date();
      await MedicalExamination.update(
        {
          AiSummary: summary,
          AiSummaryGeneratedAt: generatedAt,
        },
        {
          where: { ExaminationID: medicalRecordId },
        }
      );

      // Step 6: Log interaction to audit trail
      // Requirements: 8.1, 8.2
      const responseTimeMs = Date.now() - startTime;
      await chatLogger.logInteraction({
        userId,
        userRole,
        userMessage: `Medical summary for patient ${patientId}, record ${medicalRecordId}`,
        aiResponse: summary,
        selectedQueryIds: getAllQueryIds(),
        responseTimeMs,
      });

      // Step 7: Return summary with metadata
      // Requirements: 5.7
      return {
        summary,
        queryIds: getAllQueryIds(),
        generatedAt: generatedAt.toISOString(),
        cached: false,
      };
    } catch (error) {
      // Log error
      const responseTimeMs = Date.now() - startTime;
      await chatLogger.logError({
        userId,
        userRole,
        userMessage: `Medical summary for patient ${patientId}, record ${medicalRecordId}`,
        errorMessage: error.message,
        responseTimeMs,
      });

      // Re-throw with appropriate error code
      throw this.handleError(error);
    }
  }

  /**
   * Get cached summary if exists and not expired
   * 
   * @param {number} medicalRecordId - Medical examination ID
   * @returns {Promise<Object|null>} Cached summary or null
   * 
   * Requirements: 13.4
   */
  async getCachedSummary(medicalRecordId) {
    try {
      const examination = await MedicalExamination.findOne({
        where: { ExaminationID: medicalRecordId },
        attributes: ['AiSummary', 'AiSummaryGeneratedAt'],
      });

      if (!examination || !examination.AiSummary || !examination.AiSummaryGeneratedAt) {
        return null;
      }

      // Check if cache is still fresh (within TTL)
      const generatedAt = new Date(examination.AiSummaryGeneratedAt);
      const now = new Date();
      const ageMs = now - generatedAt;

      if (ageMs > CACHE_TTL_MS) {
        // Cache expired
        return null;
      }

      // Cache is fresh
      return {
        summary: examination.AiSummary,
        generatedAt: generatedAt.toISOString(),
      };
    } catch (error) {
      console.error('Error checking cached summary:', error);
      // If cache check fails, continue with fresh generation
      return null;
    }
  }

  /**
   * Execute all pre-defined queries in parallel
   * 
   * @param {number} patientId - Patient ID
   * @param {number} userId - Doctor's user ID
   * @param {number} userRole - Doctor's role
   * @returns {Promise<Array>} Array of query results with query IDs
   * 
   * Requirements: 3.2, 3.3, 12.2, 13.3
   */
  async executeAllQueries(patientId, userId, userRole) {
    const queryIds = getAllQueryIds();
    
    // Execute all queries in parallel for performance
    // Requirements: 13.3
    const queryPromises = queryIds.map(async (queryId) => {
      try {
        const data = await executeQuery(queryId, userId, userRole, patientId);
        return {
          queryId,
          data,
          success: true,
        };
      } catch (error) {
        // Handle partial query failures gracefully
        // Requirements: 12.2
        console.error(`Query ${queryId} failed:`, error.message);
        return {
          queryId,
          data: null,
          success: false,
          error: error.message,
        };
      }
    });

    const results = await Promise.all(queryPromises);

    // Check if all queries failed
    // Requirements: 12.3
    const successfulQueries = results.filter((r) => r.success);
    if (successfulQueries.length === 0) {
      throw new AppError(
        'Không thể lấy dữ liệu bệnh án',
        500,
        'DATA_RETRIEVAL_FAILED'
      );
    }

    return results;
  }

  /**
   * Format query results for AI consumption
   * 
   * @param {Array} queryResults - Raw query results
   * @returns {string} Formatted text for Gemini
   * 
   * Requirements: 5.2
   */
  formatQueryResultsForAI(queryResults) {
    const sections = queryResults.map((result) => {
      const { queryId, data, success, error } = result;

      if (!success) {
        return `[${queryId}]: Không có dữ liệu (${error})`;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        return `[${queryId}]: Không có dữ liệu`;
      }

      // Format data based on query type
      let formattedData;
      if (typeof data === 'string') {
        formattedData = data;
      } else if (Array.isArray(data)) {
        formattedData = JSON.stringify(data, null, 2);
      } else {
        formattedData = JSON.stringify(data, null, 2);
      }

      return `[${queryId}]:\n${formattedData}`;
    });

    return `DỮ LIỆU BỆNH ÁN:\n\n${sections.join('\n\n---\n\n')}`;
  }

  /**
   * Call Gemini API with retry logic and timeout
   * 
   * @param {string} formattedData - Formatted query results
   * @returns {Promise<string>} AI-generated summary
   * @throws {AppError} If all retries fail or timeout
   * 
   * Requirements: 12.1, 12.4, 12.5
   */
  async callGeminiWithRetry(formattedData) {
    let lastError;

    for (let attempt = 0; attempt < RETRY_CONFIG.MAX_ATTEMPTS; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new AppError(
              'AI xử lý quá lâu. Vui lòng thử lại.',
              504,
              'AI_TIMEOUT'
            ));
          }, AI_TIMEOUT_MS);
        });

        // Create Gemini API call promise
        const geminiPromise = this.callGemini(formattedData);

        // Race between timeout and API call
        const summary = await Promise.race([geminiPromise, timeoutPromise]);

        return summary;
      } catch (error) {
        lastError = error;

        // Check if it's a timeout error
        if (error.code === 'AI_TIMEOUT') {
          throw error; // Don't retry on timeout
        }

        // Check if it's a rate limit or service unavailable error
        const isRetryable = 
          error.status === 429 ||
          error.status === 503 ||
          error.message?.includes('rate limit') ||
          error.message?.includes('unavailable');

        if (!isRetryable || attempt === RETRY_CONFIG.MAX_ATTEMPTS - 1) {
          // Don't retry or last attempt
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = RETRY_CONFIG.DELAYS_MS[attempt];
        console.log(`Retrying Gemini API call in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.MAX_ATTEMPTS})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    throw lastError;
  }

  /**
   * Call Gemini API to generate summary
   * 
   * @param {string} formattedData - Formatted query results
   * @returns {Promise<string>} AI-generated summary
   * @throws {Error} If API call fails
   * 
   * Requirements: 5.3, 5.4, 5.5, 5.6
   */
  async callGemini(formattedData) {
    // Create a model instance with the medical summary system prompt
    const model = geminiService.client.getGenerativeModel({
      model: geminiService.currentModel,
      systemInstruction: MEDICAL_SUMMARY_SYSTEM_PROMPT,
    });

    // Generate summary
    const result = await model.generateContent(formattedData);
    const response = result.response;
    const summary = response.text();

    // Validate summary is not empty
    if (!summary || summary.trim() === '') {
      throw new AppError(
        'AI không thể tạo tóm tắt',
        500,
        'AI_EMPTY_RESPONSE'
      );
    }

    return summary.trim();
  }

  /**
   * Handle errors and map to appropriate error codes
   * 
   * @param {Error} error - Original error
   * @returns {AppError} Mapped error
   * 
   * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
   */
  handleError(error) {
    // If already an AppError, return as-is
    if (error instanceof AppError) {
      return error;
    }

    // Map error to appropriate code
    if (error.status === 503 || error.message?.includes('unavailable')) {
      return new AppError(
        'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.',
        503,
        'AI_SERVICE_UNAVAILABLE'
      );
    }

    if (error.status === 504 || error.message?.includes('timeout')) {
      return new AppError(
        'AI xử lý quá lâu. Vui lòng thử lại.',
        504,
        'AI_TIMEOUT'
      );
    }

    // Default to generic error
    return new AppError(
      'Không thể tạo tóm tắt bệnh án',
      500,
      'SUMMARY_GENERATION_FAILED',
      { originalError: error.message }
    );
  }
}

// Export singleton instance
export default new MedicalSummaryService();
