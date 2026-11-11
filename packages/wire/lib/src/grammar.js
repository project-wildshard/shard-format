// WIRE-STABILITY 5.3: the closed recursive grammar of wire major 1. Every
// node has a typed default and a bounded size, so a receiver can skip what it
// has no slot for. Adding a node kind is a major; adding a field, arm, record,
// class or enum value is a minor. Codecs for these nodes arrive in WR3/WR4.
export {};
