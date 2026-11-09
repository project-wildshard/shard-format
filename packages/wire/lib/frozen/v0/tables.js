import { compileSchema, schemaDescription } from './schema.js';
const DATA = [
    {
        "id": 0,
        "cls": "player",
        "fields": [
            {
                "name": "x",
                "order": 0,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16,
                    "send": "others"
                }
            },
            {
                "name": "y",
                "order": 1,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16,
                    "send": "others"
                }
            },
            {
                "name": "z",
                "order": 2,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16,
                    "send": "others"
                }
            },
            {
                "name": "yaw",
                "order": 3,
                "spec": {
                    "kind": "angle",
                    "bits": 10,
                    "send": "others"
                }
            },
            {
                "name": "board",
                "order": 4,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "swim",
                "order": 5,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "hp",
                "order": 6,
                "spec": {
                    "kind": "u16"
                }
            },
            {
                "name": "maxHp",
                "order": 7,
                "spec": {
                    "kind": "u16",
                    "send": "owner"
                }
            },
            {
                "name": "statusStun",
                "order": 8,
                "spec": {
                    "kind": "f32",
                    "send": "owner"
                }
            },
            {
                "name": "held",
                "order": 9,
                "spec": {
                    "kind": "u8"
                }
            },
            {
                "name": "px",
                "order": 10,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "py",
                "order": 11,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "pz",
                "order": 12,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "vx",
                "order": 13,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "vy",
                "order": 14,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "vz",
                "order": 15,
                "spec": {
                    "kind": "f64",
                    "predicted": true
                }
            },
            {
                "name": "grounded",
                "order": 16,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "dashT",
                "order": 17,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "dodgeT",
                "order": 18,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "dodgeCd",
                "order": 19,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "shoveT",
                "order": 20,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "shoveX",
                "order": 21,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "shoveZ",
                "order": 22,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "dashX",
                "order": 23,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "dashZ",
                "order": 24,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "impulseX",
                "order": 25,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "impulseY",
                "order": 26,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "impulseZ",
                "order": 27,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "lockR0",
                "order": 28,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "jumpAgo",
                "order": 29,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "jumpLeft",
                "order": 30,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "hoverAir",
                "order": 31,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "hoverBob",
                "order": 32,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "stood",
                "order": 33,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "diving",
                "order": 34,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "climbTo",
                "order": 35,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "climbCooldown",
                "order": 36,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "strokeTime",
                "order": 37,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "water",
                "order": 38,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "depth",
                "order": 39,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "wading",
                "order": 40,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "onPlatform",
                "order": 41,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "sliding",
                "order": 42,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "motorGrounded",
                "order": 43,
                "spec": {
                    "kind": "bool",
                    "predicted": true
                }
            },
            {
                "name": "groundNormalY",
                "order": 44,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "downhillX",
                "order": 45,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "downhillZ",
                "order": 46,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "freedom",
                "order": 47,
                "spec": {
                    "kind": "f32",
                    "predicted": true
                }
            },
            {
                "name": "swingPhase",
                "order": 48,
                "spec": {
                    "kind": "f32",
                    "send": "owner"
                }
            },
            {
                "name": "lastSwingSeq",
                "order": 49,
                "spec": {
                    "kind": "u16",
                    "send": "owner"
                }
            },
            {
                "name": "moveScale",
                "order": 50,
                "spec": {
                    "kind": "f32",
                    "send": "owner"
                }
            },
            {
                "name": "resets",
                "order": 51,
                "spec": {
                    "kind": "u16",
                    "send": "owner"
                }
            },
            {
                "name": "led",
                "order": 52,
                "spec": {
                    "kind": "bool",
                    "send": "owner"
                }
            }
        ],
        "relevance": null
    },
    {
        "id": 1,
        "cls": "animal",
        "fields": [
            {
                "name": "x",
                "order": 0,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "y",
                "order": 1,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "z",
                "order": 2,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "yaw",
                "order": 3,
                "spec": {
                    "kind": "angle",
                    "bits": 10
                }
            },
            {
                "name": "state",
                "order": 4,
                "spec": {
                    "kind": "enum",
                    "values": [
                        "idle",
                        "graze",
                        "wander",
                        "alert",
                        "flee",
                        "charge",
                        "stalk",
                        "dead",
                        "attack",
                        "perch",
                        "rise",
                        "hide",
                        "sidestep"
                    ]
                }
            },
            {
                "name": "attackT",
                "order": 5,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 8
                }
            },
            {
                "name": "attackDur",
                "order": 6,
                "spec": {
                    "kind": "u32"
                }
            },
            {
                "name": "attackStamp",
                "order": 7,
                "spec": {
                    "kind": "u32"
                }
            },
            {
                "name": "winding",
                "order": 8,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "flinch",
                "order": 9,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 6
                }
            },
            {
                "name": "strafe",
                "order": 10,
                "spec": {
                    "kind": "f32q",
                    "min": -9,
                    "max": 9,
                    "bits": 8
                }
            },
            {
                "name": "brace",
                "order": 11,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 6
                }
            },
            {
                "name": "hp",
                "order": 12,
                "spec": {
                    "kind": "u16"
                }
            },
            {
                "name": "alive",
                "order": 13,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "target",
                "order": 14,
                "spec": {
                    "kind": "ref"
                }
            },
            {
                "name": "rideable",
                "order": 15,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "rise",
                "order": 16,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 6
                }
            },
            {
                "name": "act",
                "order": 17,
                "spec": {
                    "kind": "u8"
                }
            },
            {
                "name": "kind",
                "order": 18,
                "spec": {
                    "kind": "text",
                    "send": "initial"
                }
            },
            {
                "name": "variant",
                "order": 19,
                "spec": {
                    "kind": "text",
                    "send": "initial"
                }
            },
            {
                "name": "rarity",
                "order": 20,
                "spec": {
                    "kind": "text",
                    "send": "initial"
                }
            },
            {
                "name": "scale",
                "order": 21,
                "spec": {
                    "kind": "f32",
                    "send": "initial"
                }
            },
            {
                "name": "seed",
                "order": 22,
                "spec": {
                    "kind": "u32",
                    "send": "initial"
                }
            }
        ],
        "relevance": {
            "radius": 160
        }
    },
    {
        "id": 2,
        "cls": "encounter",
        "fields": [
            {
                "name": "state",
                "order": 0,
                "spec": {
                    "kind": "enum",
                    "values": [
                        "dormant",
                        "armed",
                        "intro",
                        "fight",
                        "beat",
                        "victory",
                        "absent",
                        "idle",
                        "aware",
                        "engaged",
                        "leash",
                        "dead",
                        "broken",
                        "retired"
                    ]
                }
            },
            {
                "name": "hp",
                "order": 1,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 10
                }
            },
            {
                "name": "phase",
                "order": 2,
                "spec": {
                    "kind": "u8"
                }
            },
            {
                "name": "shield",
                "order": 3,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "body",
                "order": 4,
                "spec": {
                    "kind": "ref"
                }
            },
            {
                "name": "skip",
                "order": 5,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 6
                }
            },
            {
                "name": "banners",
                "order": 6,
                "spec": {
                    "kind": "u8"
                }
            },
            {
                "name": "signatures",
                "order": 7,
                "spec": {
                    "kind": "u8"
                }
            },
            {
                "name": "known",
                "order": 8,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "sleep",
                "order": 9,
                "spec": {
                    "kind": "f32q",
                    "min": 0,
                    "max": 1,
                    "bits": 8
                }
            },
            {
                "name": "rewarded",
                "order": 10,
                "spec": {
                    "kind": "bool"
                }
            },
            {
                "name": "rewardX",
                "order": 11,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "rewardY",
                "order": 12,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "rewardZ",
                "order": 13,
                "spec": {
                    "kind": "f32q",
                    "min": -260,
                    "max": 260,
                    "bits": 16
                }
            },
            {
                "name": "kind",
                "order": 14,
                "spec": {
                    "kind": "text",
                    "send": "initial"
                }
            }
        ],
        "relevance": null
    },
    {
        "id": 3,
        "cls": "script",
        "fields": [
            {
                "name": "x",
                "order": 0,
                "spec": {
                    "kind": "f32"
                }
            },
            {
                "name": "y",
                "order": 1,
                "spec": {
                    "kind": "f32"
                }
            },
            {
                "name": "z",
                "order": 2,
                "spec": {
                    "kind": "f32"
                }
            },
            {
                "name": "pitch",
                "order": 3,
                "spec": {
                    "kind": "angle",
                    "bits": 16
                }
            },
            {
                "name": "yaw",
                "order": 4,
                "spec": {
                    "kind": "angle",
                    "bits": 16
                }
            },
            {
                "name": "roll",
                "order": 5,
                "spec": {
                    "kind": "angle",
                    "bits": 16
                }
            },
            {
                "name": "enabled",
                "order": 6,
                "spec": {
                    "kind": "bool"
                }
            }
        ],
        "relevance": null
    },
    {
        "id": 4,
        "cls": "state",
        "fields": [
            {
                "name": "value",
                "order": 0,
                "spec": {
                    "kind": "f32"
                }
            }
        ],
        "relevance": null
    },
    {
        "id": 5,
        "cls": "flag",
        "fields": [],
        "relevance": null
    }
];
function unbound() { throw new Error('Frozen table has no simulation accessor'); }
export const V0_SCHEMAS = DATA.map(declaration => {
    const fields = {};
    for (const field of declaration.fields)
        fields[field.name] = { ...field.spec, read: unbound };
    return { cls: declaration.cls, fields, ...(declaration.relevance === null ? {} : { relevance: declaration.relevance }) };
});
export const V0_CLASSES = V0_SCHEMAS.map((schema, id) => compileSchema(schema, id));
export const V0_DESCRIPTIONS = V0_SCHEMAS.map(schemaDescription);
