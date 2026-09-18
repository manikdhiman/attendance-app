import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const STAGES = [
  { key: 'front', label: 'Look directly straight into the camera', minRatio: 0.7, maxRatio: 1.4 },
  { key: 'left', label: 'Turn your head slightly to your LEFT', minRatio: 0.0, maxRatio: 0.65 },
  { key: 'right', label: 'Turn your head slightly to your RIGHT', minRatio: 1.55, maxRatio: 99.0 },
];

export default function FaceEnrollmentModal({ isOpen, onEnrollComplete }) {
  const videoRef = useRef(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [feedback, setFeedback] = useState('Initializing AI face detection...');
  const [capturedVectors, setCapturedVectors] = useState([]);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100%

  const isScanningRef = useRef(false);
  const stageIndexRef = useRef(0);
  const vectorsRef = useRef([]);
  const holdStartRef = useRef(null);

  stageIndexRef.current = currentStageIndex;
  vectorsRef.current = capturedVectors;

  useEffect(() => {
    if (!isOpen) return;

    let stream = null;
    let intervalId = null;

    const start = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        setFeedback(STAGES[0].label);

        // Run frame detection every 200ms
        intervalId = setInterval(processFrame, 200);
      } catch (err) {
        setFeedback('Camera or model loading error: ' + err.message);
      }
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen]);

  const processFrame = async () => {
    if (!videoRef.current || isScanningRef.current || videoRef.current.paused || videoRef.current.ended) {
      return;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.75 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedback('⚠️ Bring your face closer to the circle with good lighting');
        return;
      }

      // Check face resolution / box size (prevent tiny/distant faces)
      const box = detection.detection.box;
      if (box.width < 140 || box.height < 140) {
        holdStartRef.current = null;
        setHoldProgress(0);
        setFeedback('Move closer to the camera');
        return;
      }

      // Calculate yaw ratio using nose tip (point 30) & cheek boundaries (2 and 16)
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

      // Angle and clarity confirmed — start 1.2s stability timer
      if (!holdStartRef.current) {
        holdStartRef.current = Date.now();
      }

      const elapsed = Date.now() - holdStartRef.current;
      const progress = Math.min(100, Math.round((elapsed / 1200) * 100));
      setHoldProgress(progress);
      setFeedback(`Hold steady... ${progress}%`);

      if (elapsed >= 1200) {
        // Auto Capture!
        isScanningRef.current = true;
        holdStartRef.current = null;
        setHoldProgress(0);

        const newVector = Array.from(detection.descriptor);
        const nextList = [...vectorsRef.current, newVector];
        setCapturedVectors(nextList);

        if (stageIndexRef.current + 1 < STAGES.length) {
          const nextIndex = stageIndexRef.current + 1;
          setCurrentStageIndex(nextIndex);
          setFeedback(STAGES[nextIndex].label);
          isScanningRef.current = false;
        } else {
          setFeedback('✅ All angles verified! Registering profile...');
          await onEnrollComplete(nextList);
          isScanningRef.current = false;
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Biometric Enrollment</h3>
          <p className="text-xs text-gray-500 mt-1">Automatic hands-free scanning. Follow on-screen instructions.</p>
        </div>

        {/* Progress bar across stages */}
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

        {/* Camera Feed with progress ring */}
        <div className="relative mx-auto w-56 h-56 rounded-full overflow-hidden border-4 border-indigo-600 bg-black shadow-inner">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          
          {/* Circular hold indicator overlay */}
          {holdProgress > 0 && (
            <div
              className="absolute inset-0 border-4 border-emerald-400 rounded-full pointer-events-none transition-all"
              style={{ opacity: holdProgress / 100 }}
            />
          )}
        </div>

        {/* Dynamic feedback instruction */}
        <div className="min-h-[44px] flex items-center justify-center px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
          <p className="text-xs font-semibold text-slate-800">{feedback}</p>
        </div>
      </div>
    </div>
  );
}