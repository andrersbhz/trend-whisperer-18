type PerformanceLog = {
  label: string;
  duration: number;
  timestamp: string;
};

const logs: PerformanceLog[] = [];

export const monitorPerformance = async <T>(label: string, task: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  try {
    const result = await task();
    const duration = performance.now() - start;
    
    const log = {
      label,
      duration: Math.round(duration),
      timestamp: new Date().toISOString()
    };
    
    logs.push(log);
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Performance] ${label}: ${log.duration}ms`);
    }
    
    // Keep only last 100 logs
    if (logs.length > 100) logs.shift();
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`[Performance Error] ${label} failed after ${Math.round(duration)}ms`, error);
    throw error;
  }
};

export const getPerformanceLogs = () => [...logs];

// Simple Cache Utility
const cache: Record<string, { data: any; expiry: number }> = {};

export const withCache = async <T>(
  key: string, 
  ttlSeconds: number, 
  task: () => Promise<T>
): Promise<T> => {
  const now = Date.now();
  if (cache[key] && cache[key].expiry > now) {
    if (import.meta.env.DEV) console.log(`[Cache Hit] ${key}`);
    return cache[key].data;
  }

  const data = await task();
  cache[key] = {
    data,
    expiry: now + (ttlSeconds * 1000)
  };
  return data;
};

export const clearCache = (key?: string) => {
  if (key) delete cache[key];
  else {
    Object.keys(cache).forEach(k => delete cache[k]);
  }
};
