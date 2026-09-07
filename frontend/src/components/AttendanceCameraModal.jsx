import React, { useRef, useState, useEffect } from 'react';

const AttendanceCameraModal = ({ isOpen, onClose, onConfirm, actionType }) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [locError, setLocError] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Request GPS Location immediately on open
  useEffect(() => {
    if (!isOpen) return;

    setLocError('');
    setPhoto(null);

    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
  (pos) => {
    setLocation({
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  },
  (err) => {
    // If high accuracy fails on desktop/laptop, try normal accuracy
    if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
      navigator.geolocation.getCurrentPosition(
        (fallbackPos) => {
          setLocation({
            latitude: fallbackPos.coords.latitude,
            longitude: fallbackPos.coords.longitude,
            accuracy: fallbackPos.coords.accuracy,
          });
        },
        () => {
          setLocError('Location is OFF or unavailable. Please enable device location.');
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
      );
    } else {
      setLocError('Location permission denied. Click the site settings icon in your browser address bar and Allow Location.');
    }
  },
  { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
);
    // 2. Open Live Camera Stream (Strictly front camera, no gallery pickers)
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((mediaStream) => {
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        setLocError('Camera access denied. Camera permission is required for live photo verification.');
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setPhoto(dataUrl);
  };

  const handleRetake = () => {
    setPhoto(null);
  };

  const handleSubmit = async () => {
    if (!location) {
      alert('Location is not captured yet. Please enable GPS.');
      return;
    }
    if (!photo) {
      alert('Please click your photo first.');
      return;
    }

    setLoading(true);
    await onConfirm({
      latitude: location.latitude,
      longitude: location.longitude,
      photo,
    });
    setLoading(false);
    handleClose();
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col items-center">
        <h3 className="text-lg font-bold text-gray-800 mb-2">
          Live Verification ({actionType === 'checkIn' ? 'Check In' : 'Check Out'})
        </h3>

        {/* GPS Location Banner */}
        {locError ? (
          <div className="w-full bg-red-100 border border-red-300 text-red-700 text-xs p-3 rounded-lg mb-3">
            ⚠️ {locError}
          </div>
        ) : location ? (
          <div className="w-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs p-2 rounded-lg mb-3 flex justify-between">
            <span>📍 GPS Location Acquired</span>
            <span className="font-semibold">(±{Math.round(location.accuracy)}m)</span>
          </div>
        ) : (
          <div className="w-full bg-blue-50 border border-blue-200 text-blue-700 text-xs p-2 rounded-lg mb-3 animate-pulse">
            🛰️ Fetching exact GPS location...
          </div>
        )}

        {/* Live Camera View or Captured Photo */}
        <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden mb-4 border border-gray-200 flex items-center justify-center">
          {!photo ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <img src={photo} alt="Captured preview" className="w-full h-full object-cover" />
          )}
        </div>

        {/* Actions */}
        <div className="flex w-full gap-3">
          {!photo ? (
            <button
              onClick={capturePhoto}
              disabled={!location || !!locError}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition"
            >
              📸 Capture Live Photo
            </button>
          ) : (
            <>
              <button
                onClick={handleRetake}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2.5 rounded-xl transition"
              >
                Retake
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !location}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition"
              >
                {loading ? 'Submitting...' : 'Confirm & Mark'}
              </button>
            </>
          )}
          <button
            onClick={handleClose}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AttendanceCameraModal;