/**
 * gesture-worker.js — Off-Thread MediaPipe HandLandmarker Web Worker
 *
 * Runs MediaPipe HandLandmarker inference in a dedicated Web Worker thread
 * so that CPU/GPU ML inference never blocks the browser main thread
 * or p5.js canvas rendering.
 *
 * Communication:
 *   Main -> Worker:
 *     { type: 'INIT', options }
 *     { type: 'PROCESS_FRAME', bitmap, timestamp } (bitmap transferred zero-copy)
 *     { type: 'CLOSE' }
 *   Worker -> Main:
 *     { type: 'INIT_OK' }
 *     { type: 'INIT_ERROR', message }
 *     { type: 'RESULT', landmarks, timestamp }
 *     { type: 'RESULT_ERROR', message }
 */

const VISION_BUNDLE_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_ROOT_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let handLandmarker = null;

self.onmessage = async (e) => {
  const data = e.data;
  if (!data || !data.type) return;

  switch (data.type) {
    case 'INIT': {
      try {
        const mod = await import(VISION_BUNDLE_URL);
        const { HandLandmarker, FilesetResolver } = mod;

        const wasmFileset = await FilesetResolver.forVisionTasks(WASM_ROOT_URL);

        const config = data.options || {};
        const maxHands = config.maxHands || 1;
        const detectionConfidence = config.detectionConfidence || 0.6;
        const trackingConfidence = config.trackingConfidence || 0.6;

        try {
          handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'GPU',
            },
            runningMode: 'IMAGE',
            numHands: maxHands,
            minHandDetectionConfidence: detectionConfidence,
            minHandPresenceConfidence: trackingConfidence,
            minTrackingConfidence: trackingConfidence,
          });
        } catch (gpuErr) {
          // Fallback to CPU delegate if GPU is unsupported in worker
          handLandmarker = await HandLandmarker.createFromOptions(wasmFileset, {
            baseOptions: {
              modelAssetPath: MODEL_URL,
              delegate: 'CPU',
            },
            runningMode: 'IMAGE',
            numHands: maxHands,
            minHandDetectionConfidence: detectionConfidence,
            minHandPresenceConfidence: trackingConfidence,
            minTrackingConfidence: trackingConfidence,
          });
        }

        self.postMessage({ type: 'INIT_OK' });
      } catch (err) {
        self.postMessage({
          type: 'INIT_ERROR',
          message: err ? (err.message || String(err)) : 'Unknown worker init failure',
        });
      }
      break;
    }

    case 'PROCESS_FRAME': {
      const bitmap = data.bitmap;
      const timestamp = data.timestamp;

      if (!handLandmarker || !bitmap) {
        if (bitmap && typeof bitmap.close === 'function') {
          bitmap.close();
        }
        return;
      }

      try {
        const result = handLandmarker.detect(bitmap);
        if (bitmap && typeof bitmap.close === 'function') {
          bitmap.close();
        }

        self.postMessage({
          type: 'RESULT',
          landmarks: result ? (result.landmarks || []) : [],
          timestamp: timestamp,
        });
      } catch (err) {
        if (bitmap && typeof bitmap.close === 'function') {
          bitmap.close();
        }
        self.postMessage({
          type: 'RESULT_ERROR',
          message: err ? (err.message || String(err)) : 'Detection error',
          timestamp: timestamp,
        });
      }
      break;
    }

    case 'CLOSE': {
      if (handLandmarker && typeof handLandmarker.close === 'function') {
        try {
          handLandmarker.close();
        } catch (_) {}
        handLandmarker = null;
      }
      break;
    }

    default:
      break;
  }
};
