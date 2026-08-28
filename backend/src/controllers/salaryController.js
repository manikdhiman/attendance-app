const prisma = require('../config/db');

exports.getMonthlyPayroll = async (req, res) => {
  const { month } = req.query; // Format: 'YYYY-MM'

  try {
    const selectedMonth = month || new Date().toISOString().slice(0, 7);
    const [year, monthNum] = selectedMonth.split('-').map(Number);

    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);
    const totalDaysInMonth = new Date(year, monthNum, 0).getDate();

    // 1. Fetch official festival holidays in this month
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    });

    const holidayDatesSet = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10))
    );

    // 2. Map Sundays and Working Days in this month
    const sundaysSet = new Set();
    const workingDaysList = [];

    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, monthNum - 1, day);
      const dateKey = `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (d.getDay() === 0) {
        sundaysSet.add(dateKey);
      } else if (!holidayDatesSet.has(dateKey)) {
        workingDaysList.push(dateKey);
      }
    }

    const totalSundays = sundaysSet.size;
    const totalFestivalHolidays = holidayDatesSet.size;
    const totalWorkingDaysInMonth = workingDaysList.length;

    // 3. Fetch active employees and their attendance records
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        attendances: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const payrollReport = users.map((user) => {
      const perDayRate = user.baseSalary / totalDaysInMonth;
      const hourlyRate = perDayRate / 8; // 8-hour shift standard (10:00 to 18:00)

      let totalDeductionAmount = 0;
      let lateArrivalDeductions = 0;
      let halfDayDeductions = 0;
      let earlyDepartureDeductions = 0;
      let approvedOvertimeHours = 0;

      // Group attendance by date string (YYYY-MM-DD)
      const attendanceMap = new Map();
      user.attendances.forEach((att) => {
        const dStr = att.date.toISOString().slice(0, 10);
        attendanceMap.set(dStr, att);

        if (att.overtimeStatus === 'APPROVED') {
          approvedOvertimeHours += att.overtimeHours || 0;
        }
      });

      let presentWorkingDays = 0;
      let unexcusedAbsentDays = 0;

      // Evaluate each working day against shift rules
      workingDaysList.forEach((workDateStr) => {
        const record = attendanceMap.get(workDateStr);

        if (!record) {
          unexcusedAbsentDays++;
        } else {
          presentWorkingDays++;

          const inTime = new Date(record.inTime);
          const inHours = inTime.getHours();
          const inMinutes = inTime.getMinutes();
          const totalInMinutes = inHours * 60 + inMinutes;

          // Rule A: In-Time Penalties (Shift starts at 10:00 AM -> 600 mins)
          if (totalInMinutes > 720) {
            // Checked in after 12:00 PM -> Half Day Deduction
            totalDeductionAmount += perDayRate * 0.5;
            halfDayDeductions += 1;
          } else if (totalInMinutes > 620) {
            // Checked in after 10:20 AM and before 12:00 PM -> 2 Hours Deduction
            totalDeductionAmount += hourlyRate * 2;
            lateArrivalDeductions += 1;
          }

          // Rule B: Out-Time Penalties (Shift ends at 6:00 PM / 18:00 -> 1080 mins)
          if (record.outTime) {
            const outTime = new Date(record.outTime);
            const outHours = outTime.getHours();
            const outMinutes = outTime.getMinutes();
            const totalOutMinutes = outHours * 60 + outMinutes;

            if (totalOutMinutes < 1080) {
              // Left before 6:00 PM -> 2 Hours Deduction
              totalDeductionAmount += hourlyRate * 2;
              earlyDepartureDeductions += 1;
            }
          }
        }
      });

      // Rule C: 1 Monthly Paid Leave Benefit
      // If employee missed working days, 1 day of absence is forgiven (paid)
      let paidLeaveUsed = 0;
      let effectiveAbsentDays = unexcusedAbsentDays;
      if (unexcusedAbsentDays > 0) {
        paidLeaveUsed = 1;
        effectiveAbsentDays = unexcusedAbsentDays - 1;
      }

      // Deduct unpaid absent days
      const fullDayAbsentDeductions = effectiveAbsentDays * perDayRate;
      totalDeductionAmount += fullDayAbsentDeductions;

      // Rule D: Overtime Calculation
      const overtimePay = approvedOvertimeHours * (user.overtimeRate || 150);

      // Final Payout calculation
      const netSalary = Math.max(0, user.baseSalary - totalDeductionAmount + overtimePay);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        baseSalary: user.baseSalary,
        perDayRate: Math.round(perDayRate),
        hourlyRate: Math.round(hourlyRate),
        presentWorkingDays,
        unexcusedAbsentDays,
        paidLeaveUsed,
        effectiveAbsentDays,
        penalties: {
          lateArrivals: lateArrivalDeductions,
          halfDays: halfDayDeductions,
          earlyDepartures: earlyDepartureDeductions,
          totalPenaltyDeduction: Math.round(totalDeductionAmount),
        },
        approvedOvertimeHours: parseFloat(approvedOvertimeHours.toFixed(1)),
        overtimePay: Math.round(overtimePay),
        totalPayout: Math.round(netSalary),
      };
    });

    return res.status(200).json({
      month: selectedMonth,
      totalDaysInMonth,
      totalSundays,
      totalFestivalHolidays,
      totalWorkingDaysInMonth,
      payroll: payrollReport,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Payroll calculation failed', error: error.message });
  }
};