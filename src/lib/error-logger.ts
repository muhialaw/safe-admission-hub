export const logError = (message: string, error: unknown) => {
  console.error(message, error);
  // You can add more sophisticated error logging here
  // e.g., send to logging service, Sentry, etc.
};

export const logInfo = (message: string, data?: unknown) => {
  console.log(message, data);
};

export const logWarn = (message: string, data?: unknown) => {
  console.warn(message, data);
};
