import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';

const AdminDashboard = () => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  
  // Default to current year and month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table'
  const [assignModal, setAssignModal] = useState(null);
  const [assignedTaskText, setAssignedTaskText] = useState('');

  const fetchRecords = async () => {
    try {
      const res = await api.get('/attendance/records');
      setRecords(res.data.records);

      // Extract unique list of employees from the records
      const uniqueUsersMap = new Map();
      res.data.records.forEach((r) => {
        if (r.user && !uniqueUsersMap.has(r.user.id)) {
          uniqueUsersMap.set(r.user.id, r.user);
        }
      });
      const uniqueList = Array.from(uniqueUsersMap.values());
      setEmployees(uniqueList);

      // Default select the first employee if none selected
      if (!selectedEmployeeId && uniqueList.length > 0) {
        setSelectedEmployeeId(uniqueList[0].id);
      }
    } catch (err) {
      console.error('Error fetching attendance records:', err);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  // Filter records by employee and selected month
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchEmp = selectedEmployeeId ? r.userId === selectedEmployeeId : true;
      const matchMonth = selectedMonth ? r.date.startsWith(selectedMonth) : true;
      return matchEmp && matchMonth;
    });
  }, [records, selectedEmployeeId, selectedMonth]);

  // Aggregate stats for Salary Calculation
  const totalDaysPresent = filteredRecords.length;
  const totalHoursWorked = filteredRecords
    .reduce((acc, r) => acc + (r.workingHours || 0), 0)
    .toFixed(1);
  const totalApprovedOvertime = filteredRecords
    .filter((r) => r.overtimeStatus === 'APPROVED')
    .reduce((acc, r) => acc + (r.overtimeHours || 0), 0)
    .toFixed(1);

  // Build Calendar Matrix for Selected Month
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Sun, 1 = Mon ...

    const days = [];
    // Leading empty slots for calendar alignment
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null });
    }

    // Map each day with attendance record if present
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const record = filteredRecords.find((r) => r.date.startsWith(dateStr));
      days.push({
        dayNumber: d,
        dateStr,
        record,
      });
    }

    return days;
  }, [selectedMonth, filteredRecords]);

  const handleReviewOvertime = async (attendanceId, status) => {
    try {
      await api.patch('/attendance/admin/overtime/review', { attendanceId, status });
      fetchRecords();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignTask = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/attendance/admin/assign-task', {
        attendanceId: assignModal,
        assignedTask: assignedTaskText,
      });
      setAssignModal(null);
      setAssignedTaskText('');
      fetchRecords();
    } catch (err) {
      console.error(err);
    }
  };

  const currentEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Top Header & Navigation Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employee Attendance & Payroll Audit</h1>
          <p className="text-sm text-gray-500">
            Review work shifts, calendar activity, and accumulated hours for salary calculation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Employee Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Employee</label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className="p-2 border rounded bg-slate-50 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              {employees.length === 0 && <option value="">No employees found</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Month</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-2 border rounded bg-slate-50 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* View Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">View Style</label>
            <div className="flex border rounded overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer ${
                  viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Table List
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Salary Preparation Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Days Attended</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-slate-800">{totalDaysPresent}</span>
            <span className="text-xs text-gray-500">working days</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Regular Hours Worked</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-indigo-600">{totalHoursWorked}</span>
            <span className="text-xs text-gray-500">hours</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Approved Overtime Hours</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-extrabold text-emerald-600">{totalApprovedOvertime}</span>
            <span className="text-xs text-gray-500">hours</span>
          </div>
        </div>
      </div>

      {/* View Section */}
      {viewMode === 'calendar' ? (
        /* Calendar Grid */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-800">
              {currentEmployee ? `${currentEmployee.name}'s Attendance Calendar` : 'Attendance Calendar'}
            </h2>
            <span className="text-sm font-semibold text-slate-600">{selectedMonth}</span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
              <div key={dayName} className="text-center font-bold text-xs text-gray-400 py-2">
                {dayName}
              </div>
            ))}

            {calendarDays.map((slot, idx) => {
              if (!slot.dayNumber) {
                return <div key={`empty-${idx}`} className="min-h-[105px] bg-slate-50/50 rounded-lg" />;
              }

              const rec = slot.record;

              return (
                <div
                  key={slot.dateStr}
                  className={`min-h-[105px] border rounded-lg p-2 flex flex-col justify-between transition ${
                    rec
                      ? 'bg-emerald-50/40 border-emerald-200'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-gray-700">{slot.dayNumber}</span>
                    {rec ? (
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.5 rounded">
                        Present
                      </span>
                    ) : (
                      <span className="text-[10px] text-gray-400 font-medium">Off / None</span>
                    )}
                  </div>

                  {rec && (
                    <div className="text-xs space-y-0.5 mt-1">
                      <p className="font-semibold text-slate-700">
                        {rec.workingHours ? `${rec.workingHours} hrs` : 'In Progress'}
                      </p>
                      {rec.overtimeHours > 0 && (
                        <p className={`text-[10px] font-bold ${
                          rec.overtimeStatus === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'
                        }`}>
                          +{rec.overtimeHours}h OT ({rec.overtimeStatus})
                        </p>
                      )}
                    </div>
                  )}

                  {rec && (
                    <div className="mt-1 flex justify-end">
                      <button
                        onClick={() => setAssignModal(rec.id)}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                      >
                        Task details &rarr;
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Detailed Table List View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-600">
                  <th className="p-4">Date</th>
                  <th className="p-4">In / Out Time</th>
                  <th className="p-4">Hours</th>
                  <th className="p-4">Employee Task</th>
                  <th className="p-4">Assigned Task</th>
                  <th className="p-4">Overtime Status</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">
                      No records found for this employee in {selectedMonth}.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-medium text-gray-800">
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-gray-600">
                        {new Date(r.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                        {r.outTime ? new Date(r.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (
                          <span className="text-emerald-600 font-semibold">Active</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {r.workingHours ? `${r.workingHours} hrs` : '-'}
                      </td>
                      <td className="p-4 text-gray-600">{r.task || '-'}</td>
                      <td className="p-4 text-indigo-600 font-medium">{r.assignedTask || '-'}</td>
                      <td className="p-4">
                        {r.overtimeHours > 0 ? (
                          <div className="space-y-1">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              r.overtimeStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                              r.overtimeStatus === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {r.overtimeHours} hrs ({r.overtimeStatus})
                            </span>
                            {r.overtimeStatus === 'PENDING' && (
                              <div className="flex gap-1 mt-1">
                                <button
                                  onClick={() => handleReviewOvertime(r.id, 'APPROVED')}
                                  className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded hover:bg-emerald-700 cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReviewOvertime(r.id, 'REJECTED')}
                                  className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded hover:bg-rose-700 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setAssignModal(r.id)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 cursor-pointer"
                        >
                          Assign Task
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Assignment Modal */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-sm">
            <h4 className="text-lg font-bold mb-3 text-gray-800">Assign Daily Task</h4>
            <form onSubmit={handleAssignTask} className="space-y-4">
              <textarea
                placeholder="Describe the assigned task..."
                required
                rows="3"
                value={assignedTaskText}
                onChange={(e) => setAssignedTaskText(e.target.value)}
                className="w-full p-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg cursor-pointer"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;