# Preserve steering bits with integer fixed divisors

Opus found that a reciprocal scale changes half-step rounding and 24
of the 256 byte decodes by an ulp. Use an integer divisor: encode is
round(value * divisor) - offset; decode is (word + offset) / divisor.
The public wire quantiseCommand delegates to this codec, including all
four steering axes. The frozen v0 codec stays independent as the oracle;
no original engine codec body or golden byte changes. Engine adoption
still belongs to the gated WR rows, never these package-only WS rows.

Tests cover every byte, all 256 half steps with adjacent representable
inputs, full command parity against independent frozen v0, explicit
old-reciprocal disagreement and refusal of a reciprocal descriptor.
The manually described lock forms now say integer divisor127 instead
of reciprocal1/127. The real schema hash remains3951578209.
Strict lint/types and all55 package checks pass before the normal push.
