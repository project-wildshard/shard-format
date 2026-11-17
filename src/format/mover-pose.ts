/* oxlint-disable curly, id-length, import/group-exports, max-statements, no-magic-numbers, prefer-named-capture-group, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- verbatim port of the engine's law (SDK-SPLIT SP4); golden vectors pin it, so it keeps the engine's form */
/** SDK-SPLIT SP4f1 (Q35): a kinematic mover's published pose and boxes (from engine `shared/engine/physics/mover.ts`) and the
 *  observations a channel program copies from it (`moverChannelValues`, from `client/game/plugin/clientChannelView.ts`): the
 *  map raster's rest pose and the page's read one law. The Rapier body stays engine. */

/** Local boxes for a script-owned platform; the physics layer alone constructs Rapier descriptors. */
export interface MoverBox {
  x: number
  y: number
  z: number
  hx: number
  hy: number
  hz: number
  rot: { x: number; y: number; z: number; w: number }
}
/** Published mover pose, in the world's local frame; Euler order is always YXZ. */
export interface MoverPose {
  position: { x: number; y: number; z: number }
  euler: { x: number; y: number; z: number }
  enabled: boolean
}

/** Copy only the fixed mover ABI's published observations, never its world or module memory. */
export function moverChannelValues(
  reads: readonly string[],
  pose: MoverPose,
  fields: Readonly<Record<number, number>>,
): number[] {
  return reads.map(read => {
    if (read === 'enabled') return Number(pose.enabled)
    if (read.startsWith('position.')) {
      const axis = read.slice(9)
      if (axis === 'x' || axis === 'y' || axis === 'z')
        return pose.position[axis]
    }
    if (read.startsWith('euler.')) {
      const axis = read.slice(6)
      if (axis === 'x' || axis === 'y' || axis === 'z') return pose.euler[axis]
    }
    const field = /^field\.([1-6])$/u.exec(read),
      key = field?.[1]
    const value = key === undefined ? undefined : fields[Number(key)]
    if (value === undefined) throw new Error('Missing copied mover field')
    return value
  })
}
