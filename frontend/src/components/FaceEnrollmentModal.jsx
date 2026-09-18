import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const STAGES = [
  { key: 'front', label: '1/3: Look straight at the camera', minRatio: 0.7, maxRatio: 1.4 },
  { key: 'left', label: '2/3: Turn your head slightly to your LEFT', minRatio: 0.0, maxRatio: 0.65 },
  { key: 'right', label: '3/3: Turn your head slightly to your RIGHT', minRatio: 1.55, maxRatio: 99.0 },
];

export default function FaceEnrollmentModal({ isOpen, onClose, onEnrollComplete }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [feedback, setFeedback] = useState('Initializing camera...');
  const [capturedVectors, setCapturedVectors] = useState([]);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);

  const isScanningRef = useRef(false);
  const stageIndexRef = useRef(0);
  const vectorsRef = useRef([]);
  const holdStartRef = useRef(null);

  stageIndexRef.current = currentStageIndex;
  vectorsRef.current = capturedVectors;

  const stopCameraAndLoop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCameraAndLoop();
      return;
    }

    const start = async () => {
      try {
        setIsDone(false);
        setCurrentStageIndex(0);
        setCapturedVectors([]);
        vectorsRef.current = [];
        isScanningRef.current = false;

        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setFeedback(STAGES[0].label);
        intervalRef.current = setInterval(processFrame, 150);
      } catch (err) {
        setFeedback('Camera or AI loading error: ' + err.message);
      }
    };

    start();

    return () => stopCameraAndLoop();
  }, [isOpen]);

  const processFrame = async () => {
    if (
      !videoRef.current ||
      isScanningRef.current ||
      videoRef.current.paused ||
      videoRef.current.ended
    ) {
      return;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(
          videoRef.current,
          new faceapi.SsdMobilenetv1Options({ minConfidence: 0.75 })
        )
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedback('⚠️ Center your face inside the circle with clear light');
        return;
      }

      const box = detection.detection.box;
      if (box.width < 110 || box.height < 110) {
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedback('Move a bit closer to the camera');
        return;
      }

      // Check yaw angle via nose and cheeks
      const landmarks = detection.landmarks.positions;
      const noseTip = landmarks[30];
      const leftCheek = landmarks[2];
      const rightCheek = landmarks[16];

      const distLeft = Math.abs(noseTip.x - leftCheek.x);
      const distRight = Math.abs(rightCheek.x - noseTip.x);
      const ratio = distLeft / (distRight + 0.0001);

      const target = STAGES[stageIndexRef.current];
      const isAngleCorrect = ratio >= target.minRatio && ratio <= target.maxRatio;

      if (!isAngleCorrect) {
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedback(target.label);
        return;
      }

      if (!holdStartRef.current) {
        holdStartRef.current = Date.now();
      }

      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, Math.round((elapsed / 900) * 100));
      setHoldProgress(progress);
      setFeedback(`Holding steady... ${progress}%`);

      if (elapsed >= 900) {
        isScanningRef.current = true;
        holdStartRef.current = null;
        setHoldProgress(0);

        const newVector = Array.from(detection.descriptor);
        const nextList = [...vectorsRef.current, newVector];
        setCapturedVectors(nextList);
        vectorsRef.current = nextList;

        if (stageIndexRef.current + 1 < STAGES.length) {
          const nextIndex = stageIndexRef.current + 1;
          setCurrentStageIndex(nextIndex);
          setFeedback(STAGES[nextIndex].label);
          isScanningRef.current = false;
        } else {
          // --- STEP 3 COMPLETE: STOP LOOP AND SAVE IMMEDIATELY ---
          setIsDone(true);
          stopCameraAndLoop();
          setFeedback('✅ All 3 angles saved! Registering with database...');
          await onEnrollComplete(nextList);
        }
      }
    } catch (e) {
      console.error('Frame processing error:', e);
      isScanningRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Biometric 3-Step Setup</h3>
          <p className="text-xs text-gray-500 mt-1">One-time enrollment. Once complete, daily check-ins require only 1 quick scan.</p>
        </div>

        <div className="flex justify-center gap-2">
          {STAGES.map((s, idx) => (
            <div
              key={s.key}
              className={`h-2 rounded-full transition-all ${
                idx === currentStageIndex
                  ? 'w-10 bg-indigo-600'
                  : idx < currentStageIndex
                  ? 'w-4 bg-emerald-500'
                  : 'w-4 bg-gray-200'
              }`}
            />
          ))}
        </div>

        <div className="relative mx-auto w-56 h-56 rounded-full overflow-hidden border-4 border-indigo-600 bg-black shadow-inner">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {holdProgress > 0 && (
            <div
              className="absolute inset-0 border-4 border-emerald-400 rounded-full pointer-events-none transition-all"
              style={{ opacity: holdProgress / 100 }}
            />
          )}
        </div>

        <div className="min-h-[44px] flex items-center justify-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-800">{feedback}</p>
        </div>

        {!isDone && onClose && (
          <button
            type="button"
            onClick={() => {
              stopCameraAndLoop();
              onClose();
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}