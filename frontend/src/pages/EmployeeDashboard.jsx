import { useState, useEffect } from 'react';
import api from '../api/axios';
import AttendanceCameraModal from '../components/AttendanceCameraModal';

const EmployeeDashboard = () => {
  const [records, setRecords] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [msg, setMsg] = useState('');

  // Live Camera & Location Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState('checkIn'); // 'checkIn' or 'checkOut'

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

  const handleAttendanceSubmit = async ({ latitude, longitude, photo }) => {
    try {
      if (actionType === 'checkIn') {
        const res = await api.post('/attendance/check-in', {
          latitude,
          longitude,
          photo,
        });
        setMsg(res.data.message || 'Checked in successfully!');
      } else {
        const res = await api.post('/attendance/check-out', {
          task: taskInput,
          latitude,
          longitude,
          photo,
        });
        setMsg(res.data.message || 'Checked out successfully!');
        setTaskInput('');
      }
      fetchRecords();
    } catch (err) {
      setMsg(err.response?.data?.message || `${actionType === 'checkIn' ? 'Check-in' : 'Check-out'} failed`);
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
    /* --- UPDATED: Responsive container padding (p-3 on mobile, p-6 on desktop) --- */
    <div className="max-w-6xl mx-auto p-3 sm:p-6 space-y-6">
      {msg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded text-sm">
          {msg}
        </div>
      )}

      {/* Check In / Out Action Card */}
      {/* --- UPDATED: Stacked on mobile, aligned items on md screens --- */}
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

        {/* --- UPDATED: Action controls full-width on mobile --- */}
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
        
        {/* --- UPDATED: Responsive horizontal scroll wrapper for table --- */}
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

      {/* Overtime Claim Modal */}
      {selectedRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-40">
          <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm">
            <h4 className="text-lg font-bold mb-4 text-gray-800">Claim Overtime Hours</h4>
            <form onSubmit={handleOvertimeSubmit} className="space-y-4">
              <input
                type="number"
                step="0.5"
                placeholder="Hours (e.g., 1.5)"
                required
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordId(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mandatory Live Camera & Location Verification Modal */}
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