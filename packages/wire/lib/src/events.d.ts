/** The events in an `events` record, by their v0 event tags. */
declare const WIRE_EVENTS: readonly [{
    readonly id: 1;
    readonly name: 'spawn';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'handle';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 2;
        readonly name: 'cls';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 8;
        };
    }, {
        readonly id: 3;
        readonly name: 'id';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }];
    readonly tail: 'class-columns';
}, {
    readonly id: 2;
    readonly name: 'despawn';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'handle';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 3;
    readonly name: 'hit';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'target';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 3;
        readonly name: 'amount';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly id: 4;
        readonly name: 'at';
        readonly node: {
            readonly kind: 'struct';
            readonly fields: readonly [{
                readonly id: 1;
                readonly name: 'x';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -260;
                    readonly max: 260;
                    readonly bits: 16;
                };
            }, {
                readonly id: 2;
                readonly name: 'y';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -260;
                    readonly max: 260;
                    readonly bits: 16;
                };
            }, {
                readonly id: 3;
                readonly name: 'z';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -260;
                    readonly max: 260;
                    readonly bits: 16;
                };
            }];
        };
    }, {
        readonly id: 5;
        readonly name: 'head';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 6;
        readonly name: 'killed';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 7;
        readonly name: 'blow';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 8;
        readonly name: 'confirmFor';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 4;
    readonly name: 'died';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'id';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 3;
        readonly name: 'by';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 4;
        readonly name: 'dir';
        readonly node: {
            readonly kind: 'struct';
            readonly fields: readonly [{
                readonly id: 1;
                readonly name: 'x';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -1;
                    readonly max: 1;
                    readonly bits: 8;
                };
            }, {
                readonly id: 2;
                readonly name: 'y';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -1;
                    readonly max: 1;
                    readonly bits: 8;
                };
            }, {
                readonly id: 3;
                readonly name: 'z';
                readonly node: {
                    readonly kind: 'quant';
                    readonly min: -1;
                    readonly max: 1;
                    readonly bits: 8;
                };
            }];
        };
    }, {
        readonly id: 5;
        readonly name: 'impulse';
        readonly node: {
            readonly kind: 'f32';
        };
    }];
}, {
    readonly id: 5;
    readonly name: 'quest';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'quest';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 3;
        readonly name: 'started';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 4;
        readonly name: 'step';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        };
    }, {
        readonly id: 5;
        readonly name: 'n';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 6;
    readonly name: 'phase';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'flag';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 3;
        readonly name: 'on';
        readonly node: {
            readonly kind: 'bool';
        };
    }];
}, {
    readonly id: 7;
    readonly name: 'reward';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'coins';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 3;
        readonly name: 'body';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 4;
        readonly name: 'item';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        };
    }];
}, {
    readonly id: 8;
    readonly name: 'travel';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'from';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 3;
        readonly name: 'to';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 9;
    readonly name: 'ledger';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'serial';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 3;
        readonly name: 'id';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 4;
        readonly name: 'grant';
        readonly node: {
            readonly kind: 'enum';
            readonly values: readonly ["fact", "coins", "item"];
            readonly default: 'fact';
        };
    }, {
        readonly id: 5;
        readonly name: 'name';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 6;
        readonly name: 'amount';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly id: 7;
        readonly name: 'pending';
        readonly node: {
            readonly kind: 'bool';
        };
    }];
}, {
    readonly id: 10;
    readonly name: 'chat';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'line';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 3;
        readonly name: 'channel';
        readonly node: {
            readonly kind: 'enum';
            readonly values: readonly ["room", "proximity"];
            readonly default: 'room';
        };
    }, {
        readonly id: 4;
        readonly name: 'from';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 5;
        readonly name: 'name';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 6;
        readonly name: 'text';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }];
}, {
    readonly id: 11;
    readonly name: 'mount';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'rider';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 3;
        readonly name: 'mount';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 4;
        readonly name: 'seq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 12;
    readonly name: 'dismount';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'rider';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 3;
        readonly name: 'mount';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 4;
        readonly name: 'seq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
}, {
    readonly id: 13;
    readonly name: 'owned';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'name';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 3;
        readonly name: 'value';
        readonly node: {
            readonly kind: 'f32';
        };
    }];
}, {
    readonly id: 14;
    readonly name: 'view';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'name';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
    }, {
        readonly id: 3;
        readonly name: 'args';
        readonly node: {
            readonly kind: 'array';
            readonly node: {
                readonly kind: 'f32';
            };
            readonly maxCount: 255;
        };
    }];
}, {
    readonly id: 15;
    readonly name: 'player-died';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'id';
        readonly node: {
            readonly kind: 'ref';
        };
    }, {
        readonly id: 3;
        readonly name: 'checkpoint';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 4;
        readonly name: 'cause';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'struct';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'kind';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'label';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }, {
                    readonly id: 3;
                    readonly name: 'text';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'text';
                            readonly maxBytes: 255;
                        };
                    };
                }];
            };
        };
    }];
}];
export { WIRE_EVENTS };
