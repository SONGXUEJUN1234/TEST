import React, { createContext, useContext, useMemo, useState } from 'react';

const AppContext = createContext({ refreshKey: 0, refresh: () => {} });

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const value = useMemo(() => ({ refreshKey, refresh: () => setRefreshKey((x) => x + 1) }), [refreshKey]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppRefresh = () => useContext(AppContext);
