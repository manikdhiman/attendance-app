const Rules = () => {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Company Rules & Regulations</h1>
      
      <div className="space-y-6 bg-white p-6 rounded-lg shadow border border-gray-100">
        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">1. Working Hours & Punctuality</h2>
          <p className="text-gray-600 leading-relaxed">
            Standard shifts are 8 hours per day. Employees must mark check-in upon starting work and check-out at the end of the day.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">2. Daily Task Logging</h2>
          <p className="text-gray-600 leading-relaxed">
            Every employee is required to log their daily task summary before checkout to ensure transparent productivity metrics.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">3. Overtime Policy</h2>
          <p className="text-gray-600 leading-relaxed">
            Overtime hours must be logged on the shift entry. Overtime claims will remain in a "PENDING" status until reviewed and approved by an administrator.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Rules;