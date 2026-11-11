/** The `player` class. */
declare const PLAYER: {
    readonly id: 1;
    readonly name: 'player';
    readonly fields: readonly [{
        readonly send: 'others';
        readonly required: true;
        readonly id: 1;
        readonly name: 'x';
        readonly node: {
            readonly kind: 'quant';
            readonly min: -260;
            readonly max: 260;
            readonly bits: 16;
        };
    }, {
        readonly send: 'others';
        readonly required: true;
        readonly id: 2;
        readonly name: 'y';
        readonly node: {
            readonly kind: 'quant';
            readonly min: -260;
            readonly max: 260;
            readonly bits: 16;
        };
    }, {
        readonly send: 'others';
        readonly required: true;
        readonly id: 3;
        readonly name: 'z';
        readonly node: {
            readonly kind: 'quant';
            readonly min: -260;
            readonly max: 260;
            readonly bits: 16;
        };
    }, {
        readonly id: 4;
        readonly name: 'yaw';
        readonly node: {
            readonly kind: 'angle';
            readonly bits: 10;
        };
        readonly send: 'others';
    }, {
        readonly id: 54;
        readonly name: 'name';
        readonly node: {
            readonly kind: 'text';
            readonly maxBytes: 255;
        };
        readonly send: 'initial';
    }, {
        readonly id: 5;
        readonly name: 'board';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 6;
        readonly name: 'swim';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly id: 7;
        readonly name: 'hp';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly send: 'owner';
        readonly id: 8;
        readonly name: 'maxHp';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly send: 'owner';
        readonly id: 9;
        readonly name: 'statusStun';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly id: 10;
        readonly name: 'held';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 8;
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 11;
        readonly name: 'px';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 12;
        readonly name: 'py';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 13;
        readonly name: 'pz';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 14;
        readonly name: 'vx';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 15;
        readonly name: 'vy';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 16;
        readonly name: 'vz';
        readonly node: {
            readonly kind: 'f64';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 17;
        readonly name: 'grounded';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 18;
        readonly name: 'dashT';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 19;
        readonly name: 'dodgeT';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 20;
        readonly name: 'dodgeCd';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 21;
        readonly name: 'shoveT';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 22;
        readonly name: 'shoveX';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 23;
        readonly name: 'shoveZ';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 24;
        readonly name: 'dashX';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 25;
        readonly name: 'dashZ';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 26;
        readonly name: 'impulseX';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 27;
        readonly name: 'impulseY';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 28;
        readonly name: 'impulseZ';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 29;
        readonly name: 'lockR0';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 30;
        readonly name: 'jumpAgo';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 31;
        readonly name: 'jumpLeft';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 32;
        readonly name: 'hoverAir';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 33;
        readonly name: 'hoverBob';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 34;
        readonly name: 'stood';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 35;
        readonly name: 'diving';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 36;
        readonly name: 'climbTo';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 37;
        readonly name: 'climbCooldown';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 38;
        readonly name: 'strokeTime';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 39;
        readonly name: 'water';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 40;
        readonly name: 'depth';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 41;
        readonly name: 'wading';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 42;
        readonly name: 'onPlatform';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 43;
        readonly name: 'sliding';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 44;
        readonly name: 'motorGrounded';
        readonly node: {
            readonly kind: 'bool';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 45;
        readonly name: 'groundNormalY';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 46;
        readonly name: 'downhillX';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 47;
        readonly name: 'downhillZ';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'all';
        readonly predicted: true;
        readonly id: 48;
        readonly name: 'freedom';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'owner';
        readonly id: 49;
        readonly name: 'swingPhase';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'owner';
        readonly id: 50;
        readonly name: 'lastSwingSeq';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly send: 'owner';
        readonly id: 51;
        readonly name: 'moveScale';
        readonly node: {
            readonly kind: 'f32';
        };
    }, {
        readonly send: 'owner';
        readonly id: 52;
        readonly name: 'resets';
        readonly node: {
            readonly kind: 'uint';
            readonly bits: 16;
        };
    }, {
        readonly send: 'owner';
        readonly id: 53;
        readonly name: 'led';
        readonly node: {
            readonly kind: 'bool';
        };
    }];
};
export { PLAYER };
