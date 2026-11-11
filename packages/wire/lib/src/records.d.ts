/** The top-level message tags (`MSG_*`). */
declare const WIRE_MESSAGES: readonly [{
    readonly id: 1;
    readonly name: 'hello';
    readonly singleton: true;
}, {
    readonly id: 2;
    readonly name: 'cmds';
    readonly singleton: true;
}, {
    readonly id: 3;
    readonly name: 'act';
    readonly singleton: true;
}, {
    readonly id: 4;
    readonly name: 'welcome';
    readonly singleton: true;
}, {
    readonly id: 5;
    readonly name: 'frame';
    readonly singleton: true;
}, {
    readonly id: 6;
    readonly name: 'events';
    readonly singleton: false;
}];
/** `hello`: the client's version, identity and tables (5.3). */
declare const HELLO: {
    readonly id: 1;
    readonly name: 'hello';
    readonly fields: readonly [{
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 1;
        readonly name: 'minor';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'text';
        readonly id: 2;
        readonly name: 'build';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'text';
        readonly id: 3;
        readonly name: 'player';
        readonly required: true;
    }, {
        readonly wire: 'bytes';
        readonly holds: 'text';
        readonly id: 4;
        readonly name: 'name';
    }, {
        readonly id: 5;
        readonly name: 'ledger';
        readonly wire: 'uvarint';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'ids';
        readonly id: 6;
        readonly name: 'capabilities';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'tables';
        readonly id: 7;
        readonly name: 'commandTable';
        readonly required: true;
    }, {
        readonly wire: 'bytes';
        readonly holds: 'tables';
        readonly id: 8;
        readonly name: 'actTable';
        readonly required: true;
    }];
};
/** `welcome`: the server's version, the seat, and its tables (5.3). */
declare const WELCOME: {
    readonly id: 4;
    readonly name: 'welcome';
    readonly fields: readonly [{
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 1;
        readonly name: 'minor';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'text';
        readonly id: 2;
        readonly name: 'build';
    }, {
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 3;
        readonly name: 'handle';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'text';
        readonly id: 4;
        readonly name: 'player';
        readonly required: true;
    }, {
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 5;
        readonly name: 'tick';
    }, {
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 6;
        readonly name: 'cell';
    }, {
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 7;
        readonly name: 'simHz';
    }, {
        readonly wire: 'uvarint';
        readonly required: true;
        readonly id: 8;
        readonly name: 'frameHz';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'ids';
        readonly id: 9;
        readonly name: 'capabilities';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'ids';
        readonly id: 10;
        readonly name: 'requiredCapabilities';
    }, {
        readonly id: 11;
        readonly name: 'tableHash';
        readonly wire: 'fixed32';
        readonly required: true;
    }, {
        readonly wire: 'bytes';
        readonly holds: 'tables';
        readonly id: 12;
        readonly name: 'classTables';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'tables';
        readonly id: 13;
        readonly name: 'eventTables';
    }, {
        readonly wire: 'bytes';
        readonly holds: 'tables';
        readonly id: 14;
        readonly name: 'rideLawTables';
    }];
};
/** The climate act's ops. */
declare const CLIMATE_OPS: readonly ['mode', 'force', 'time', 'day'];
/** Every act a client may send, by its v0 act tag (format's and engine's). */
declare const WIRE_ACTS: {
    readonly kind: 'union';
    readonly bits: 8;
    readonly default: 'interact';
    readonly arms: readonly [{
        readonly id: 1;
        readonly name: 'interact';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'id';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        }];
    }, {
        readonly id: 2;
        readonly name: 'reload';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'slot';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 8;
            };
        }];
    }, {
        readonly id: 3;
        readonly name: 'equip';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'slot';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 8;
            };
        }];
    }, {
        readonly id: 4;
        readonly name: 'chat';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'channel';
            readonly node: {
                readonly kind: 'enum';
                readonly values: readonly ["room", "proximity"];
                readonly default: 'room';
            };
        }, {
            readonly id: 2;
            readonly name: 'text';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        }];
    }, {
        readonly id: 5;
        readonly name: 'report';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'line';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 32;
            };
        }];
    }, {
        readonly id: 6;
        readonly name: 'ride';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'action';
            readonly node: {
                readonly kind: 'enum';
                readonly values: readonly ["offer", "mount", "dismount"];
                readonly default: 'offer';
            };
        }];
    }, {
        readonly id: 7;
        readonly name: 'climate';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'op';
            readonly node: {
                readonly kind: 'enum';
                readonly values: readonly ["mode", "force", "time", "day"];
                readonly default: 'mode';
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
            readonly name: 'at';
            readonly node: {
                readonly kind: 'f32';
            };
        }];
    }, {
        readonly id: 8;
        readonly name: 'buy';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'good';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 16;
            };
        }];
    }, {
        readonly id: 9;
        readonly name: 'board';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'op';
            readonly node: {
                readonly kind: 'enum';
                readonly values: readonly ["claim", "tear"];
                readonly default: 'claim';
            };
        }, {
            readonly id: 2;
            readonly name: 'slot';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 16;
            };
        }];
    }, {
        readonly id: 10;
        readonly name: 'wear';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'id';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        }];
    }, {
        readonly id: 11;
        readonly name: 'pose';
        readonly fields: readonly [{
            readonly id: 1;
            readonly name: 'names';
            readonly node: {
                readonly kind: 'text';
                readonly maxBytes: 255;
            };
        }];
    }];
};
/** One client sim step of input (`NetCommand`), in the 5.3 grammar. */
declare const WIRE_COMMAND: {
    readonly kind: 'struct';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'seq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 2;
        readonly name: 'viewTick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 3;
        readonly name: 'steer';
        readonly node: {
            readonly kind: 'struct';
            readonly fields: readonly [{
                readonly id: 1;
                readonly name: 'keyX';
                readonly node: {
                    readonly kind: 'fixed';
                    readonly bits: 8;
                    readonly divisor: 127;
                    readonly offset: -128;
                };
            }, {
                readonly id: 2;
                readonly name: 'keyY';
                readonly node: {
                    readonly kind: 'fixed';
                    readonly bits: 8;
                    readonly divisor: 127;
                    readonly offset: -128;
                };
            }, {
                readonly id: 3;
                readonly name: 'stickX';
                readonly node: {
                    readonly kind: 'fixed';
                    readonly bits: 8;
                    readonly divisor: 127;
                    readonly offset: -128;
                };
            }, {
                readonly id: 4;
                readonly name: 'stickY';
                readonly node: {
                    readonly kind: 'fixed';
                    readonly bits: 8;
                    readonly divisor: 127;
                    readonly offset: -128;
                };
            }];
        };
    }, {
        readonly id: 4;
        readonly name: 'yaw';
        readonly node: {
            readonly kind: 'angle';
            readonly bits: 16;
        };
    }, {
        readonly id: 5;
        readonly name: 'pitch';
        readonly node: {
            readonly kind: 'quant';
            readonly min: number;
            readonly max: number;
            readonly bits: 16;
        };
    }, {
        readonly id: 6;
        readonly name: 'buttons';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 8;
        };
    }, {
        readonly id: 7;
        readonly name: 'buttonsHigh';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 8;
            };
        };
    }, {
        readonly id: 8;
        readonly name: 'attack';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'struct';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'targetId';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'ref';
                        };
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'aim';
                    readonly node: {
                        readonly kind: 'struct';
                        readonly fields: readonly [{
                            readonly id: 1;
                            readonly name: 'origin';
                            readonly node: {
                                readonly kind: 'struct';
                                readonly fields: readonly [{
                                    readonly id: 1;
                                    readonly name: 'x';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }, {
                                    readonly id: 2;
                                    readonly name: 'y';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }, {
                                    readonly id: 3;
                                    readonly name: 'z';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }];
                            };
                        }, {
                            readonly id: 2;
                            readonly name: 'direction';
                            readonly node: {
                                readonly kind: 'struct';
                                readonly fields: readonly [{
                                    readonly id: 1;
                                    readonly name: 'x';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }, {
                                    readonly id: 2;
                                    readonly name: 'y';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }, {
                                    readonly id: 3;
                                    readonly name: 'z';
                                    readonly node: {
                                        readonly kind: 'f32';
                                    };
                                }];
                            };
                        }];
                    };
                }];
            };
        };
    }, {
        readonly id: 9;
        readonly name: 'heavyTarget';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'ref';
            };
        };
    }, {
        readonly id: 10;
        readonly name: 'lockTarget';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'ref';
            };
        };
    }, {
        readonly id: 11;
        readonly name: 'hookTarget';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'uint';
                readonly bits: 16;
            };
        };
    }, {
        readonly id: 12;
        readonly name: 'launcher';
        readonly node: {
            readonly kind: 'optional';
            readonly node: {
                readonly kind: 'struct';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'slot';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 5;
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'ads';
                    readonly node: {
                        readonly kind: 'quant';
                        readonly min: 0;
                        readonly max: 1;
                        readonly bits: 8;
                    };
                }, {
                    readonly id: 3;
                    readonly name: 'fire';
                    readonly node: {
                        readonly kind: 'bool';
                    };
                }];
            };
        };
    }];
};
/** The most commands one `cmds` bundle carries (`MAX_BUNDLE`). */
declare const MAX_BUNDLE = 7;
/** The single-record bodies: `cmds`, `act`, `frame` and `events`. */
declare const WIRE_RECORDS: readonly [{
    readonly id: 2;
    readonly name: 'cmds';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'ackFrame';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'commands';
        readonly node: {
            readonly kind: 'array';
            readonly node: {
                readonly kind: 'struct';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'seq';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 16;
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'viewTick';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 16;
                    };
                }, {
                    readonly id: 3;
                    readonly name: 'steer';
                    readonly node: {
                        readonly kind: 'struct';
                        readonly fields: readonly [{
                            readonly id: 1;
                            readonly name: 'keyX';
                            readonly node: {
                                readonly kind: 'fixed';
                                readonly bits: 8;
                                readonly divisor: 127;
                                readonly offset: -128;
                            };
                        }, {
                            readonly id: 2;
                            readonly name: 'keyY';
                            readonly node: {
                                readonly kind: 'fixed';
                                readonly bits: 8;
                                readonly divisor: 127;
                                readonly offset: -128;
                            };
                        }, {
                            readonly id: 3;
                            readonly name: 'stickX';
                            readonly node: {
                                readonly kind: 'fixed';
                                readonly bits: 8;
                                readonly divisor: 127;
                                readonly offset: -128;
                            };
                        }, {
                            readonly id: 4;
                            readonly name: 'stickY';
                            readonly node: {
                                readonly kind: 'fixed';
                                readonly bits: 8;
                                readonly divisor: 127;
                                readonly offset: -128;
                            };
                        }];
                    };
                }, {
                    readonly id: 4;
                    readonly name: 'yaw';
                    readonly node: {
                        readonly kind: 'angle';
                        readonly bits: 16;
                    };
                }, {
                    readonly id: 5;
                    readonly name: 'pitch';
                    readonly node: {
                        readonly kind: 'quant';
                        readonly min: number;
                        readonly max: number;
                        readonly bits: 16;
                    };
                }, {
                    readonly id: 6;
                    readonly name: 'buttons';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 8;
                    };
                }, {
                    readonly id: 7;
                    readonly name: 'buttonsHigh';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'uint';
                            readonly bits: 8;
                        };
                    };
                }, {
                    readonly id: 8;
                    readonly name: 'attack';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'struct';
                            readonly fields: readonly [{
                                readonly id: 1;
                                readonly name: 'targetId';
                                readonly node: {
                                    readonly kind: 'optional';
                                    readonly node: {
                                        readonly kind: 'ref';
                                    };
                                };
                            }, {
                                readonly id: 2;
                                readonly name: 'aim';
                                readonly node: {
                                    readonly kind: 'struct';
                                    readonly fields: readonly [{
                                        readonly id: 1;
                                        readonly name: 'origin';
                                        readonly node: {
                                            readonly kind: 'struct';
                                            readonly fields: readonly [{
                                                readonly id: 1;
                                                readonly name: 'x';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }, {
                                                readonly id: 2;
                                                readonly name: 'y';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }, {
                                                readonly id: 3;
                                                readonly name: 'z';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }];
                                        };
                                    }, {
                                        readonly id: 2;
                                        readonly name: 'direction';
                                        readonly node: {
                                            readonly kind: 'struct';
                                            readonly fields: readonly [{
                                                readonly id: 1;
                                                readonly name: 'x';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }, {
                                                readonly id: 2;
                                                readonly name: 'y';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }, {
                                                readonly id: 3;
                                                readonly name: 'z';
                                                readonly node: {
                                                    readonly kind: 'f32';
                                                };
                                            }];
                                        };
                                    }];
                                };
                            }];
                        };
                    };
                }, {
                    readonly id: 9;
                    readonly name: 'heavyTarget';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'ref';
                        };
                    };
                }, {
                    readonly id: 10;
                    readonly name: 'lockTarget';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'ref';
                        };
                    };
                }, {
                    readonly id: 11;
                    readonly name: 'hookTarget';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'uint';
                            readonly bits: 16;
                        };
                    };
                }, {
                    readonly id: 12;
                    readonly name: 'launcher';
                    readonly node: {
                        readonly kind: 'optional';
                        readonly node: {
                            readonly kind: 'struct';
                            readonly fields: readonly [{
                                readonly id: 1;
                                readonly name: 'slot';
                                readonly node: {
                                    readonly kind: 'uint';
                                    readonly bits: 5;
                                };
                            }, {
                                readonly id: 2;
                                readonly name: 'ads';
                                readonly node: {
                                    readonly kind: 'quant';
                                    readonly min: 0;
                                    readonly max: 1;
                                    readonly bits: 8;
                                };
                            }, {
                                readonly id: 3;
                                readonly name: 'fire';
                                readonly node: {
                                    readonly kind: 'bool';
                                };
                            }];
                        };
                    };
                }];
            };
            readonly maxCount: 7;
        };
    }];
}, {
    readonly id: 3;
    readonly name: 'act';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'seq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 2;
        readonly name: 'act';
        readonly node: {
            readonly kind: 'union';
            readonly bits: 8;
            readonly default: 'interact';
            readonly arms: readonly [{
                readonly id: 1;
                readonly name: 'interact';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'id';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }];
            }, {
                readonly id: 2;
                readonly name: 'reload';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'slot';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 8;
                    };
                }];
            }, {
                readonly id: 3;
                readonly name: 'equip';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'slot';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 8;
                    };
                }];
            }, {
                readonly id: 4;
                readonly name: 'chat';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'channel';
                    readonly node: {
                        readonly kind: 'enum';
                        readonly values: readonly ["room", "proximity"];
                        readonly default: 'room';
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'text';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }];
            }, {
                readonly id: 5;
                readonly name: 'report';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'line';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 32;
                    };
                }];
            }, {
                readonly id: 6;
                readonly name: 'ride';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'action';
                    readonly node: {
                        readonly kind: 'enum';
                        readonly values: readonly ["offer", "mount", "dismount"];
                        readonly default: 'offer';
                    };
                }];
            }, {
                readonly id: 7;
                readonly name: 'climate';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'op';
                    readonly node: {
                        readonly kind: 'enum';
                        readonly values: readonly ["mode", "force", "time", "day"];
                        readonly default: 'mode';
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
                    readonly name: 'at';
                    readonly node: {
                        readonly kind: 'f32';
                    };
                }];
            }, {
                readonly id: 8;
                readonly name: 'buy';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'good';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 16;
                    };
                }];
            }, {
                readonly id: 9;
                readonly name: 'board';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'op';
                    readonly node: {
                        readonly kind: 'enum';
                        readonly values: readonly ["claim", "tear"];
                        readonly default: 'claim';
                    };
                }, {
                    readonly id: 2;
                    readonly name: 'slot';
                    readonly node: {
                        readonly kind: 'uint';
                        readonly bits: 16;
                    };
                }];
            }, {
                readonly id: 10;
                readonly name: 'wear';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'id';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }];
            }, {
                readonly id: 11;
                readonly name: 'pose';
                readonly fields: readonly [{
                    readonly id: 1;
                    readonly name: 'names';
                    readonly node: {
                        readonly kind: 'text';
                        readonly maxBytes: 255;
                    };
                }];
            }];
        };
    }];
}, {
    readonly id: 5;
    readonly name: 'frame';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 2;
        readonly name: 'baseline';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }, {
        readonly id: 3;
        readonly name: 'cell';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly id: 4;
        readonly name: 'lastSeq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }];
    readonly tail: 'snapshot';
}, {
    readonly id: 6;
    readonly name: 'events';
    readonly fields: readonly [{
        readonly id: 1;
        readonly name: 'tick';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 32;
        };
    }];
    readonly tail: 'records';
}];
export { CLIMATE_OPS, HELLO, MAX_BUNDLE, WELCOME, WIRE_ACTS, WIRE_COMMAND, WIRE_MESSAGES, WIRE_RECORDS, };
export { RIDE_LAWS } from './rides.ts';
