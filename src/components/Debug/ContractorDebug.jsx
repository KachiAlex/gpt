import { useContractors } from '../../contexts/ContractorsContext';

export default function ContractorDebug() {
  const { contractors, addContractor } = useContractors();

  const clearContractors = () => {
    localStorage.removeItem('gpt_contractors');
    localStorage.removeItem('abt_contractors');
    window.location.reload();
  };

  const logContractors = () => {
    console.log('Current contractors in context:', contractors);
    console.log('Contractors in localStorage:', localStorage.getItem('gpt_contractors'));
  };

  const testAddContractor = () => {
    const testData = {
      companyName: 'Test Company',
      email: 'test@company.com',
      phone: '+234 800 123 4567',
      contactPerson: 'Test Person',
      specialization: 'Road Construction',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    console.log('Testing addContractor with:', testData);
    addContractor(testData);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-red-100 border border-red-300 rounded-lg p-4 z-50">
      <h3 className="font-bold text-red-800 mb-2">Debug Tools</h3>
      <div className="space-y-2">
        <div className="text-sm text-red-700">
          Contractors: {contractors.length}
        </div>
        <button
          onClick={logContractors}
          className="block w-full px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          Log to Console
        </button>
        <button
          onClick={testAddContractor}
          className="block w-full px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
        >
          Test Add
        </button>
        <button
          onClick={clearContractors}
          className="block w-full px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
        >
          Clear & Reset
        </button>
      </div>
    </div>
  );
}
