import fs from 'fs';
import logger from '../utils/logger.js';

let initialized = false;
let adminInstance = null;

const loadFirebaseAdmin = async () => {
  if (adminInstance) return adminInstance;

  try {
    const firebaseAdminModule = await import('firebase-admin');
    adminInstance = firebaseAdminModule.default ?? firebaseAdminModule;
    return adminInstance;
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      logger.warn('Firebase Admin package is not installed; Firebase auth features are disabled');
      return null;
    }

    throw err;
  }
};

const initFirebaseAdmin = async () => {
  const admin = await loadFirebaseAdmin();
  if (!admin) return null;

  if (initialized) return admin;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT; // raw JSON string
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH; // path to JSON file

  let credential = null;
  try {
    if (serviceAccountJson) {
      const parsed = JSON.parse(serviceAccountJson);
      credential = admin.credential.cert(parsed);
    } else if (serviceAccountPath) {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      const parsed = JSON.parse(raw);
      credential = admin.credential.cert(parsed);
    } else {
      logger.warn('Firebase Admin not configured: set FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH');
      return null;
    }

    admin.initializeApp({ credential });
    initialized = true;
    return admin;
  } catch (err) {
    logger.error('Failed to initialize Firebase Admin', { error: err?.message });
    throw err;
  }
};

export const verifyIdToken = async (idToken) => {
  const app = await initFirebaseAdmin();
  if (!app) throw new Error('Firebase Admin not configured');
  return app.auth().verifyIdToken(idToken);
};

export default {
  verifyIdToken,
};
