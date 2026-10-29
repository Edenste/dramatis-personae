export interface CliArgs {
  dataPath?: string;
  port?: number;
  host?: string;
  /** The built web app to serve. */
  webRoot?: string;
  dev: boolean;
}

export const USAGE = `Usage: dramatis-personae-server [options]

  --data-path <dir>  Where worlds, backups and logs live (or DRAMATIS_DATA_PATH)
  --port <n>         Port to listen on (default: options.json, then 30300)
  --host <address>   Address to listen on (default: 127.0.0.1)
  --web-root <dir>   The built web app to serve (default: apps/web/dist when present)
  --dev              Use the development data folder (or DRAMATIS_DEV=1)`;

function fail(message: string): never {
  throw new Error(`${message}\n\n${USAGE}`);
}

/** Reads the headless server's flags; `--flag value` and `--flag=value` both work. */
export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dev: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") continue; // pnpm passes its own separator through
    if (arg === "--dev") {
      args.dev = true;
      continue;
    }
    const [flag, inline] = arg.includes("=") ? arg.split(/=(.*)/s, 2) : [arg, undefined];
    const value = () => {
      const next = inline ?? argv[++i];
      if (next === undefined || next === "") fail(`${flag} needs a value`);
      return next;
    };
    switch (flag) {
      case "--data-path":
        args.dataPath = value();
        break;
      case "--host":
        args.host = value();
        break;
      case "--web-root":
        args.webRoot = value();
        break;
      case "--port": {
        const port = Number(value());
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          fail("--port must be a whole number from 0 to 65535");
        }
        args.port = port;
        break;
      }
      default:
        fail(`Unknown option ${arg}`);
    }
  }
  return args;
}
