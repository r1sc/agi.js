/// <reference path="Agi_View.ts" />
module Agi {
    export enum MovementFlags {
        Normal,
        ChaseEgo,
        Wander,
        MoveTo
    }
    
    export enum Direction
    {
        Stopped = 0,
        Up = 1,
        UpRight = 2,
        Right = 3,
        DownRight = 4,
        Down = 5,
        DownLeft = 6,
        Left = 7,
        UpLeft = 8
    }

    export class GameObject {
        x: number = 0;
        y: number = 0;
        draw: boolean = false;
        direction: Direction = Direction.Stopped;
        viewNo: number = 0;
        loop: number = 0;
        cel: number = 0;
        fixedLoop: boolean = false;
        priority: number = 0;
        fixedPriority: boolean = false;
        reverseCycle: boolean = false;
        cycleTime: number = 1;
        celCycling: boolean = false;
        callAtEndOfLoop: boolean = false;
        flagToSetWhenFinished: number = 0;
        ignoreHorizon: boolean = false;
        ignoreBlocks: boolean = false;
        ignoreObjs: boolean = false;
        motion: boolean = false;
        stepSize: number = 1;
        stepTime: number = 0;

        moveToX: number = 0;
        moveToY: number = 0;
        moveToStep: number = 0;

        movementFlag: MovementFlags = MovementFlags.Normal;
        allowedSurface: number = 0;
        update: boolean = true;
        reverseLoop: boolean = false;
        nextCycle: number = 1;

        oldX: number = 0;
        oldY: number = 0;
        nextLoop: number = 0;
        nextCel: number = 0;
        oldLoop: number = 0;
        oldCel: number = 0;
        oldView: number = 0;
        oldPriority: number = 0;
        oldDrawX: number = 0;
        oldDrawY: number = 0;
    }
} 