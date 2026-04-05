export const getTs = (val: any) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? (Number(val) || 0) : d.getTime();
  }
  if (val._seconds) return val._seconds * 1000;
  if (val.seconds) return val.seconds * 1000;
  if (val.toDate) return val.toDate().getTime();
  if (val instanceof Date) return val.getTime();
  return Number(val) || 0;
};

export const formatDuration = (sec: number) => {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const formatRemaining = (ms: number): string => {
  if (ms <= 0) return "00:00";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatTime = (ms: number) => {
  if (ms <= 0) return "Pronto!";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}m ${String(s % 60).padStart(2, '0')}s`;
  if (m > 0) return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `00:${String(s).padStart(2, '0')}`;
};
