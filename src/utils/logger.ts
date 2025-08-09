import { Logger } from 'tslog';
import { createStream } from 'rotating-file-stream';

const stream = createStream('tslog.log', {
  size: '10M', // rotate every 10 MegaBytes written
  interval: '7d', // rotate weekly
  compress: 'gzip' // compress rotated files
});

const logger = new Logger({
  prettyLogTemplate:
    '{{yyyy}}.{{mm}}.{{dd}} {{hh}}:{{MM}}:{{ss}}:{{ms}}\t{{logLevelName}}\t[{{filePathWithLine}}{{name}}]\t',
  prettyErrorTemplate:
    '\n{{errorName}} {{errorMessage}}\nerror stack:\n{{errorStack}}',
  prettyErrorStackTemplate:
    '  • {{fileName}}\t{{method}}\n\t{{filePathWithLine}}',
  prettyErrorParentNamesSeparator: ':',
  prettyErrorLoggerNameDelimiter: '\t',
  stylePrettyLogs: true,
  prettyLogTimeZone: 'UTC',
  prettyLogStyles: {
    logLevelName: {
      '*': ['bold', 'black', 'bgWhiteBright', 'dim'],
      SILLY: ['bold', 'white'],
      TRACE: ['bold', 'whiteBright'],
      DEBUG: ['bold', 'green'],
      INFO: ['bold', 'blue'],
      WARN: ['bold', 'yellow'],
      ERROR: ['bold', 'red'],
      FATAL: ['bold', 'redBright']
    },
    dateIsoStr: 'white',
    filePathWithLine: 'white',
    name: ['white', 'bold'],
    nameWithDelimiterPrefix: ['white', 'bold'],
    nameWithDelimiterSuffix: ['white', 'bold'],
    errorName: ['bold', 'bgRedBright', 'whiteBright'],
    fileName: ['yellow']
  }
});

logger.attachTransport((logObj) => {
  stream.write(JSON.stringify(logObj) + '\n');
});

export default logger;
