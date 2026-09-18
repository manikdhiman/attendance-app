import { useState, useEffect } from 'react';
import api from '../api/axios';
import AttendanceCameraModal from '../components/AttendanceCameraModal';

const EmployeeDashboard = () => {
  const [records, setRecords] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [msg, setMsg] = useState('');
  const [needsFaceEnrollment, setNeedsFaceEnrollment] = useState(false);

  // Live Camera Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState('checkIn'); // 'checkIn', 'checkOut', or 'register'

  const fetchRecords = async () => {
    try {
      const res = await api.get('/attendance/records');
      setRecords(res.data.records);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const activeRecord = records.find((r) => !r.outTime);

  const handleOpenAttendanceModal = (type) => {
    if (type === 'checkOut' && !taskInput.trim()) {
      setMsg('Please fill in what you worked on today before checking out.');
      return;
    }
    setActionType(type);
    setModalOpen(true);
  };

  const handleAttendanceSubmit = async ({ latitude, longitude, photo, faceDescriptor }) => {
    try {
      // 1. If currently in Face Registration mode
      if (actionType === 'register') {
        const res = await api.post('/attendance/register-face', { faceDescriptor });
        setMsg(res.data.message || 'Face registered successfully! You can now check in.');
        setNeedsFaceEnrollment(false);
        return;
      }

      // 2. Normal Check In
      if (actionType === 'checkIn') {
        const res = await api.post('/attendance/check-in', {
          latitude,
          longitude,
          photo,
          faceDescriptor,
        });
        setMsg(res.data.message || 'Checked in successfully!');
        setNeedsFaceEnrollment(false);
      } 
      // 3. Check Out
      else {
        const res = await api.post('/attendance/check-out', {
          task: taskInput,
          latitude,
          longitude,
          photo,
          faceDescriptor,
        });
        setMsg(res.data.message || 'Checked out successfully!');
        setTaskInput('');
      }

      fetchRecords();
    } catch (err) {
      const errorResponse = err.response?.data?.message || 'Action failed';
      setMsg(errorResponse);

      // If backend says no profile exists, flag it so the prompt button shows up
      if (errorResponse.toLowerCase().includes('no registered facial profile')) {
        setNeedsFaceEnrollment(true);
      }
    }
  };

  const handleOvertimeSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attendance/overtime/request', {
        attendanceId: selectedRecordId,
        overtimeHours,
      });
      setSelectedRecordId(null);
      setOvertimeHours('');
      setMsg('Overtime request submitted!');
      fetchRecords();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to request overtime');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-6">
      {/* Dynamic Alert Banner */}
      {msg && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <span>{msg}</span>
          
          {/* Actionable Button if face is missing */}
          {(needsFaceEnrollment || msg.toLowerCase().includes('no registered facial profile')) && (
            <button
              onClick={() => handleOpenAttendanceModal('register')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-xs shadow cursor-pointer whitespace-nowrap"
            >
              Register Face Now
            </button>
          )}
        </div>
      )}

      {/* Shift Status Card */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <h2 className="text-xl font-bold text-gray-800">Shift Status</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeRecord
              ? `Checked in at ${new Date(activeRecord.inTime).toLocaleTimeString()}`
              : 'You are currently not checked in.'}
          </p>
          {activeRecord?.assignedTask && (
            <p className="mt-2 text-xs sm:text-sm text-indigo-700 bg-indigo-50 p-2.5 rounded-lg border border-indigo-100">
              <strong>Assigned by Admin:</strong> {activeRecord.assignedTask}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          {activeRecord && (
            <input
              type="text"
              placeholder="What did you work on today?"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              className="p-2.5 border rounded-lg w-full sm:w-64 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          {!activeRecord ? (
            <button
              onClick={() => handleOpenAttendanceModal('checkIn')}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow transition cursor-pointer text-sm text-center"
            >
              Check In
            </button>
          ) : (
            <button
              onClick={() => handleOpenAttendanceModal('checkOut')}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow transition cursor-pointer text-sm text-center"
            >
              Check Out
            </button>
          )}
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <h3 className="text-base sm:text-lg font-bold p-4 sm:p-5 border-b text-gray-800">Your Attendance History</h3>
        
        <div className="overflow-x-auto w-full">
          <table className="min-w-[750px] w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600 text-xs uppercase tracking-wider">
                <th className="p-3 sm:p-4 whitespace-nowrap">Date</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">In Time</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Out Time</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Working Hours</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">My Task</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Assigned Task</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Overtime</th>
                <th className="p-3 sm:p-4 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 sm:p-4 font-medium text-gray-800 whitespace-nowrap">
                      {new Date(r.date).toLocaleDateString()}
                    </td>
                    <td className="p-3 sm:p-4 text-gray-600 whitespace-nowrap">
                      {new Date(r.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3 sm:p-4 text-gray-600 whitespace-nowrap">
                      {r.outTime ? new Date(r.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                        <span className="text-emerald-600 font-semibold text-xs">Active</span>
                      )}
                    </td>
                    <td className="p-3 sm:p-4 font-semibold whitespace-nowrap">
                      {r.workingHours ? `${r.workingHours} hrs` : '-'}
                    </td>
                    <td className="p-3 sm:p-4 text-gray-600 max-w-[150px] truncate" title={r.task}>
                      {r.task || '-'}
                    </td>
                    <td className="p-3 sm:p-4 text-indigo-600 max-w-[150px] truncate" title={r.assignedTask}>
                      {r.assignedTask || '-'}
                    </td>
                    <td className="p-3 sm:p-4 whitespace-nowrap">
                      {r.overtimeHours > 0 ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          r.overtimeStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          r.overtimeStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {r.overtimeHours} hrs ({r.overtimeStatus})
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-3 sm:p-4 whitespace-nowrap">
                      {r.outTime && r.overtimeStatus === 'NONE' && (
                        <button
                          onClick={() => setSelectedRecordId(r.id)}
                          className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition"
                        >
                          Claim Overtime
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Camera Modal (Handles CheckIn, CheckOut, AND Register Face) */}
      <AttendanceCameraModal
        isOpen={modalOpen}
        actionType={actionType}
        onClose={() => setModalOpen(false)}
        onConfirm={handleAttendanceSubmit}
      />
    </div>
  );
};

export default EmployeeDashboard;