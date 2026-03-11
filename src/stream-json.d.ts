declare module 'stream-chain' {
  import { Duplex } from 'stream';
  function chain(streams: unknown[]): Duplex;
}

declare module 'stream-json' {
  import { Transform } from 'stream';
  function make(options?: object): Transform;
  export default make;
}

declare module 'stream-json/filters/Pick' {
  import { Transform } from 'stream';
  interface PickOptions {
    filter?: string | RegExp | ((stack: unknown, chunk: unknown) => boolean);
    pathSeparator?: string;
    once?: boolean;
  }
  function pick(options?: PickOptions): Transform;
  export { pick };
}

declare module 'stream-json/streamers/StreamValues' {
  import { Transform } from 'stream';
  function streamValues(): Transform;
  export { streamValues };
}
