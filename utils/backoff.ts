const INITIAL_RETRY_DELAY = 2000; // 2 seconds
const MAX_RETRIES = 4;

export const getBackoffDelay = (attempt: number): number => {
  return Math.min(INITIAL_RETRY_DELAY * Math.pow(2, attempt), 30000); // Cap at 30 seconds
};

export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
}; 