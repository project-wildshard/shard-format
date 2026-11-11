/* oxlint-disable typescript/prefer-readonly-parameter-types -- frozen v0's captured inputs and FrameInput are mutable types */
import { textBytes } from './frame-data.ts'
import { readPacketInput } from './packet-input.ts'
import { taggedFrameBytes } from './tagged-bytes.ts'
import { frameCodec } from './v1-frames.ts'
import { helloPacket, welcomePacket } from './v1-handshake.ts'
import { actPacket, commandsPacket, eventsPacket } from './v1-records.ts'

import type { PreparedTraffic, Task } from './benchmark-data.ts'
import type { CapturedSession } from './session-data.ts'
import type { V1Packet } from './v1-packet.ts'

// WB2: the same real traffic as WS3's v0 benchmark, through the v1 codec.
// Each captured packet is decoded by frozen v0 outside timing, said the v1
// way, and its v1 encode and decode become the timed work; the codecs a
// receiver compiles once per peer table are compiled once here too.

/** Which bytes to count: v1's tables, or the per-field-tag shape (5.6). */
type Shape = 'tables' | 'tags'
type Codec = ReturnType<typeof frameCodec>
type Fields = Pick<Task, 'direction' | 'delivered'>

/** One captured v0 packet as v1 work. */
function v1Packet(text: string): V1Packet {
  const input = readPacketInput(textBytes(text))
  switch (input.kind) {
    case 'hello': {
      return helloPacket(input.value)
    }
    case 'welcome': {
      return welcomePacket(input.value)
    }
    case 'commands': {
      return commandsPacket(input.value)
    }
    case 'act': {
      return actPacket(input.value)
    }
    case 'events': {
      return eventsPacket(input.value)
    }
    default: {
      throw new Error('Unknown captured packet')
    }
  }
}

/** A frame's bytes in the chosen shape. */
const frameSize = (frame: Codec, shape: Shape): number =>
  shape === 'tags'
    ? taggedFrameBytes(frame.seen, frame.bytes.byteLength)
    : frame.bytes.byteLength

function frameTask(fields: Fields, frame: Codec, shape: Shape): Task {
  return {
    ...fields,
    stream: 'frame',
    bytes: frameSize(frame, shape),
    payload: {
      frame: {
        bytes: frame.bytes,
        encode: (): ArrayBuffer => frame.encode().buffer,
        decode: frame.decode,
      },
    },
  }
}

function packetTask(fields: Fields, text: string, shape: Shape): Task {
  const v1 = v1Packet(text)
  const encode = (): ArrayBuffer => v1.encode().buffer
  return {
    ...fields,
    stream: v1.stream,
    bytes: shape === 'tags' ? v1.tagged : v1.bytes.byteLength,
    payload: {
      packet: {
        stream: v1.stream,
        encode,
        encodeWith: encode,
        decode: v1.decode,
      },
    },
  }
}

/** A captured session's traffic, as v1 work for `measureTraffic`; `tags` counts the per-field-tag shape's bytes instead. */
function prepareV1Traffic(
  session: CapturedSession,
  shape: Shape = 'tables',
): PreparedTraffic {
  const frames = session.frames.map(frameCodec)
  const tasks = session.packets.map(
    (packet: CapturedSession['packets'][number]): Task => {
      const fields = {
        direction: packet.direction,
        delivered: packet.delivered,
      }
      if (!('frame' in packet)) {
        return packetTask(fields, packet.packet.bytes, shape)
      }
      const frame = frames[packet.frame]
      if (frame === undefined) {
        throw new Error('Missing captured frame')
      }
      return frameTask(fields, frame, shape)
    },
  )
  return {
    product: session.product,
    ticks: session.ticks,
    tasks,
    frameBytes: frames.map((frame: Codec): number => frameSize(frame, shape)),
  }
}

export { prepareV1Traffic }
