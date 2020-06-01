import { createLogger, format, transports, level } from 'winston';
import { inspect } from 'util';

export const getLogger = ({ file, con }: {
    con?: {
        level: string;
    },
    file?: {
        name: string;
        level: string;
    }
}) => createLogger({
    level: con?.level || file?.level, // TODO choose lower log level out of two
    format: format.combine(
        format.timestamp(),
        format.printf((info: any) => {
            const timestamp = info.timestamp.trim();
            const mLevel = info.level;
            const message = (info.message || '').trim();
            const args = info[Symbol.for('splat')];
            const strArgs = (args || []).map((arg: any) => {
                return inspect(arg, {
                    colors: true
                });
            }).join(' ');
            return `[${timestamp}] ${mLevel} ${message} ${strArgs}`;
        })
    ),
    transports: [
        ...(file ? [new transports.File({ filename: file.name, level: file.level })] : []),
        ...(con ? [new transports.Console()] : [])
    ]
});
