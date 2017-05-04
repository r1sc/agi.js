namespace Agi {
    export class Screen {
        /**
         *
         */
        constructor(private interpreter: Interpreter) {            

        }
        
        bltText(row: number, col: number, text: string) {
            var fontStream = Resources.fontStream;
            var sRegex: RegExp = /\%s(\d+)/;
            var regexResult: RegExpExecArray;
            while ((regexResult = sRegex.exec(text)) !== null) {
                text = text.slice(0, regexResult.index) + this.interpreter.strings[parseInt(regexResult[1])] + text.slice(regexResult.index + regexResult.length + 1);
            }

            for (var i: number = 0; i < text.length; i++) {
                var chr: number = text[i].charCodeAt(0);
                if (chr == 10) {
                    row++;
                    col = 0;
                    continue;
                }
                fontStream.position = chr * 8;

                var data = this.interpreter.frameData.data;
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
            var data = this.interpreter.frameData.data;
            for (var k = 0; k < Bitmap.width * Bitmap.height; k++) {
                this.interpreter.framePriorityData.data[k] = this.interpreter.priorityBuffer.data[k];
                var rgb = Agi.palette[this.interpreter.visualBuffer.data[k]];
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
            var view: View = this.interpreter.loadedViews[viewNo];
            var cel: Cel = view.loops[loopNo].cels[celNo];
            var mirror: boolean = cel.mirrored;
            if (cel.mirrored) {
                cel = view.loops[cel.mirroredLoop].cels[celNo];
            }

            var data = this.interpreter.frameData.data;
            for (var cy: number = 0; cy < cel.height; cy++) {
                if (cy + y - cel.height >= 200)
                    break;
                for (var cx: number = 0; cx < cel.width; cx++) {
                    if (cx + x >= 160)
                        break;
                    var idx: number = (cy + y + 1 - cel.height) * 160 + (cx + x);
                    if (priority < this.interpreter.framePriorityData.data[idx])
                        continue;
                    var ccx: number = cx;
                    if (mirror)
                        ccx = cel.width - cx - 1;
                    var color = cel.pixelData[cy * cel.width + ccx];
                    if (color == cel.transparentColor)
                        continue;
                    color = this.interpreter.visualBuffer.data[idx];
                    this.interpreter.framePriorityData.data[idx] = this.interpreter.priorityBuffer.data[idx];
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

        bltView(viewNo: number, loopNo: number, celNo: number, x: number, y: number, priority: number) {
            var view: View = this.interpreter.loadedViews[viewNo];
            var cel: Cel = view.loops[loopNo].cels[celNo];
            var mirror: boolean = cel.mirrored;
            if (cel.mirrored) {
                cel = view.loops[cel.mirroredLoop].cels[celNo];
            }

            var data = this.interpreter.frameData.data;
            for (var cy: number = 0; cy < cel.height; cy++) {
                if (cy + y - cel.height >= 200)
                    break;
                for (var cx: number = 0; cx < cel.width; cx++) {
                    if (cx + x >= 160)
                        break;
                    var idx: number = (cy + y + 1 - cel.height) * 160 + (cx + x);
                    if (priority < this.interpreter.framePriorityData.data[idx])
                        continue;
                    var ccx: number = cx;
                    if (mirror)
                        ccx = cel.width - cx - 1;
                    var color = cel.pixelData[cy * cel.width + ccx];
                    if (color == cel.transparentColor)
                        continue;
                    this.interpreter.framePriorityData.data[idx] = priority;
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

        
        drawObject(obj: GameObject, no: number) {
            if (obj.redraw || obj.oldView != obj.viewNo || obj.oldLoop != obj.loop || obj.oldCel != obj.cel || obj.oldDrawX != obj.x || obj.oldDrawY != obj.y || obj.oldPriority != obj.priority) {
                obj.redraw = false;
                this.clearView(obj.oldView, obj.oldLoop, obj.oldCel, obj.oldDrawX, obj.oldDrawY, obj.oldPriority);
                this.bltView(obj.viewNo, obj.loop, obj.cel, obj.x, obj.y, obj.priority);
            }
            obj.oldDrawX = obj.x;
            obj.oldDrawY = obj.y;
            obj.oldView = obj.viewNo;
            obj.oldLoop = obj.loop;
            obj.oldCel = obj.cel;
            obj.oldPriority = obj.priority;
        }
    }
}