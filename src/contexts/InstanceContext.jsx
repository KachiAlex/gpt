import { createContext, useContext, useEffect, useState } from 'react';
import { getInstance, loadInstance, getStages, loadStages } from '../services/instance';

const InstanceContext = createContext({ ...getInstance(), stages: getStages() });

export function InstanceProvider({ children }) {
  const [config, setConfig] = useState(getInstance());
  const [stages, setStages] = useState(getStages());

  useEffect(() => {
    loadInstance().then(setConfig);
    loadStages().then(setStages);
  }, []);

  return (
    <InstanceContext.Provider value={{ ...config, stages, refreshWorkflow: () => loadStages(true).then(setStages) }}>
      {children}
    </InstanceContext.Provider>
  );
}

export const useInstance = () => useContext(InstanceContext);
