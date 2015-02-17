/// <reference path="FastQueue.ts" />
/// <reference path="ByteStream.ts" />
module Agi {
    export class Bitmap {
        data: Uint8Array;
        static width: number = 160;
        static height: number = 168;
        constructor() {
            this.data = new Uint8Array(Bitmap.width * Bitmap.height);
        }

        clear(color: number): void {
            for (var i = 0; i < Bitmap.width * Bitmap.height; i++) {
                this.data[i] = color;
            }
        }
    }

    enum PicOpcode {
        PicSetColor = 0xF0,
        PicDisable = 0xF1,
        PriSetcolor = 0xF2,
        PriDisable = 0xF3,
        DrawYCorner = 0xF4,
        DrawXCorner = 0xF5,
        DrawAbs = 0xF6,
        DrawRel = 0xF7,
        DrawFill = 0xF8,
        SetPen = 0xF9,
        DrawPen = 0xFA,
        End = 0xFF
    }

    export class Pic {
        picEnabled: boolean = false;
        priEnabled: boolean = false;
        picColor: number = 0;
        priColor: number = 0;
        visible: Bitmap;
        priority: Bitmap;

        constructor(public stream: Fs.ByteStream) {}

        private setPixel(x: number, y: number, drawVis: boolean = true, drawPri: boolean = true): void {
            if (this.picEnabled && drawVis)
                this.visible.data[y * Bitmap.width + x] = this.picColor;
            if (this.priEnabled && drawPri)
                this.priority.data[y * Bitmap.width + x] = this.priColor;
        }

        round(aNumber: number, dirn: number): number {
            if (dirn < 0)
                return ((aNumber - Math.floor(aNumber) <= 0.501) ?
                    Math.floor(aNumber) : Math.ceil(aNumber));
            return ((aNumber - Math.floor(aNumber) < 0.499) ?
                Math.floor(aNumber) : Math.ceil(aNumber));
        }


        private drawLine(x1: number, y1: number, x2: number, y2: number): void {
            var x: number, y: number;
            var height: number = y2 - y1;
            var width: number = x2 - x1;
            var addX: number = (height == 0 ? height : width / Math.abs(height));
            var addY: number = (width == 0 ? width : height / Math.abs(width));

            if (Math.abs(width) > Math.abs(height)) {
                y = y1;
                addX = (width == 0 ? 0 : width / Math.abs(width));
                for (x = x1; x != x2; x += addX) {
                    this.setPixel(this.round(x, addX), this.round(y, addY));
                    y += addY;
                }
                this.setPixel(x2, y2);
            } else {
                x = x1;
                addY = (height == 0 ? 0 : height / Math.abs(height));
                for (y = y1; y != y2; y += addY) {
                    this.setPixel(this.round(x, addX), this.round(y, addY));
                    x += addX;
                }
                this.setPixel(x2, y2);
            }
        }

        private opDrawXCorner(): void {
            var startX: number = this.stream.readUint8();
            var startY: number = this.stream.readUint8();
            this.setPixel(startX, startY);
            while (true) {
                var x2: number = this.stream.readUint8();
                if (x2 >= 0xF0)
                    break;
                this.drawLine(startX, startY, x2, startY);
                startX = x2;
                var y2: number = this.stream.readUint8();
                if (y2 >= 0xF0)
                    break;
                this.drawLine(startX, startY, startX, y2);
                startY = y2;
            }
            this.stream.position--;
        }

        private opDrawYCorner(): void {
            var startX: number = this.stream.readUint8();
            var startY: number = this.stream.readUint8();
            this.setPixel(startX, startY);
            while (true) {
                var y2: number = this.stream.readUint8();
                if (y2 >= 0xF0)
                    break;
                this.drawLine(startX, startY, startX, y2);
                startY = y2;
                var x2: number = this.stream.readUint8();
                if (x2 >= 0xF0)
                    break;
                this.drawLine(startX, startY, x2, startY);
                startX = x2;
            }
            this.stream.position--;
        }

        private opDrawAbs(): void {
            var startX: number = this.stream.readUint8();
            var startY: number = this.stream.readUint8();

            while (true) {
                var nextX: number = this.stream.readUint8();
                if (nextX >= 0xF0)
                    break;
                var nextY: number = this.stream.readUint8();
                this.drawLine(startX, startY, nextX, nextY);
                startX = nextX;
                startY = nextY;
            }
            this.stream.position--;
        }

        private opDrawRel(): void {
            var startX: number = this.stream.readUint8();
            var startY: number = this.stream.readUint8();

            while (true) {
                var val: number = this.stream.readUint8();
                if (val >= 0xF0)
                    break;
                var xDisp: number = (val >>> 4) & 0x07;
                if ((val & 0x80) === 0x80)
                    xDisp = -xDisp;
                var yDisp: number = val & 0x07;
                if ((val & 8) == 8)
                    yDisp = -yDisp;
                var nextX: number = startX + xDisp;
                var nextY: number = startY + yDisp;
                this.drawLine(startX, startY, nextX, nextY);
                startX = nextX;
                startY = nextY;
            }
            this.stream.position--;
        }

        private opFillFastQueue(): void {
            while (true) {
                var queue: FastQueue = new FastQueue();
                var startX: number = this.stream.readUint8();
                if (startX >= 0xF0)
                    break;
                var startY: number = this.stream.readUint8();
                queue.enqueue(startX);
                queue.enqueue(startY);

                // Visible
                var pos: any;
                var x: number;
                var y: number;
                while (!queue.isEmpty()) {
                    x = queue.dequeue();
                    y = queue.dequeue();
                    if (this.picEnabled) {
                        if (this.visible.data[y * Bitmap.width + x] != 0x0F)
                            continue;
                        this.setPixel(x, y, true, false);
                    }
                    if (this.priEnabled) {
                        if (this.priority.data[y * Bitmap.width + x] != 0x04)
                            continue;
                        this.setPixel(x, y, false, true);
                    }
                    if (x > 0) {
                        queue.enqueue(x - 1);
                        queue.enqueue(y);
                    }
                    if (x < Bitmap.width - 1) {
                        queue.enqueue(x + 1);
                        queue.enqueue(y);
                    }
                    if (y > 0) {
                        queue.enqueue(x);
                        queue.enqueue(y - 1);
                    }
                    if (y < Bitmap.height - 1) {
                        queue.enqueue(x);
                        queue.enqueue(y + 1);
                    }
                }
            }
            this.stream.position--;
        }

        penSize: number = 0;
        penSplatter: boolean = false;
        penRectangle: boolean = true;
        private opSetPen(): void {
            var value: number = this.stream.readUint8();
            this.penSplatter = ((value & 0x20) == 0x20);
            this.penRectangle = ((value & 0x10) == 0x10);
            this.penSize = value & 0x07;
        }

        circles: string[][] = [
            ["p"],
            ["xp"],
            [" x ", "xxx", "xpx", "xxx", " x "],
            [" xx ", " xx ", "xxxx", "xxpx", "xxxx", " xx ", " xx "],
            ["  x  ", " xxx ", "xxxxx", "xxxxx", "xxpxx", "xxxxx", "xxxxx", " xxx ", "  x  "]
            ["  xx  ", " xxxx ", " xxxx ", " xxxx ", "xxxxxx", "xxxpxx", "xxxxxx", " xxxx ", " xxxx ", " xxxx ", "  xx  "],
            ["  xxx  ", " xxxxx ", " xxxxx ", " xxxxx ", "xxxxxxx", "xxxxxxx", "xxxpxxx", "xxxxxxx", "xxxxxxx", " xxxxx ", " xxxxx ", " xxxxx ", "  xxx  "],
            ["   xx   ", "  xxxx  ", " xxxxxx ", " xxxxxx ", " xxxxxx ", "xxxxxxxx", "xxxxxxxx", "xxxxpxxx", "xxxxxxxx", "xxxxxxxx", " xxxxxx ", " xxxxxx ", " xxxxxx ", "  xxxx  ", "   xx   "]
        ];
        private drawPenRect(penX: number, penY: number) {
            var w: number = this.penSize + 1;
            var left = penX - Math.ceil(w / 2);
            var right = penX + Math.floor(w / 2);
            var top = penY - w;
            var bottom = penY + w;
            for (var x = left; x <= right; x++) {
                for (var y = top; y <= bottom; y++) {
                    this.setPixel(x, y);
                }
            }
        }

        private drawPenCircle(x: number, y: number) {
            
        }

        private drawPenSplat(x: number, y: number, texture: number) {

        }

        private opDrawPen(): void {
            while (true) {
                var firstArg: number = this.stream.readUint8();
                if (firstArg >= 0xF0)
                    break;
                if (this.penSplatter) {
                    var texNumber: number = firstArg;
                    var x: number = this.stream.readUint8();
                    var y: number = this.stream.readUint8();
                    this.drawPenSplat(x, y, texNumber);
                } else {
                    var x: number = firstArg;
                    var y: number = this.stream.readUint8();
                    if (this.penSize == 0) {
                        this.setPixel(x, y);
                    } else if (this.penRectangle) {
                        this.drawPenRect(x, y);
                    } else {
                        this.drawPenCircle(x, y);
                    }
                }
            }
            this.stream.position--;
        }

        draw(visualBuffer: Bitmap, priorityBuffer: Bitmap): void {
            this.stream.position = 0;
            this.visible = visualBuffer;
            this.priority = priorityBuffer;
            var processing: boolean = true;
            while (processing) {
                var opCode: number = this.stream.readUint8();
                if (opCode >= 0xF0) {
                    // opcode
                    switch (opCode) {
                        case PicOpcode.PicSetColor:
                            this.picEnabled = true;
                            this.picColor = this.stream.readUint8();
                            break;
                        case PicOpcode.PicDisable:
                            this.picEnabled = false;
                            break;
                        case PicOpcode.PriSetcolor:
                            this.priEnabled = true;
                            this.priColor = this.stream.readUint8();
                            break;
                        case PicOpcode.PriDisable:
                            this.priEnabled = false;
                            break;
                        case PicOpcode.DrawYCorner:
                            this.opDrawYCorner();
                            break;
                        case PicOpcode.DrawXCorner:
                            this.opDrawXCorner();
                            break;
                        case PicOpcode.DrawAbs:
                            this.opDrawAbs();
                            break;
                        case PicOpcode.DrawRel:
                            this.opDrawRel();
                            break;
                        case PicOpcode.DrawFill:
                            this.opFillFastQueue();
                            break;
                        case PicOpcode.SetPen:
                            this.opSetPen();
                            break;
                        case PicOpcode.DrawPen:
                            this.opDrawPen();
                            break;
                        case PicOpcode.End:
                            processing = false;
                            break;
                    }
                }
            }
        }
    }
}
