import { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';

const AdminDashboard = () => {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [holidays, setHolidays] = useState([]);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'table' | 'manage_users'
  const [payroll, setPayroll] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);

  // Modals state
  const [assignModal, setAssignModal] = useState(null);
  const [assignedTaskText, setAssignedTaskText] = useState('');
  const [editUserModal, setEditUserModal] = useState(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    baseSalary: '',
    overtimeRate: '',
    password: '',
  });

  // Calculate 1-hour rate dynamically: Base Salary / Days in Selected Month / 8 Shift Hours
  const getDynamicHourlyRate = (baseSalary, monthStr = selectedMonth) => {
    if (!baseSalary || parseFloat(baseSalary) <= 0) return 0;
    const [year, month] = monthStr.split('-').map(Number);
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const shiftHours = 8;

    const perDayRate = parseFloat(baseSalary) / totalDaysInMonth;
    const hourlyRate = perDayRate / shiftHours;
    return Math.round(hourlyRate);
  };

  const getDynamicDailyRate = (baseSalary, monthStr = selectedMonth) => {
    if (!baseSalary || parseFloat(baseSalary) <= 0) return 0;
    const [year, month] = monthStr.split('-').map(Number);
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    return Math.round(parseFloat(baseSalary) / totalDaysInMonth);
  };

  const fetchUsersAndRecords = async () => {
    try {
      const [recordsRes, usersRes, holidaysRes] = await Promise.allSettled([
        api.get('/attendance/records'),
        api.get('/admin/users'),
        api.get('/admin/holidays'),
      ]);

      if (recordsRes.status === 'fulfilled') {
        const d = recordsRes.value.data;
        setRecords(Array.isArray(d) ? d : d?.records || []);
      }

      if (usersRes.status === 'fulfilled') {
        const d = usersRes.value.data;
        const userList = Array.isArray(d) ? d : d?.users || [];
        setEmployees(userList);

        setSelectedEmployeeId((prev) => {
          if (prev && userList.some((u) => u.id === prev)) return prev;
          return userList.length > 0 ? userList[0].id : '';
        });
      }

      if (holidaysRes.status === 'fulfilled') {
        const d = holidaysRes.value.data;
        setHolidays(Array.isArray(d) ? d : d?.holidays || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const fetchPayroll = async () => {
    try {
      setLoadingPayroll(true);
      const res = await api.get(`/salary/payroll?month=${selectedMonth}`);
      const parsedPayroll = Array.isArray(res.data)
        ? res.data
        : res.data?.payroll || [];
      setPayroll(parsedPayroll);
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    fetchUsersAndRecords();
  }, []);

  useEffect(() => {
    fetchPayroll();
  }, [selectedMonth]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchEmp = selectedEmployeeId ? r.userId === selectedEmployeeId : true;
      const recordDateStr = new Date(r.date).toISOString().slice(0, 7);
      const matchMonth = selectedMonth ? recordDateStr === selectedMonth : true;
      return matchEmp && matchMonth;
    });
  }, [records, selectedEmployeeId, selectedMonth]);

  // Calendar matrix with Sunday and Paid Festival Holiday detection
  const calendarDays = useMemo(() => {
    if (!selectedMonth) return [];
    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month - 1, 1).getDay();

    const holidayMap = new Map();
    holidays.forEach((h) => {
      const dateKey = new Date(h.date).toISOString().slice(0, 10);
      holidayMap.set(dateKey, h.title);
    });

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dayNumber: null });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month - 1, d);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isSunday = dateObj.getDay() === 0;
      const holidayName = holidayMap.get(dateStr);
      
      const record = filteredRecords.find((r) => {
        const rDateKey = new Date(r.date).toISOString().slice(0, 10);
        return rDateKey === dateStr;
      });

      days.push({
        dayNumber: d,
        dateStr,
        isSunday,
        holidayName,
        record,
      });
    }

    return days;
  }, [selectedMonth, filteredRecords, holidays]);

  const handleReviewOvertime = async (attendanceId, status) => {
    try {
      await api.patch('/attendance/admin/overtime/review', { attendanceId, status });
      fetchUsersAndRecords();
      fetchPayroll();
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
      fetchUsersAndRecords();
    } catch (err) {
      console.error(err);
    }
  };

  // User Management Actions
  const handleToggleBan = async (userId, currentStatus) => {
    if (!window.confirm(`Are you sure you want to ${currentStatus ? 'disband/ban' : 're-activate'} this account?`)) return;
    try {
      await api.patch(`/admin/users/${userId}/ban`, { isActive: !currentStatus });
      fetchUsersAndRecords();
      fetchPayroll();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this employee? All records will be removed.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      fetchUsersAndRecords();
      fetchPayroll();
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleOpenEditModal = (user) => {
    const calculatedOt = getDynamicHourlyRate(user.baseSalary);
    setEditUserModal(user.id);
    setUserFormData({
      name: user.name,
      email: user.email,
      baseSalary: user.baseSalary,
      overtimeRate: calculatedOt,
      password: '',
    });
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...userFormData,
        overtimeRate: getDynamicHourlyRate(userFormData.baseSalary),
      };
      await api.put(`/admin/users/${editUserModal}`, payload);
      setEditUserModal(null);
      fetchUsersAndRecords();
      fetchPayroll();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleExportCSV = () => {
    if (payroll.length === 0) return;
    const headers = [
      'Employee Name',
      'Email',
      'Base Fixed Salary (INR)',
      'Per Day Rate (INR)',
      'Per Hour Rate (INR)',
      'Present Working Days',
      'Unexcused Absent Days',
      'Paid Leave Applied',
      'Late Check-in Violations',
      'Half Day Violations',
      'Early Departure Violations',
      'Total Penalty Deductions (INR)',
      'Approved OT Hours',
      'Overtime Pay (INR)',
      'Net Final Payout (INR)',
    ];

    const rows = payroll.map((emp) => [
      `"${emp.name}"`,
      `"${emp.email}"`,
      emp.baseSalary || 0,
      emp.perDayRate || 0,
      emp.hourlyRate || 0,
      emp.presentWorkingDays || 0,
      emp.unexcusedAbsentDays || 0,
      emp.paidLeaveUsed > 0 ? 'Yes (1 Day)' : 'No',
      emp.penalties?.lateArrivals || 0,
      emp.penalties?.halfDays || 0,
      emp.penalties?.earlyDepartures || 0,
      emp.penalties?.totalPenaltyDeduction || 0,
      emp.approvedOvertimeHours || 0,
      emp.overtimePay || 0,
      emp.totalPayout || 0,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `policy_payroll_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const currentEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 print:p-0">
      {/* Top Header & Navigation Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Control Center</h1>
          <p className="text-sm text-gray-500">Live attendance, shift violation audit, paid holidays, employee CRUD & salary engine</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {viewMode !== 'manage_users' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Employee</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="p-2 border rounded bg-slate-50 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500 min-w-[180px]"
                >
                  {employees.length === 0 ? (
                    <option value="">No Employees Found</option>
                  ) : (
                    employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} {!emp.isActive ? '(Disbanded)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="p-2 border rounded bg-slate-50 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Tab Mode</label>
            <div className="flex border rounded overflow-hidden">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer transition ${
                  viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer transition ${
                  viewMode === 'table' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Logs Table
              </button>
              <button
                onClick={() => setViewMode('manage_users')}
                className={`px-3 py-2 text-xs font-semibold cursor-pointer transition ${
                  viewMode === 'manage_users' ? 'bg-slate-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                Manage Employees
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW: MANAGE EMPLOYEES (CRUD, DISBAND, SALARY EDIT) */}
      {viewMode === 'manage_users' ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="text-lg font-bold text-gray-800">Employee Management & Access Control</h2>
            <p className="text-xs text-gray-500">Edit credentials, adjust base salaries/OT rates, disband IDs, or remove accounts.</p>
          </div>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-gray-600">
                <th className="p-4">Name & Email</th>
                <th className="p-4">Role</th>
                <th className="p-4">Base Fixed Salary</th>
                <th className="p-4">OT Hourly Rate</th>
                <th className="p-4">Status</th>
                <th className="p-4">Admin Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    No employees registered yet.
                  </td>
                </tr>
              ) : (
                employees.map((u) => {
                  const dynamicOtRate = getDynamicHourlyRate(u.baseSalary);
                  const dynamicDayRate = getDynamicDailyRate(u.baseSalary);

                  return (
                    <tr key={u.id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="p-4 font-bold text-slate-800">₹{u.baseSalary?.toLocaleString('en-IN')}</td>
                      <td className="p-4 font-medium text-slate-700">
                        <span className="font-bold text-indigo-600">₹{dynamicOtRate}/hr</span>
                        <span className="text-[11px] text-gray-400 block">(₹{dynamicDayRate}/day)</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                          {u.isActive ? 'Active' : 'Disbanded / Banned'}
                        </span>
                      </td>
                      <td className="p-4 space-x-2">
                        <button
                          onClick={() => handleOpenEditModal(u)}
                          className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 cursor-pointer"
                        >
                          Edit Info / Salary
                        </button>
                        {u.role !== 'ADMIN' && (
                          <>
                            <button
                              onClick={() => handleToggleBan(u.id, u.isActive)}
                              className={`text-xs px-3 py-1.5 rounded font-semibold text-white cursor-pointer ${
                                u.isActive ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              {u.isActive ? 'Disband ID' : 'Activate ID'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-xs bg-rose-600 text-white px-3 py-1.5 rounded hover:bg-rose-700 cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {/* VIEW: CALENDAR GRID WITH SUNDAYS & FESTIVAL HOLIDAYS */}
          {viewMode === 'calendar' ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-gray-800">
                  {currentEmployee ? `${currentEmployee.name}'s Attendance & Holiday Calendar` : 'Attendance Calendar'}
                </h2>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></span> Present</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span> Paid Holiday / Sunday</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 border border-gray-300 rounded"></span> Absent</span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName) => (
                  <div key={dayName} className="text-center font-bold text-xs text-gray-500 py-1">
                    {dayName}
                  </div>
                ))}

                {calendarDays.map((slot, idx) => {
                  if (!slot.dayNumber) {
                    return <div key={`empty-${idx}`} className="min-h-[105px] bg-slate-50/50 rounded-lg" />;
                  }

                  const rec = slot.record;
                  const isPaidHoliday = slot.isSunday || Boolean(slot.holidayName);

                  let cardStyle = 'bg-white border-gray-200';
                  if (rec) cardStyle = 'bg-emerald-50/50 border-emerald-300';
                  else if (isPaidHoliday) cardStyle = 'bg-amber-50/60 border-amber-300';

                  return (
                    <div
                      key={slot.dateStr}
                      className={`min-h-[105px] border rounded-lg p-2 flex flex-col justify-between transition ${cardStyle}`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-sm text-gray-700">{slot.dayNumber}</span>
                        {rec ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                            Present
                          </span>
                        ) : slot.holidayName ? (
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded" title={slot.holidayName}>
                            {slot.holidayName} (Paid)
                          </span>
                        ) : slot.isSunday ? (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                            Sunday (Paid)
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-medium">Absent</span>
                        )}
                      </div>

                      {rec ? (
                        <div className="text-xs space-y-0.5 mt-1">
                          <p className="font-semibold text-slate-700">{rec.workingHours ? `${rec.workingHours} hrs` : 'In Progress'}</p>
                          {rec.overtimeHours > 0 && (
                            <p className={`text-[10px] font-bold ${rec.overtimeStatus === 'APPROVED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                              +{rec.overtimeHours}h OT ({rec.overtimeStatus})
                            </p>
                          )}
                        </div>
                      ) : (
                        slot.holidayName && <p className="text-[11px] text-amber-900 font-semibold truncate">{slot.holidayName}</p>
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
            /* DETAILED LOGS TABLE */
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
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
                        No attendance records found for this employee in {selectedMonth}.
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((r) => (
                      <tr key={r.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-4 font-medium text-gray-800">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="p-4 text-gray-600">
                          {new Date(r.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {' '}
                          {r.outTime ? new Date(r.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-emerald-600 font-semibold">Active</span>}
                        </td>
                        <td className="p-4 font-bold text-slate-800">{r.workingHours ? `${r.workingHours} hrs` : '-'}</td>
                        <td className="p-4 text-gray-600">{r.task || '-'}</td>
                        <td className="p-4 text-indigo-600 font-medium">{r.assignedTask || '-'}</td>
                        <td className="p-4">
                          {r.overtimeHours > 0 ? (
                            <div className="space-y-1">
                              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.overtimeStatus === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {r.overtimeHours} hrs ({r.overtimeStatus})
                              </span>
                              {r.overtimeStatus === 'PENDING' && (
                                <div className="flex gap-1 mt-1">
                                  <button onClick={() => handleReviewOvertime(r.id, 'APPROVED')} className="text-xs bg-emerald-600 text-white px-2 py-0.5 rounded cursor-pointer hover:bg-emerald-700">Approve</button>
                                  <button onClick={() => handleReviewOvertime(r.id, 'REJECTED')} className="text-xs bg-rose-600 text-white px-2 py-0.5 rounded cursor-pointer hover:bg-rose-700">Reject</button>
                                </div>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          <button onClick={() => setAssignModal(r.id)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded cursor-pointer hover:bg-indigo-700">Assign Task</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* POLICY-DRIVEN MONTHLY PAYROLL BREAKDOWN TABLE */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-5 border-b flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Monthly Policy Payroll & Salary Slips</h2>
                <p className="text-xs text-gray-500">
                  Shift: 10:00–18:00 | 1 Paid Leave/Mo | 10:20+ Late (-2h) | Post 12:00 (-Half Day) | Early Out (-2h)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleExportCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition">
                  Download CSV
                </button>
                <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer transition">
                  Print Payslips
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-gray-600">
                    <th className="p-4">Employee</th>
                    <th className="p-4">Base Fixed</th>
                    <th className="p-4">Present / Absent</th>
                    <th className="p-4">Paid Leave</th>
                    <th className="p-4">Shift Violations</th>
                    <th className="p-4 text-rose-600">Total Deductions</th>
                    <th className="p-4 text-emerald-600">OT Bonus</th>
                    <th className="p-4 font-bold text-indigo-700">Net Final Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingPayroll ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-500">
                        Computing policy payroll...
                      </td>
                    </tr>
                  ) : payroll.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-8 text-center text-gray-500">
                        No payroll data available for this month.
                      </td>
                    </tr>
                  ) : (
                    payroll.map((emp) => (
                      <tr key={emp.id} className="border-b hover:bg-gray-50 transition">
                        <td className="p-4">
                          <p className="font-semibold text-gray-800">{emp.name}</p>
                          <p className="text-xs text-gray-500">Rate: ₹{emp.perDayRate}/day | ₹{emp.hourlyRate}/hr</p>
                        </td>
                        <td className="p-4 font-medium text-gray-700">₹{emp.baseSalary?.toLocaleString('en-IN')}</td>
                        <td className="p-4">
                          <span className="text-emerald-700 font-semibold">{emp.presentWorkingDays} present</span>
                          {emp.unexcusedAbsentDays > 0 && (
                            <span className="text-rose-600 text-xs block">{emp.unexcusedAbsentDays} absent</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${emp.paidLeaveUsed > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                            {emp.paidLeaveUsed > 0 ? '1 Day Applied' : 'Not Used'}
                          </span>
                        </td>
                        <td className="p-4 text-xs space-y-0.5">
                          {emp.penalties?.lateArrivals > 0 && <p className="text-amber-700 font-medium">• {emp.penalties.lateArrivals}x Late (-2h each)</p>}
                          {emp.penalties?.halfDays > 0 && <p className="text-rose-700 font-medium">• {emp.penalties.halfDays}x After 12 PM (-0.5d)</p>}
                          {emp.penalties?.earlyDepartures > 0 && <p className="text-orange-700 font-medium">• {emp.penalties.earlyDepartures}x Early Out (-2h)</p>}
                          {emp.penalties?.lateArrivals === 0 && emp.penalties?.halfDays === 0 && emp.penalties?.earlyDepartures === 0 && (
                            <span className="text-gray-400">Clean Timing</span>
                          )}
                        </td>
                        <td className="p-4 text-rose-600 font-bold">
                          -₹{emp.penalties?.totalPenaltyDeduction?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className="p-4 text-emerald-600 font-semibold">
                          +₹{emp.overtimePay?.toLocaleString('en-IN') || 0} ({emp.approvedOvertimeHours}h)
                        </td>
                        <td className="p-4 font-extrabold text-indigo-600 text-base">
                          ₹{emp.totalPayout?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* EDIT USER INFO / SALARY MODAL */}
      {editUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-md">
            <h4 className="text-lg font-bold mb-4 text-gray-800">Edit Employee Info & Compensation</h4>
            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={userFormData.name}
                  onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                  className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={userFormData.email}
                  onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                  className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Monthly Base Salary (₹)</label>
                  <input
                    type="number"
                    required
                    value={userFormData.baseSalary}
                    onChange={(e) => {
                      const newSalary = e.target.value;
                      setUserFormData({
                        ...userFormData,
                        baseSalary: newSalary,
                        overtimeRate: getDynamicHourlyRate(newSalary),
                      });
                    }}
                    className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Calculated 1-Hour OT Rate</label>
                  <input
                    type="text"
                    disabled
                    value={`₹${getDynamicHourlyRate(userFormData.baseSalary)}/hr`}
                    className="w-full p-2 border rounded text-sm bg-gray-100 text-indigo-700 font-bold cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reset Password (leave empty to keep current)</label>
                <input
                  type="password"
                  placeholder="New password..."
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg cursor-pointer hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN TASK MODAL */}
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
                className="w-full p-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModal(null)}
                  className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 text-white font-semibold rounded-lg cursor-pointer hover:bg-indigo-700"
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