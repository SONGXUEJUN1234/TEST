export const todayRange = () => {
  const d = new Date();
  d.setHours(0,0,0,0);
  const start = d.getTime();
  return [start, start + 24*3600*1000 - 1] as const;
};
