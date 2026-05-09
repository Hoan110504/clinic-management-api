import geminiService from './gemini.service.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';

class PatientSafetyService {
  /**
   * Check prescription safety using AI
   * Evaluates potential drug interactions, contraindications, and allergies
   * based on the patient's medical history and the prescribed medicines.
   *
   * @param {Object} patient - Patient data containing medicalHistory, allergies, age, etc.
   * @param {Array} medicines - List of medicines being prescribed { medicineName, dosage, quantity, instructions }
   * @param {Array} existingMedicines - List of medicines the patient is currently taking
   * @returns {Promise<Object>} - The safety report object
   */
  async checkPrescriptionSafety(patient, medicines, existingMedicines = []) {
    if (!medicines || medicines.length === 0) {
      return {
        safe: true,
        warnings: [],
        message: 'Không có thuốc nào để kiểm tra.',
      };
    }

    // Prepare patient context
    const patientContext = `
Thông tin bệnh nhân:
- Tiền sử bệnh: ${patient.medicalHistory || 'Không rõ'}
- Dị ứng: ${patient.allergies || 'Không rõ'}
- Độ tuổi: ${patient.age ? patient.age + ' tuổi' : 'Không rõ'}
- Giới tính: ${patient.gender || 'Nam/Nữ'}
- Chẩn đoán hiện tại: ${patient.currentDiagnosis || 'Không rõ'}
    `.trim();

    // Prepare medicines lists
    const newMedicinesList = medicines
      .map((m, index) => `${index + 1}. ${m.medicineName} (Liều: ${m.dosage}, Cách dùng: ${m.instructions})`)
      .join('\n');

    const existingMedicinesList = existingMedicines.length > 0
      ? existingMedicines.map((m, index) => `${index + 1}. ${m.medicineName} (Liều: ${m.dosage}, Cách dùng: ${m.instructions})`).join('\n')
      : 'Không có thông tin hoặc không đang dùng thuốc nào.';

    const prompt = `Hệ thống kiểm tra an toàn thuốc (AI Clinical Pharmacist).
NHIỆM VỤ: Phân tích đơn thuốc và trả về kết quả định dạng JSON duy nhất.
CẤM: Không chào hỏi, không giải thích ngoài lề, không thêm văn bản trước hoặc sau JSON.

${patientContext}

--- CÁC THUỐC BỆNH NHÂN ĐANG DÙNG (Từ các đơn thuốc cũ): ---
${existingMedicinesList}

--- ĐƠN THUỐC MỚI ĐANG KÊ: ---
${newMedicinesList}

Yêu cầu phân tích:
1. Tương tác trong ĐƠN THUỐC MỚI.
2. Tương tác với CÁC THUỐC ĐANG DÙNG.
3. Chống chỉ định (Tiền sử & Dị ứng).
4. Phù hợp chẩn đoán.

TRẢ VỀ ĐỊNH DẠNG JSON SAU (VÀ CHỈ JSON):
{
  "safe": true/false,
  "warnings": [
    {
      "level": "high|medium|low",
      "issue": "Mô tả vấn đề",
      "recommendation": "Khuyến nghị"
    }
  ],
  "message": "Đánh giá tổng quan"
}`;

    const apiCall = async () => {
      // Use specific model settings for JSON generation
      const model = geminiService.createModel({
        generationConfig: {
          temperature: 0.1, // Lower for more deterministic output
        }
      });
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    };

    try {
      const responseText = await geminiService.executeWithRetry(apiCall, 'check_prescription_safety');
      
      // Better JSON extraction logic
      let jsonText = responseText.trim();
      
      // 1. Try to extract from markdown blocks
      const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        // 2. Try to find the first '{' and last '}'
        const firstBrace = jsonText.indexOf('{');
        const lastBrace = jsonText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonText = jsonText.substring(firstBrace, lastBrace + 1);
        }
      }

      try {
        const report = JSON.parse(jsonText);
        // Validate required fields
        if (typeof report.safe !== 'boolean') report.safe = false;
        if (!Array.isArray(report.warnings)) report.warnings = [];
        return report;
      } catch (parseError) {
        logger.error('JSON Parse Error in AI Check. Raw response:', responseText);
        // Fallback response instead of 500 error
        return {
          safe: false,
          warnings: [{
            level: 'medium',
            issue: 'Lỗi định dạng dữ liệu từ AI',
            recommendation: 'Bác sĩ vui lòng tự kiểm tra lại tương tác thuốc thủ công.'
          }],
          message: 'Hệ thống AI gặp sự cố khi định dạng kết quả. Vui lòng kiểm tra lại đơn thuốc.'
        };
      }
    } catch (error) {
      logger.error('Error in AI Prescription Safety Check:', error);
      throw new AppError('Lỗi khi kiểm tra an toàn thuốc qua AI. Vui lòng thử lại sau.', 500, 'AI_SAFETY_CHECK_ERROR');
    }
  }
}

export default new PatientSafetyService();
