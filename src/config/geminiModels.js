/**
 * Gemini Models Configuration
 * 
 * Danh sách các model Gemini có sẵn và hoạt động, được sắp xếp theo độ ưu tiên.
 * Khi model chính lỗi, hệ thống sẽ tự động thử các model khác theo thứ tự.
 */

/**
 * Danh sách các model Gemini hoạt động, sắp xếp theo độ ưu tiên
 * Model đầu tiên sẽ được ưu tiên sử dụng
 */
export const WORKING_MODELS = [
  // Model hiện tại đang hoạt động tốt
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it',
  
  // Các model Gemini có thể hoạt động 
  'gemini-flash-latest',
  'gemini-pro-latest',
  'gemini-flash-lite-latest',
  
  // Các model Gemini 2.5 
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  
  // Các model Gemini 2.0 
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-lite-001',
  
  // Các model preview 
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
];

/**
 * Lấy model mặc định từ environment hoặc model đầu tiên trong danh sách
 */
export function getDefaultModel() {
  return process.env.GEMINI_MODEL || WORKING_MODELS[0];
}

/**
 * Lấy danh sách các model fallback (loại bỏ model hiện tại)
 */
export function getFallbackModels(currentModel) {
  return WORKING_MODELS.filter(model => model !== currentModel);
}

/**
 * Kiểm tra xem model có trong danh sách hoạt động không
 */
export function isModelSupported(modelName) {
  return WORKING_MODELS.includes(modelName);
}

/**
 * Lấy model tiếp theo để thử khi model hiện tại lỗi
 */
export function getNextModel(currentModel) {
  const currentIndex = WORKING_MODELS.indexOf(currentModel);
  if (currentIndex === -1 || currentIndex === WORKING_MODELS.length - 1) {
    return null; // Không có model tiếp theo
  }
  return WORKING_MODELS[currentIndex + 1];
}

export default {
  WORKING_MODELS,
  getDefaultModel,
  getFallbackModels,
  isModelSupported,
  getNextModel,
};