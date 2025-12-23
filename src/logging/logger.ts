import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

const logger = winston.createLogger({
  level: 'info',
  format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })),
  transports: [
    // Log error and above to file
    new winston.transports.File({
      filename: 'discos-error.log',
      level: 'error',
      format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),

    // Log info and above to file
    new winston.transports.File({ filename: 'discos.log', format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat) }),

    // Console logs
    new winston.transports.Console({
      format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    }),
  ],
});

export default logger;
