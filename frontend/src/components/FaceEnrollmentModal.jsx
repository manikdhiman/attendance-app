import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const STAGES = [
  { key: 'front', label: 'Look straight at the camera' },
  { key: 'left', label: 'Turn your head slightly to the LEFT' },
  { key: 'right', label: 'Turn your head slightly to the RIGHT' },
];

export default function FaceEnrollmentModal({ isOpen, onEnrollComplete }) {
  const videoRef = useRef(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [capturedVectors, setCapturedVectors] = useState([]);
  const [statusMessage, setStatusMessage] = useState('Loading camera and AI models...');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let stream = null;

    const init = async () => {
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
          videoRef.current.play();
        }

        setStatusMessage(STAGES[0].label);
      } catch (err) {
        setStatusMessage('Camera error: ' + err.message);
      }
    };

    init();

    return () => {
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen]);

  const handleCapture = async () => {
    if (!videoRef.current || isProcessing) return;
    setIsProcessing(true);
    setStatusMessage('Scanning facial landmarks...');

    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatusMessage('⚠️ No face detected. Please center your face.');
        setIsProcessing(false);
        return;
      }

      const vector = Array.from(detection.descriptor);
      const nextVectors = [...capturedVectors, vector];
      setCapturedVectors(nextVectors);

      if (currentStageIndex + 1 < STAGES.length) {
        const nextIdx = currentStageIndex + 1;
        setCurrentStageIndex(nextIdx);
        setStatusMessage(STAGES[nextIdx].label);
        setIsProcessing(false);
      } else {
        setStatusMessage('Saving biometric profile...');
        await onEnrollComplete(nextVectors);
        setIsProcessing(false);
      }
    } catch (err) {
      setStatusMessage('Error capturing angle: ' + err.message);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Biometric Profile Setup</h3>
        <p className="text-xs text-gray-500">
          Register your face across 3 quick angles so you can authenticate attendance seamlessly.
        </p>

        {/* Step dots */}
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

        <div className="relative mx-auto w-52 h-52 rounded-full overflow-hidden border-4 border-indigo-600 bg-black shadow-inner">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>

        <p className="text-sm font-semibold text-slate-700 min-h-[40px] flex items-center justify-center px-2">
          {statusMessage}
        </p>

        <button
          type="button"
          onClick={handleCapture}
          disabled={isProcessing}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition disabled:bg-gray-400 cursor-pointer text-sm"
        >
          {isProcessing ? 'Processing...' : `Capture: ${STAGES[currentStageIndex].key.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}