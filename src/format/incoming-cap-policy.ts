import {
  array,
  check,
  exactOptional,
  maxLength,
  minLength,
  parse,
  pipe,
  strictObject,
  string,
} from 'valibot'

import type { GenericSchema } from 'valibot'

/** Exact source tags that bypass the incoming cap; never wildcard patterns. */
interface IncomingCapPolicy {
  readonly capExempt?: readonly string[]
  readonly capExemptTags?: readonly string[]
}
const MAX_ALIASES = 256
const MAX_ALIAS_LENGTH = 512
const TAGS_PER_ALIAS = 2
const MAX_TAGS = MAX_ALIASES * TAGS_PER_ALIAS
const CREATURE_PREFIX = 'creature.'
const MIN_ALIAS_LENGTH = 1
const alias = pipe(
  string(),
  minLength(MIN_ALIAS_LENGTH),
  maxLength(MAX_ALIAS_LENGTH),
)
const aliases = pipe(array(alias), maxLength(MAX_ALIASES))
const exactTag = pipe(
  string(),
  maxLength(MAX_ALIAS_LENGTH + CREATURE_PREFIX.length),
  check((tag: string): boolean => tag.includes('.'), 'exact dotted combat tag'),
)
const exactTags = array(exactTag)
const IncomingCapTagsSchema: GenericSchema<string[]> = pipe(
  exactTags,
  maxLength(MAX_TAGS),
  check<string[], 'unique exact combat tags'>(
    (tags: readonly string[]): boolean => new Set(tags).size === tags.length,
    'unique exact combat tags',
  ),
)

function lowerAliases(values: readonly string[]): string[] {
  const tags = new Set<string>()
  for (const value of values) {
    if (value.includes('.')) {
      tags.add(value)
    }
    tags.add(`${CREATURE_PREFIX}${value}`)
  }
  return [...tags]
}

/** Both fields may travel to older readers, but must describe identical behavior. */
function incomingCapPolicyAgrees(policy: IncomingCapPolicy): boolean {
  if (policy.capExempt === undefined || policy.capExemptTags === undefined) {
    return true
  }
  const expected = new Set(lowerAliases(policy.capExempt))
  return (
    expected.size === policy.capExemptTags.length &&
    policy.capExemptTags.every((tag: string): boolean => expected.has(tag))
  )
}
interface AdmittedIncomingCapPolicy {
  capExempt?: string[]
  capExemptTags?: string[]
}
const policyFields = strictObject({
  capExempt: exactOptional(aliases),
  capExemptTags: exactOptional(IncomingCapTagsSchema),
})
const policySchema: GenericSchema<AdmittedIncomingCapPolicy> = pipe(
  policyFields,
  check<
    AdmittedIncomingCapPolicy,
    'matching legacy and exact incoming-cap policy'
  >(incomingCapPolicyAgrees, 'matching legacy and exact incoming-cap policy'),
)

/** Compile once at admission. Request/state/effect tags still match exactly at hit time. */
function compileIncomingCapPolicy(policy: IncomingCapPolicy): string[] {
  const admitted = parse(policySchema, {
    ...(policy.capExempt === undefined ? {} : { capExempt: policy.capExempt }),
    ...(policy.capExemptTags === undefined
      ? {}
      : { capExemptTags: policy.capExemptTags }),
  })
  return admitted.capExemptTags ?? lowerAliases(admitted.capExempt ?? [])
}

export {
  IncomingCapTagsSchema,
  compileIncomingCapPolicy,
  incomingCapPolicyAgrees,
}
export type { IncomingCapPolicy }
