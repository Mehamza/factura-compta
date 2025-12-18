type LogFn = (...args: unknown[]) => void;

const isProd = import.meta.env.PROD;

const noop: LogFn = () => {};

export const logger: {
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
} = {
  debug: isProd ? noop : (...args) => console.debug(...args),
  info: isProd ? noop : (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: isProd ? noop : (...args) => console.error(...args),
};
