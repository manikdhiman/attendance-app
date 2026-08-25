import { useState, useEffect } from 'react';
import api from '../api/axios';

const EmployeeDashboard = () => {
  const [records, setRecords] = useState([]);
  const [taskInput, setTaskInput] = useState('');
  const [overtimeHours, setOvertimeHours] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState(null);
  const [msg, setMsg] = useState('');

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

  const handleCheckIn = async () => {
    try {
      await api.post('/attendance/check-in');
      setMsg('Checked in successfully!');
      fetchRecords();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Check-in failed');
    }
  };

  const handleCheckOut = async () => {
    try {
      await api.post('/attendance/check-out', { task: taskInput });
      setMsg('Checked out successfully!');
      setTaskInput('');
      fetchRecords();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Check-out failed');
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {msg && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded">
          {msg}
        </div>
      )}

      {/* Check In / Out Action Card */}
      <div className="bg-white p-6 rounded-xl shadow border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Shift Status</h2>
          <p className="text-gray-500 text-sm">
            {activeRecord
              ? `Checked in at ${new Date(activeRecord.inTime).toLocaleTimeString()}`
              : 'You are currently not checked in.'}
          </p>
          {activeRecord?.assignedTask && (
            <p className="mt-2 text-sm text-indigo-600 bg-indigo-50 p-2 rounded">
              <strong>Assigned by Admin:</strong> {activeRecord.assignedTask}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {activeRecord && (
            <input
              type="text"
              placeholder="What did you work on today?"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              className="p-2 border rounded w-full sm:w-64 text-sm"
            />
          )}
          {!activeRecord ? (
            <button
              onClick={handleCheckIn}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded shadow"
            >
              Check In
            </button>
          ) : (
            <button
              onClick={handleCheckOut}
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded shadow"
            >
              Check Out
            </button>
          )}
        </div>
      </div>

      {/* Attendance History Table */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <h3 className="text-lg font-bold p-5 border-b text-gray-800">Your Attendance History</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="p-4">Date</th>
                <th className="p-4">In Time</th>
                <th className="p-4">Out Time</th>
                <th className="p-4">Working Hours</th>
                <th className="p-4">My Task</th>
                <th className="p-4">Assigned Task</th>
                <th className="p-4">Overtime</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="p-4">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="p-4">{new Date(r.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-4">{r.outTime ? new Date(r.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-4 font-semibold">{r.workingHours ? `${r.workingHours} hrs` : '-'}</td>
                  <td className="p-4">{r.task || '-'}</td>
                  <td className="p-4 text-indigo-600">{r.assignedTask || '-'}</td>
                  <td className="p-4">
                    {r.overtimeHours > 0 ? (
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        r.overtimeStatus === 'APPROVED' ? 'bg-green-100 text-green-700' :
                        r.overtimeStatus === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {r.overtimeHours} hrs ({r.overtimeStatus})
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4">
                    {r.outTime && r.overtimeStatus === 'NONE' && (
                      <button
                        onClick={() => setSelectedRecordId(r.id)}
                        className="text-xs bg-slate-800 text-white px-3 py-1 rounded hover:bg-slate-700"
                      >
                        Claim Overtime
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overtime Claim Modal */}
      {selectedRecordId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
            <h4 className="text-lg font-bold mb-4">Claim Overtime Hours</h4>
            <form onSubmit={handleOvertimeSubmit} className="space-y-4">
              <input
                type="number"
                step="0.5"
                placeholder="Hours (e.g., 1.5)"
                required
                value={overtimeHours}
                onChange={(e) => setOvertimeHours(e.target.value)}
                className="w-full p-2 border rounded"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordId(null)}
                  className="px-4 py-2 text-sm bg-gray-200 rounded"
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;