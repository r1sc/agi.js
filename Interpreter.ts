/// <reference path="Agi_Logic.ts" />
/// <reference path="LogicParser.ts" />
/// <reference path="Agi_View.ts" />
/// <reference path="GameObject.ts" />
module Agi {
    export class Interpreter {
        /* Interpreter vars */
        programControl: boolean;
        newroom: number = 0;
        visualBuffer: Bitmap;
        priorityBuffer: Bitmap;
        scriptSize: number = 0;
        strings: string[] = [];
        variables: Uint8Array = new Uint8Array(255);
        flags: boolean[] = [];
        msgBoxText: string = null;
        msgBoxX: number;
        msgBoxY: number;
        msgBoxWidth: number = 128;

        horizon: number;
        blockX1: number;
        blockY1: number;
        blockX2: number;
        blockY2: number;

        loadedViews: View[] = [];
        loadedLogics: LogicParser[] = [];
        loadedPics: Pic[] = [];
        logicStack: number[] = [];
        logicNo: number = 0;

        gameObjects: GameObject[] = [];
        frameData: ImageData;
        framePriorityData: Bitmap;
        keyboardSpecialBuffer: number[] = [];
        keyboardCharBuffer: number[] = [];
        inputBuffer: string = "";
        allowInput: boolean = true;
        haveKey: boolean = false;

        dialogue: boolean;
        dialogueStrNo: number;
        dialoguePrompt: string;
        dialogueStrLen: number;
        dialogueStrY: number;
        dialogueStrX: number;
        dialogueMode: number;

        constructor(private context: CanvasRenderingContext2D) {
            this.visualBuffer = new Bitmap();
            this.priorityBuffer = new Bitmap();
            this.framePriorityData = new Bitmap();
            this.frameData = this.context.createImageData(320, 200);
            var data = this.frameData.data;
            for (var i = 0; i < 320 * 200; i++) {
                data[i * 4 + 0] = 0x00;
                data[i * 4 + 1] = 0x00;
                data[i * 4 + 2] = 0x00;
                data[i * 4 + 3] = 0xFF;
            }
        }

        start(): void {
            /* Reset all state */
            for (var i = 0; i < 255; i++) {
                this.variables[i] = 0;
                this.flags[i] = false;
            }
            this.variables[0] = 0;
            this.variables[26] = 3; // EGA
            this.variables[8] = 255;    // Pages of free memory
            this.variables[23] = 15;    // Sound volume
            this.variables[24] = 41;    // Input buffer size
            this.flags[9] = true;       // Sound enabled
            this.flags[11] = true;      // Logic 0 executed for the first time
            this.flags[5] = true;       // Room script executed for the first time

            for (var j = 0; j < 16; j++) {
                this.gameObjects[j] = new GameObject();
            }
            this.agi_load_logic(0);
            this.cycle();
        }

        cycle(): void {
            this.flags[2] = false;  // The player has entered a command
            this.flags[4] = false;  // said accepted user input

            this.haveKey = (this.keyboardCharBuffer.length + this.keyboardSpecialBuffer.length) > 0;
            if (this.allowInput) {
                while (this.keyboardSpecialBuffer.length > 0) {
                    var key: number = this.keyboardSpecialBuffer.shift();
                    if (!this.dialogue) {
                        if (key == 37) // left
                            this.gameObjects[0].direction = 7;
                        else if (key == 36) // left-up
                            this.gameObjects[0].direction = 8;
                        else if (key == 38) // up
                            this.gameObjects[0].direction = 1;
                        else if (key == 33) // right-up
                            this.gameObjects[0].direction = 2;
                        else if (key == 39) // right
                            this.gameObjects[0].direction = 3;
                        else if (key == 34) // right-down
                            this.gameObjects[0].direction = 4;
                        else if (key == 40) // down
                            this.gameObjects[0].direction = 5;
                        else if (key == 35) // down-left
                            this.gameObjects[0].direction = 6;
                        else if (key == 12) // stop
                            this.gameObjects[0].direction = 0;
                        else if (key == 27) { // Escape
                            alert("Menu");
                        }
                    }
                }

                while (this.keyboardCharBuffer.length > 0) {
                    var key: number = this.keyboardCharBuffer.shift();
                    if (key >= 32 && key < 127 && this.inputBuffer.length < this.variables[24]) {
                        this.inputBuffer += String.fromCharCode(key);
                    } else if (key == 8 && this.inputBuffer.length > 0) { // Backspace
                        this.inputBuffer = this.inputBuffer.substr(0, this.inputBuffer.length - 1);
                    } else if (key == 8 && this.inputBuffer.length > 0) { // Backspace
                        this.inputBuffer = this.inputBuffer.substr(0, this.inputBuffer.length - 1);
                    } else if (key == 13) {
                        this.flags[2] = true; // The player has entered a command
                        this.keyboardCharBuffer = [];
                        break;
                    }
                }
            }

            if (this.dialogue) {
                if (this.dialogueMode == 1) { // string input
                    this.strings[this.dialogueStrNo] = this.inputBuffer;
                    this.bltText(this.dialogueStrY, this.dialogueStrX, this.dialoguePrompt + this.strings[this.dialogueStrNo]);
                }
            }
            this.keyboardCharBuffer = [];
            this.keyboardSpecialBuffer = [];
            if (this.programControl) {
                this.gameObjects[0].direction = this.variables[6];
            } else {
                this.variables[6] = this.gameObjects[0].direction;
            }

            // calculate direction of movement
            while (true) {
                this.agi_call(0);
                this.flags[11] = false;     // Logic 0 executed for the first time

                if (this.gameObjects[0] != null)
                    this.gameObjects[0].direction = this.variables[6];
                this.variables[5] = 0;
                this.variables[4] = 0;
                this.flags[5] = false;
                this.flags[6] = false;
                this.flags[12] = false;

                for (var j = 0; j < this.gameObjects.length; j++) {
                    var obj = this.gameObjects[j];
                    if (obj.update) {
                        if (obj.draw)
                            this.drawObject(obj, j);
                        this.updateObject(obj, j);
                    }
                }

                if (this.newroom != 0) {
                    this.agi_stop_update(0);
                    this.agi_unanimate_all();
                    this.loadedLogics = this.loadedLogics.slice(0, 1);
                    this.agi_player_control();
                    this.agi_unblock();
                    this.agi_set_horizon(36);

                    this.variables[1] = this.variables[0];
                    this.variables[0] = this.newroom;
                    this.variables[4] = 0;
                    this.variables[5] = 0;
                    this.variables[9] = 0;
                    this.variables[16] = this.gameObjects[0].viewNo;
                    switch (this.variables[2]) {
                        case 0: // Touched nothing
                            break;
                        case 1: // Top edge or horizon
                            this.gameObjects[0].y = 168;
                            break;
                        case 2:
                            this.gameObjects[0].x = 1;
                            break;
                        case 3:
                            this.gameObjects[0].y = this.horizon;
                            break;
                        case 4:
                            this.gameObjects[0].x = 160;
                            break;
                        default:
                    }

                    this.variables[2] = 0;
                    this.flags[2] = false;

                    this.agi_load_logic_v(0);
                    this.flags[5] = true;
                    this.newroom = 0;
                } else {
                    break;
                }
            }
            console.log("----- CYCLE ------");
            this.bltText(23, 0, "V68 = " + this.variables[68]);
            this.bltText(24, 0, this.strings[0] + this.inputBuffer);
            this.bltFrame();
        }

        bltText(row: number, col: number, text: string) {
            var fontStream = Agi.Resources.fontStream;
            var sRegex: RegExp = /\%s(\d+)/;
            var regexResult: RegExpExecArray;
            while ((regexResult = sRegex.exec(text)) !== null) {
                text = text.slice(0, regexResult.index) + this.strings[regexResult[1]] + text.slice(regexResult.index + regexResult.length + 1);
            }

            for (var i: number = 0; i < text.length; i++) {
                var chr: number = text[i].charCodeAt(0);
                if (chr == 10) {
                    row++;
                    col = 0;
                    continue;
                }
                fontStream.position = chr * 8;

                var data: Uint8Array = this.frameData.data;
                for (var y: number = 0; y < 8; y++) {
                    var colData: number = fontStream.readUint8();
                    for (var x: number = 0; x < 8; x++) {
                        var color: number = 0x00;
                        if ((colData & 0x80) == 0x80)
                            color = 0xFF;
                        var idx: number = (row * 8 + y) * 320 + (col * 8 + x);
                        data[idx * 4 + 0] = color;
                        data[idx * 4 + 1] = color;
                        data[idx * 4 + 2] = color;
                        data[idx * 4 + 3] = 0xFF;
                        colData = colData << 1;
                    }
                }

                col++;
                if (col >= 40) {
                    col = 0;
                    row++;
                }
            }
        }

        bltPic() {
            var data = this.frameData.data;
            for (var k = 0; k < Bitmap.width * Bitmap.height; k++) {
                this.framePriorityData.data[k] = this.priorityBuffer.data[k];
                var rgb = Agi.palette[this.visualBuffer.data[k]];
                data[k * 8 + 0] = (rgb >>> 16) & 0xFF;
                data[k * 8 + 1] = (rgb >>> 8) & 0xFF;
                data[k * 8 + 2] = rgb & 0xFF;
                data[k * 8 + 3] = 255;
                data[k * 8 + 4] = (rgb >>> 16) & 0xFF;
                data[k * 8 + 5] = (rgb >>> 8) & 0xFF;
                data[k * 8 + 6] = rgb & 0xFF;
                data[k * 8 + 7] = 255;
            }
        }

        clearView(viewNo: number, loopNo: number, celNo: number, x: number, y: number, priority: number) {
            var view: View = this.loadedViews[viewNo];
            var cel: Cel = view.loops[loopNo].cels[celNo];
            if (cel.mirrored)
                cel = view.loops[cel.mirroredLoop].cels[celNo];

            var data = this.frameData.data;
            for (var cy: number = 0; cy < cel.height; cy++) {
                for (var cx: number = 0; cx < cel.width; cx++) {
                    var idx: number = (cy + y + 1 - cel.height) * 160 + (cx + x);
                    if (this.framePriorityData.data[idx] > priority)
                        continue;
                    this.framePriorityData.data[idx] = this.priorityBuffer.data[idx];
                    var color = this.visualBuffer.data[idx];
                    var rgb = Agi.palette[color];
                    data[idx * 8 + 0] = (rgb >>> 16) & 0xFF;
                    data[idx * 8 + 1] = (rgb >>> 8) & 0xFF;
                    data[idx * 8 + 2] = rgb & 0xFF;
                    data[idx * 8 + 3] = 255;
                    data[idx * 8 + 4] = (rgb >>> 16) & 0xFF;
                    data[idx * 8 + 5] = (rgb >>> 8) & 0xFF;
                    data[idx * 8 + 6] = rgb & 0xFF;
                    data[idx * 8 + 7] = 255;
                }
            }
        }

        bltView(viewNo: number, loopNo: number, celNo: number, x: number, y: number, priority: number, margin: number) {
            var view: View = this.loadedViews[viewNo];
            var cel: Cel = view.loops[loopNo].cels[celNo];
            var mirror: boolean = cel.mirrored;
            if (cel.mirrored) {
                cel = view.loops[cel.mirroredLoop].cels[celNo];
            }

            var data: Uint8Array = this.frameData.data;
            for (var cy: number = 0; cy < cel.height; cy++) {
                if (cy + y - cel.height >= 200)
                    break;
                for (var cx: number = 0; cx < cel.width; cx++) {
                    if (cx + x >= 160)
                        break;
                    var idx: number = (cy + y + 1 - cel.height) * 160 + (cx + x);
                    if (priority < this.framePriorityData.data[idx])
                        continue;
                    var ccx: number = cx;
                    if (mirror)
                        ccx = cel.width - cx - 1;
                    var color = cel.pixelData[cy * cel.width + ccx];
                    if (color == cel.transparentColor)
                        continue;
                    this.framePriorityData.data[idx] = priority;
                    var rgb = Agi.palette[color];
                    data[idx * 8 + 0] = (rgb >>> 16) & 0xFF;
                    data[idx * 8 + 1] = (rgb >>> 8) & 0xFF;
                    data[idx * 8 + 2] = rgb & 0xFF;
                    data[idx * 8 + 3] = 255;
                    data[idx * 8 + 4] = (rgb >>> 16) & 0xFF;
                    data[idx * 8 + 5] = (rgb >>> 8) & 0xFF;
                    data[idx * 8 + 6] = rgb & 0xFF;
                    data[idx * 8 + 7] = 255;
                }
            }
        }

        bltFrame() {
            /*var data = this.frameData.data;
            for (var k = 0; k < Bitmap.width * Bitmap.height; k++) {
                var rgb = Agi.palette[this.framePriorityData.data[k]];
                data[k * 8 + 0] = (rgb >>> 16) & 0xFF;
                data[k * 8 + 1] = (rgb >>> 8) & 0xFF;
                data[k * 8 + 2] = rgb & 0xFF;
                data[k * 8 + 3] = 255;
                data[k * 8 + 4] = (rgb >>> 16) & 0xFF;
                data[k * 8 + 5] = (rgb >>> 8) & 0xFF;
                data[k * 8 + 6] = rgb & 0xFF;
                data[k * 8 + 7] = 255;
            }*/
            this.context.putImageData(this.frameData, 0, 0);
        }

        updateObject(obj: GameObject, no: number) {
            var xStep: number = obj.stepSize;
            var yStep: number = obj.stepSize;
            switch (obj.movementFlag) {
                case MovementFlags.Normal:

                    break;
                case MovementFlags.MoveTo:
                    if (obj.moveToStep != 0) {
                        xStep = yStep = obj.moveToStep;
                    }
                    if (obj.moveToX > obj.x) {
                        if (obj.moveToY > obj.y)
                            obj.direction = Direction.DownRight;
                        else if (obj.moveToY < obj.y)
                            obj.direction = Direction.UpRight;
                        else
                            obj.direction = Direction.Right;
                    }
                    else if (obj.moveToX < obj.x) {
                        if (obj.moveToY > obj.y)
                            obj.direction = Direction.DownLeft;
                        else if (obj.moveToY < obj.y)
                            obj.direction = Direction.UpLeft;
                        else
                            obj.direction = Direction.Left;
                    } else {
                        if (obj.moveToY > obj.y)
                            obj.direction = Direction.Down;
                        else if (obj.moveToY < obj.y)
                            obj.direction = Direction.Up;
                        else {
                            obj.direction = Direction.Stopped;
                            this.flags[obj.flagToSetWhenFinished] = true;
                            obj.movementFlag = MovementFlags.Normal;
                        }
                    }

                    yStep = Math.min(yStep, Math.abs(obj.y - obj.moveToY));
                    xStep = Math.min(xStep, Math.abs(obj.x - obj.moveToX));
                    break;
                case MovementFlags.ChaseEgo:

                    break;

                case MovementFlags.Wander:

                    break;
                default:
            }
            var newX: number = obj.x;
            var newY: number = obj.y;
            if (obj.direction == 1 || obj.direction == 2 || obj.direction == 8)
                newY = obj.y - yStep;
            else if (obj.direction == 5 || obj.direction == 4 || obj.direction == 6)
                newY = obj.y + yStep;
            if (obj.direction == 7 || obj.direction == 8 || obj.direction == 6)
                newX = obj.x - xStep;
            else if (obj.direction == 3 || obj.direction == 2 || obj.direction == 4)
                newX = obj.x + xStep;
            obj.x = newX;
            obj.y = newY;
        }

        drawObject(obj: GameObject, no: number) {
            var view: View = this.loadedViews[obj.viewNo];
            var cel: Cel = view.loops[obj.loop].cels[obj.cel];

            if (obj.x != obj.oldX || obj.y != obj.oldY) {
                if (obj.x <= 0) {
                    if (no == 0)
                        this.variables[2] = 4;
                    else {
                        this.variables[4] = no;
                        this.variables[5] = 4;
                    }
                } else if (obj.x + cel.width >= 160) {
                    if (no == 0)
                        this.variables[2] = 2;
                    else {
                        this.variables[4] = no;
                        this.variables[5] = 2;
                    }
                } else if (!obj.ignoreHorizon && obj.y <= this.horizon) {
                    if (no == 0)
                        this.variables[2] = 1;
                    else {
                        this.variables[4] = no;
                        this.variables[5] = 1;
                    }
                } else if (obj.y >= 168) {
                    if (no == 0)
                        this.variables[2] = 3;
                    else {
                        this.variables[4] = no;
                        this.variables[5] = 3;
                    }
                }
            }

            if (!obj.fixedPriority) {
                if (obj.y < 48)
                    obj.priority = 4;
                else if (obj.y == 168)
                    obj.priority = 15;
                else
                    obj.priority = ((obj.y / 12) | 0) + 1;

            }
            if (!obj.fixedLoop) {
                if (view.loops.length > 1 && view.loops.length < 4) {
                    if (obj.direction == 2 || obj.direction == 3 || obj.direction == 4 ||
                        obj.direction == 6 || obj.direction == 7 || obj.direction == 8)
                        obj.loop = 1;
                } else if (view.loops.length >= 4) {
                    if (obj.direction == 1)
                        obj.loop = 3;
                    else if (obj.direction == 2 || obj.direction == 3 || obj.direction == 4)
                        obj.loop = 0;
                    else if (obj.direction == 5)
                        obj.loop = 2;
                    else if (obj.direction == 6 || obj.direction == 7 || obj.direction == 8)
                        obj.loop = 1;
                }
            }
            if (obj.celCycling) {
                if (obj.nextCycle == 1) {
                    if (obj.reverseCycle)
                        obj.cel--;
                    else
                        obj.cel++;
                    var endOfLoop: boolean = false;
                    if (obj.cel < 0) {
                        if (obj.callAtEndOfLoop)
                            obj.cel = 0;
                        else
                            obj.cel = view.loops[obj.loop].cels.length - 1;
                        endOfLoop = true;
                    } else if (obj.cel > view.loops[obj.loop].cels.length - 1) {
                        if (obj.callAtEndOfLoop)
                            obj.cel = view.loops[obj.loop].cels.length - 1;
                        else
                            obj.cel = 0;
                        endOfLoop = true;
                    }
                    if (endOfLoop && obj.callAtEndOfLoop) {
                        obj.celCycling = false;
                        this.flags[obj.flagToSetWhenFinished] = true;
                    }
                    obj.nextCycle = obj.cycleTime;
                } else
                    obj.nextCycle--;
            }
            this.bltView(obj.viewNo, obj.loop, obj.cel, obj.x, obj.y, obj.priority, 4);
        }

        // ReSharper disable InconsistentNaming
        agi_increment(varNo: number): void {
            if (this.variables[varNo] < 255)
                this.variables[varNo]++;
        }

        agi_decrement(varNo: number): void {
            if (this.variables[varNo] > 0)
                this.variables[varNo]--;
        }

        agi_assignn(varNo: number, num: number): void {
            this.variables[varNo] = num;
        }
        agi_assignv(varNo1: number, varNo2: number): void {
            this.agi_assignn(varNo1, this.variables[varNo2]);
        }

        agi_addn(varNo: number, num: number): void {
            this.variables[varNo] += num;
        }
        agi_addv(varNo1: number, varNo2: number): void {
            this.agi_addn(varNo1, this.variables[varNo2]);
        }

        agi_subn(varNo: number, num: number): void {
            this.variables[varNo] -= num;
        }
        agi_subv(varNo1: number, varNo2: number): void {
            this.agi_subn(varNo1, this.variables[varNo2]);
        }

        agi_lindirectn(varNo: number, val: number): void {
            this.variables[this.variables[varNo]] = val;
        }
        agi_lindirectv(varNo1: number, varNo2: number): void {
            this.agi_lindirectn(varNo1, this.variables[varNo2]);
        }
        agi_rindirect(varNo1: number, varNo2: number): void {
            this.variables[varNo1] = this.variables[this.variables[varNo2]];
        }

        agi_set(flagNo: number): void {
            this.flags[flagNo] = true;
        }
        agi_reset(flagNo: number): void {
            this.flags[flagNo] = false;
        }
        agi_toggle(flagNo: number): void {
            this.flags[flagNo] = !this.flags[flagNo];
        }
        agi_setv(varNo: number): void {
            this.agi_set(this.variables[varNo]);
        }
        agi_reset_v(varNo: number): void {
            this.agi_reset(this.variables[varNo]);
        }
        agi_togglev(varNo: number): void {
            this.agi_toggle(this.variables[varNo]);
        }

        agi_call(logicNo: number): void {
            this.logicStack.push(this.logicNo);
            this.logicNo = logicNo;
            if (this.loadedLogics[logicNo] != null) {
                this.loadedLogics[logicNo].parseLogic();
            } else {
                this.agi_load_logic(logicNo);
                this.loadedLogics[logicNo].parseLogic();
                this.loadedLogics[logicNo] = null;
            }
            this.logicNo = this.logicStack.pop();
        }
        agi_call_v(varNo: number): void {
            this.agi_call(this.variables[varNo]);
        }

        agi_print_at(msgNo: number, x: number, y: number, width: number): void {

        }
        agi_print_atv(varNo: number, x: number, y: number, width: number): void {
            this.agi_print_at(this.variables[varNo], x, y, width);
        }

        agi_muln(varNo: number, val: number): void {
            this.variables[this.variables[varNo]] *= val;
        }
        agi_mulv(varNo1: number, varNo2: number): void {
            this.agi_muln(varNo1, this.variables[varNo2]);
        }

        agi_divn(varNo: number, val: number): void {
            this.variables[this.variables[varNo]] /= val;
        }
        agi_divv(varNo1: number, varNo2: number): void {
            this.agi_divn(varNo1, this.variables[varNo2]);
        }

        agi_new_room(roomNo: number) {
            console.log("NEW_ROOM " + roomNo);
            this.newroom = roomNo;
        }
        agi_new_room_v(varNo: number) {
            this.agi_new_room(this.variables[varNo]);
        }

        agi_load_pic(varNo: number) {
            var picNo = this.variables[varNo];
            this.loadedPics[picNo] = new Pic(Resources.readAgiResource(Resources.AgiResource.Pic, picNo));
        }

        agi_overlay_pic(varNo: number): void {
            var picNo = this.variables[varNo];
            this.loadedPics[picNo].draw(this.visualBuffer, this.priorityBuffer);
        }

        agi_draw_pic(varNo: number): void {
            this.visualBuffer.clear(0x0F);
            this.priorityBuffer.clear(0x04);
            this.agi_overlay_pic(varNo);
        }

        agi_show_pic(): void {
            this.bltPic();
        }

        agi_discard_pic(varNo: number): void {
            var picNo = this.variables[varNo];
            this.loadedPics[picNo] = null;
        }

        agi_get_posn(objNo: number, varNo1: number, varNo2: number) {
            this.variables[varNo1] = this.gameObjects[objNo].x;
            this.variables[varNo2] = this.gameObjects[objNo].y;
        }

        agi_stop_update(objNo: number) {
            this.gameObjects[objNo].update = false;
        }

        agi_animate_obj(objNo: number) {
            this.gameObjects[objNo] = new GameObject();
            this.gameObjects[objNo].update = true;
        }

        agi_draw(objNo: number) {
            this.gameObjects[objNo].draw = true;
            this.drawObject(this.gameObjects[objNo], objNo);
        }

        agi_set_view(objNo: number, viewNo: number) {
            this.gameObjects[objNo].viewNo = viewNo;
            this.gameObjects[objNo].loop = 0;
            this.gameObjects[objNo].cel = 0;
            this.gameObjects[objNo].celCycling = true;
        }

        agi_set_view_v(objNo: number, varNo: number) {
            this.agi_set_view(objNo, this.variables[varNo]);
        }

        agi_unanimate_all() {
            for (var i = 0; i < this.gameObjects.length; i++) {
                this.gameObjects[i].update = false;
            }
        }

        agi_player_control() {
            this.programControl = false;
        }

        agi_program_control() {
            this.programControl = true;
        }

        agi_set_horizon(y: number) {
            this.horizon = y;
        }

        agi_unblock() {
            this.blockX1 = this.blockY1 = this.blockX2 = this.blockY2 = 0;
        }

        agi_load_view(viewNo: number) {
            this.loadedViews[viewNo] = new View(Resources.readAgiResource(Resources.AgiResource.View, viewNo));
        }

        agi_load_view_v(varNo: number) {
            this.agi_load_view(this.variables[varNo]);
        }

        agi_discard_view(viewNo: number) {
            this.loadedViews[viewNo] = null;
        }

        agi_discard_view_v(varNo: number) {
            this.agi_discard_view(this.variables[varNo]);
        }

        agi_observe_objs(objNo: number) {
            this.gameObjects[objNo].ignoreObjs = false;
        }

        agi_ignore_objs(objNo: number) {
            this.gameObjects[objNo].ignoreObjs = true;
        }

        agi_position(objNo: number, x: number, y: number) {
            this.gameObjects[objNo].x = x;
            this.gameObjects[objNo].y = y;
        }
        agi_position_v(objNo: number, varNo1: number, varNo2: number) {
            this.agi_position(objNo, this.variables[varNo1], this.variables[varNo2]);
        }

        agi_stop_cycling(objNo: number) {
            this.gameObjects[objNo].celCycling = false;
        }

        agi_start_cycling(objNo: number) {
            this.gameObjects[objNo].celCycling = true;
        }

        aginormal_cycle(objNo: number) {
            this.gameObjects[objNo].reverseCycle = false;
        }

        agi_end_of_loop(objNo: number, flagNo: number) {
            this.gameObjects[objNo].callAtEndOfLoop = true;
            this.gameObjects[objNo].flagToSetWhenFinished = flagNo;
            this.gameObjects[objNo].celCycling = true;
        }

        agi_reverse_cycle(objNo: number) {
            this.gameObjects[objNo].reverseCycle = true;
        }

        agi_cycle_time(objNo: number, varNo: number) {
            this.gameObjects[objNo].cycleTime = this.variables[varNo];
        }

        agi_reverse_loop(objNo: number, flagNo: number) {
            this.gameObjects[objNo].reverseLoop = true;
        }

        agi_stop_motion(objNo: number) {
            if (objNo == 0)
                this.agi_program_control();
            //this.gameObjects[objNo].motion = false;
            this.gameObjects[objNo].direction = Direction.Stopped;
        }

        agi_start_motion(objNo: number) {
            if (objNo == 0)
                this.agi_player_control();
            //this.gameObjects[objNo].motion = true;
        }

        agi_normal_motion(objNo: number) {
            this.gameObjects[objNo].movementFlag = MovementFlags.Normal;
        }

        agi_step_size(objNo: number, varNo: number) {
            this.gameObjects[objNo].stepSize = this.variables[varNo];
        }

        agi_step_time(objNo: number, varNo: number) {
            this.gameObjects[objNo].stepTime = this.variables[varNo];
        }

        agi_set_loop(objNo: number, loopNo: number) {
            this.gameObjects[objNo].loop = loopNo;
        }

        agi_set_loop_v(objNo: number, varNo: number) {
            this.gameObjects[objNo].loop = this.variables[varNo];
        }

        agi_fix_loop(objNo: number) {
            this.gameObjects[objNo].fixedLoop = true;
        }

        agi_set_priority(objNo: number, priority: number) {
            this.gameObjects[objNo].priority = priority;
            this.gameObjects[objNo].fixedPriority = true;
        }

        agi_set_priority_v(objNo: number, varNo: number) {
            this.agi_set_priority(objNo, this.variables[varNo]);
        }

        agi_release_loop(objNo: number) {
            this.gameObjects[objNo].fixedLoop = false;
        }

        agi_set_cel(objNo: number, celNo: number) {
            this.gameObjects[objNo].nextCycle = 1;
            this.gameObjects[objNo].cel = celNo;
        }

        agi_set_cel_v(objNo: number, varNo: number) {
            this.agi_set_cel(objNo, this.variables[varNo]);
        }

        agi_last_cel(objNo: number, varNo: number) {
            var obj: GameObject = this.gameObjects[objNo];
            this.variables[varNo] = this.loadedViews[obj.viewNo].loops[obj.loop].cels.length - 1;
        }

        agi_current_cel(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].cel;
        }

        agi_current_loop(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].loop;
        }

        agi_currentview(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].viewNo;
        }

        agi_number_of_loops(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].viewNo;
        }

        agi_release_priority(objNo: number) {
            this.gameObjects[objNo].fixedPriority = false;
        }

        agi_get_priority(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].priority;
        }

        agi_start_update(objNo: number) {
            this.gameObjects[objNo].update = true;
        }

        agi_force_update(objNo: number) {
            var obj: GameObject = this.gameObjects[objNo];
            this.bltView(obj.viewNo, obj.loop, obj.cel, obj.x, obj.y, obj.priority, 4);
        }

        agi_ignore_horizon(objNo: number) {
            this.gameObjects[objNo].ignoreHorizon = true;
        }

        agi_observe_horizon(objNo: number) {
            this.gameObjects[objNo].ignoreHorizon = false;
        }

        agi_prevent_input(): void {
            this.allowInput = false;
        }

        agi_accept_input(): void {
            this.allowInput = true;
        }

        agi_add_to_pic(viewNo: number, loopNo: number, celNo: number, x: number, y: number, priority: number, margin: number) {
            this.bltView(viewNo, loopNo, celNo, x, y, priority, margin);
        }
        agi_add_to_pic_v(varNo1: number, varNo2: number, varNo3: number, varNo4: number, varNo5: number, varNo6: number, varNo7: number) {
            this.agi_add_to_pic(
                this.variables[varNo1],
                this.variables[varNo2],
                this.variables[varNo3],
                this.variables[varNo4],
                this.variables[varNo5],
                this.variables[varNo6],
                this.variables[varNo7]
                );
        }

        agi_random(start: number, end: number, varNo: number) {
            this.variables[varNo] = (Math.random() * (end - start)) + start;
        }

        agi_move_obj(objNo: number, x: number, y: number, stepSpeed: number, flagNo: number) {
            var obj = this.gameObjects[objNo];
            obj.moveToX = x;
            obj.moveToY = y;
            obj.moveToStep = stepSpeed;
            obj.movementFlag = MovementFlags.MoveTo;
            obj.flagToSetWhenFinished = flagNo;
        }

        agi_move_obj_v(objNo: number, varNo1: number, varNo2: number, stepSpeed: number, flagNo: number) {
            this.agi_move_obj(objNo, this.variables[varNo1], this.variables[varNo2], 1, flagNo);
        }

        agi_follow_ego(objNo: number, stepSpeed: number, flagNo: number) {
            var obj = this.gameObjects[objNo];
            obj.moveToStep = stepSpeed;
            obj.flagToSetWhenFinished = flagNo;
            obj.movementFlag = MovementFlags.ChaseEgo;
        }

        agi_wander(objNo: number) {
            this.gameObjects[objNo].movementFlag = MovementFlags.Wander;
        }

        aginormal_motion(objNo: number) {
            this.gameObjects[objNo].motion = true;
        }

        agi_set_dir(objNo: number, varNo: number) {
            this.gameObjects[objNo].direction = this.variables[varNo];
        }

        agi_get_dir(objNo: number, varNo: number) {
            this.variables[varNo] = this.gameObjects[objNo].direction;
        }

        agi_ignore_blocks(objNo: number) {
            this.gameObjects[objNo].ignoreBlocks = true;
        }

        agi_observe_blocks(objNo: number) {
            this.gameObjects[objNo].ignoreBlocks = false;
        }

        agi_block(x1: number, y1: number, x2: number, y2: number) {
            this.blockX1 = x1;
            this.blockY1 = y1;
            this.blockX2 = x2;
            this.blockY2 = y2;
        }

        agi_set_string(strNo: number, msg: number) {
            //this.strings[strNo] = message;
        }

        agi_erase(objNo: number) {
            var obj: GameObject = this.gameObjects[objNo];
            obj.draw = false;
            this.clearView(obj.viewNo, obj.loop, obj.cel, obj.x, obj.y, obj.priority);
        }

        agi_load_logic(logNo: number) {
            this.loadedLogics[logNo] = new LogicParser(this, logNo);
        }


        agi_load_logic_v(varNo: number) {
            this.agi_load_logic(this.variables[varNo]);
        }

        agi_display(row: number, col: number, msg: number) {
            this.bltText(row, col, this.loadedLogics[this.logicNo].logic.messages[msg]);
        }

        agi_display_v(varNo1: number, varNo2: number, varNo3: number) {
            this.agi_display(this.variables[varNo1], this.variables[varNo2], this.variables[varNo3]);
        }

        agi_clear_lines(fromRow: number, row: number, colorNo: number) {
            for (var y = fromRow; y < row + 1; y++) {
                this.bltText(y, 0, "                                        ");
            }
        }

        agi_script_size(bytes: number) {

        }

        agi_trace_info(logNo: number, firstRow: number, height: number) {

        }

        agi_set_key(num1: number, num2: number, num3: number) {

        }

        agi_set_game_id(msg: number) {

        }

        agi_configure_screen(num1: number, num2: number, num3: number) {

        }

        agi_set_cursor_char(msg: number) {

        }

        agi_set_menu(msg: number) {

        }

        agi_set_menu_member(msg: number, ctrl: number) {

        }

        agi_submit_menu() {

        }

        agi_enable_member(ctrl: number) {

        }

        agi_disable_member(ctrl: number) {

        }

        agi_drop(item: number) {

        }

        agi_status_line_on() {

        }

        agi_status_line_off() {

        }

        agi_load_sound(soundNo: number) {

        }

        agi_sound(soundNo: number, flagNo: number) {

        }

        agi_stop_sound() {

        }

        agi_reposition_to(objNo: number, x: number, y: number) {
            var obj: GameObject = this.gameObjects[objNo];
            this.agi_position(objNo, x, y);
        }

        agi_reposition_to_v(objNo: number, varNo1: number, varNo2: number) {
            this.agi_reposition_to(objNo, this.variables[varNo1], this.variables[varNo2]);
        }

        agi_text_screen() {

        }

        agi_graphics() {

        }

        agi_open_dialogue() {
            this.dialogue = true;
        }

        agi_close_dialogue() {
            this.dialogue = false;
        }

        agi_get_string(strNo: number, msg: string, x: number, y: number, maxLen: number) {
            this.dialogueStrNo = strNo;
            this.dialoguePrompt = msg;
            this.dialogueStrX = x;
            this.dialogueStrY = y;
            this.dialogueStrLen = maxLen;
            this.dialogueMode = 1;
        }

        agi_parse(strNo: number) {

        }

        agi_print(msgNo: number) {
            //this.loadedLogics[this.logicNo].logic.messages[msgNo];
        }

        agi_print_v(varNo: number) {
            this.agi_print(this.variables[varNo]);
        }

        agi_set_text_attribute(fg: number, bg: number) {

        }

        /* Tests */
        agi_test_equaln(varNo: number, val: number): boolean {
            return this.variables[varNo] == val;
        }
        agi_test_equalv(varNo1: number, varNo2: number): boolean {
            return this.agi_test_equaln(varNo1, this.variables[varNo2]);
        }

        agi_test_lessn(varNo: number, val: number): boolean {
            return this.variables[varNo] < val;
        }
        agi_test_lessv(varNo1: number, varNo2: number): boolean {
            return this.agi_test_lessn(varNo1, this.variables[varNo2]);
        }

        agi_test_greatern(varNo: number, val: number): boolean {
            return this.variables[varNo] > val;
        }
        agi_test_greaterv(varNo1: number, varNo2: number): boolean {
            return this.agi_test_greatern(varNo1, this.variables[varNo2]);
        }

        agi_test_isset(flagNo: number): boolean {
            return this.flags[flagNo];
        }
        agi_test_issetv(varNo: number): boolean {
            return this.agi_test_isset(this.variables[varNo]);
        }

        agi_test_has(itemNo: number): boolean {
            return false;
        }

        agi_test_obj_in_room(itemNo: number, varNo: number): boolean {
            return false;
        }

        agi_test_posn(objNo: number, x1: number, y1: number, x2: number, y2: number): boolean {
            var obj = this.gameObjects[objNo];
            return x1 <= obj.x && obj.x <= x2 && y1 <= obj.y && obj.y <= y2;
        }

        agi_test_controller(ctrNo: number): boolean {
            return false;
        }

        agi_test_have_key(): boolean {
            var haveKey: boolean = this.haveKey;
            this.haveKey = false;
            return haveKey;
        }

        agi_test_said(wordGroups: number[]) {
            return false;
        }

        agi_test_compare_strings(strNo1: number, strNo2: number): boolean {
            return this.strings[strNo1] == this.strings[strNo2];
        }

        agi_test_obj_in_box(): boolean {
            return false;
        }

        agi_distance(objNo1: number, objNo2: number, varNo: number) {
            var obj1: GameObject = this.gameObjects[objNo1];
            var obj2: GameObject = this.gameObjects[objNo2];
            if (obj1 != null && obj2 != null && obj1.draw && obj2.draw) {
                this.variables[varNo] = Math.abs(obj1.x - obj2.x) + Math.abs(obj1.y - obj2.y);
            } else {
                this.variables[varNo] = 255;
            }
        }

        // ReSharper restore InconsistentNaming
    }
} 
