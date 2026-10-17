import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const barData = [
  { name: 'Ikeja', total: 24, completed: 18 },
  { name: 'Eti-Osa', total: 18, completed: 10 },
  { name: 'Alimosho', total: 16, completed: 8 },
  { name: 'Surulere', total: 14, completed: 7 },
  { name: 'Ikorodu', total: 12, completed: 9 },
  { name: 'Kosofe', total: 10, completed: 5 },
  { name: 'Oshodi', total: 8, completed: 4 },
];

const pieData = [
  { name: 'Completed', value: 45, color: '#22c55e' },
  { name: 'In Progress', value: 30, color: '#f59e0b' },
  { name: 'Delayed', value: 15, color: '#ef4444' },
  { name: 'Not Started', value: 10, color: '#6b7280' },
];

export default function ProjectStatusChart({ type = 'bar' }) {
  if (type === 'pie') {
    return (
      <div className="card">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Project Status</h3>
          <p className="text-sm text-gray-600">Distribution by status</p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="ml-8 space-y-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center space-x-3">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: item.color }}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.value}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Project Status Distribution</h3>
        <p className="text-sm text-gray-600">Distribution of projects by current status</p>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis 
            dataKey="name" 
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke="#6b7280"
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
          />
          <Bar dataKey="total" fill="#0ea5e9" name="Total Projects" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" fill="#22c55e" name="Completed Projects" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
