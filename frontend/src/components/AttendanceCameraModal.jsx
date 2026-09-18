import { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';

export default function AttendanceCameraModal({ isOpen, actionType, onClose, onConfirm }) {
  const videoRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let stream = null;
    const startCameraAndModels = async () => {
      try {
        setLoading(true);
        setErrorMsg('');

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
        setLoading(false);
      } catch (err) {
        setLoading(false);
        setErrorMsg('Camera or model load failed: ' + err.message);
      }
    };

    startCameraAndModels();

    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [isOpen]);

  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;
    setIsCapturing(true);
    setErrorMsg('');

    try {
      // 1. Detect face & 128-d vector
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setErrorMsg('No face detected. Please face the camera with good lighting.');
        setIsCapturing(false);
        return;
      }

      // 2. Take Snapshot photo
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const photo = canvas.toDataURL('image/jpeg', 0.8);

      // 3. Get Geolocation
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          await onConfirm({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            photo,
            faceDescriptor: Array.from(detection.descriptor),
          });
          setIsCapturing(false);
          onClose();
        },
        async (geoErr) => {
          console.warn('Geolocation failed:', geoErr.message);
          // Fallback without coordinates if GPS permission is denied
          await onConfirm({
            latitude: null,
            longitude: null,
            photo,
            faceDescriptor: Array.from(detection.descriptor),
          });
          setIsCapturing(false);
          onClose();
        },
        { timeout: 8000 }
      );
    } catch (err) {
      setErrorMsg('Capture failed: ' + err.message);
      setIsCapturing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-3 text-center">
        <h3 className="font-bold text-gray-800 text-lg">
          {actionType === 'register' ? 'Register Your Face' : actionType === 'checkIn' ? 'Face Check-In' : 'Face Check-Out'}
        </h3>

        <div className="relative mx-auto w-56 h-56 rounded-full overflow-hidden border-4 border-indigo-600 bg-black shadow-inner">
          <video ref={videoRef} playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-white bg-black/60">
              Loading AI Models...
            </div>
          )}
        </div>

        {errorMsg && <p className="text-xs text-red-600 font-medium">{errorMsg}</p>}

        <div className="flex gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCapture}
            disabled={loading || isCapturing}
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 rounded-lg shadow cursor-pointer"
          >
            {isCapturing ? 'Verifying...' : actionType === 'register' ? 'Lock & Register' : 'Verify & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}