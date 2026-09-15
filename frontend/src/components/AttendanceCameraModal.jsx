import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

const AttendanceCameraModal = ({ isOpen, actionType, onClose, onConfirm }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusText, setStatusText] = useState('Initializing camera and AI models...');
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let activeStream = null;

    const init = async () => {
      try {
        setLoading(true);
        setStatusText('Loading neural face models...');

        // Load models directly from Vite public directory
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);

        setStatusText('Accessing camera...');
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
          videoRef.current.play();
        }

        setStream(activeStream);
        setLoading(false);
        setStatusText('Look directly into the camera to verify.');
      } catch (err) {
        setStatusText('Camera or model error: ' + err.message);
        setLoading(false);
      }
    };

    init();

    return () => {
      if (activeStream) activeStream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen]);

  const handleCaptureAndVerify = async () => {
    if (!videoRef.current || capturing) return;
    setCapturing(true);
    setStatusText('Detecting face & extracting biometric features...');

    try {
      // 1. Detect single face + 68 landmarks + 128-d vector
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatusText('⚠️ No face detected! Please look straight at the camera with clear lighting.');
        setCapturing(false);
        return;
      }

      // Convert Float32Array to standard array for JSON transport
      const liveDescriptor = Array.from(detection.descriptor);

      // 2. Capture a photo snapshot (base64)
      const canvasEl = document.createElement('canvas');
      canvasEl.width = videoRef.current.videoWidth || 640;
      canvasEl.height = videoRef.current.videoHeight || 480;
      const ctx = canvasEl.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvasEl.width, canvasEl.height);
      const photoBase64 = canvasEl.toDataURL('image/jpeg', 0.8);

      // 3. Get GPS location
      setStatusText('Acquiring location...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setStatusText('Submitting biometric record...');
          onConfirm({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            photo: photoBase64,
            faceDescriptor: liveDescriptor, // Sent to backend for Euclidean check
          });
          setCapturing(false);
          onClose();
        },
        () => {
          // If GPS denied/fails, still forward biometrics
          setStatusText('Submitting biometric record...');
          onConfirm({
            latitude: null,
            longitude: null,
            photo: photoBase64,
            faceDescriptor: liveDescriptor,
          });
          setCapturing(false);
          onClose();
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (err) {
      setStatusText('Verification capture failed: ' + err.message);
      setCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-center">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            {actionType === 'checkIn' ? 'Check-In Verification' : 'Check-Out Verification'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Biometric facial recognition required</p>
        </div>

        <div className="relative mx-auto w-[240px] h-[240px] rounded-full overflow-hidden border-4 border-indigo-600 shadow-inner bg-black flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>

        <p className="text-xs font-semibold text-slate-700 min-h-[32px] px-2 flex items-center justify-center">
          {statusText}
        </p>

        <div className="flex gap-2 justify-center pt-2">
          <button
            onClick={onClose}
            disabled={capturing}
            className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition"
          >
            Cancel
          </button>
          <button
            onClick={handleCaptureAndVerify}
            disabled={loading || capturing}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg shadow cursor-pointer transition"
          >
            {capturing ? 'Verifying...' : 'Capture & Verify'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCameraModal;