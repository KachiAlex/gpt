import { createContext, useContext, useEffect, useState } from 'react';
import { getInstance, loadInstance } from '../services/instance';

const InstanceContext = createContext(getInstance());

export function InstanceProvider({ children }) {
  const [config, setConfig] = useState(getInstance());

  useEffect(() => {
    loadInstance().then(setConfig);
  }, []);

  return (
    <InstanceContext.Provider value={config}>
      {children}
    </InstanceContext.Provider>
  );
}

export const useInstance = () => useContext(InstanceContext);
