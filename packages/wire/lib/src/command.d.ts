import type { NetCommand } from '../frozen/v0/netCommand.ts';
/** The wire-owned command quantization; frozen v0 stays independent. */
declare function quantiseCommand<Command extends Pick<NetCommand, 'steer' | 'yaw' | 'pitch'>>(command: Command): Command;
export { quantiseCommand };
