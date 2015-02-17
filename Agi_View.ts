module Agi {
    export class Cel {
        pixelData: Uint8Array;
        constructor(public width: number, public height: number, public transparentColor: number, public mirrored: boolean, public mirroredLoop: number) {
        }
    }

    export class Loop {
        cels: Cel[] = [];
    }

    export class View {
        loops: Loop[] = [];
        description: string;

        constructor(data: Fs.ByteStream) {
            var unk1: number = data.readUint8();
            var unk2: number = data.readUint8();
            var numLoops = data.readUint8();
            var descriptionOffset: number = data.readUint16();
            for (var i = 0; i < numLoops; i++) {
                // Loop header
                var loop: Loop = new Loop();
                var loopOffset: number = data.readUint16();
                var streamPosLoop: number = data.position;
                data.position = loopOffset;
                var numCels: number = data.readUint8();
                for (var j = 0; j < numCels; j++) {
                    var celOffset: number = data.readUint16();
                    var streamPosCel: number = data.position;
                    data.position = loopOffset + celOffset;
                    // Cel header
                    var celWidth: number = data.readUint8();
                    var celHeight: number = data.readUint8();
                    var celMirrorTrans: number = data.readUint8();
                    var celMirrored: boolean = (celMirrorTrans & 0x80) == 0x80;
                    var celMirrorLoop: number = (celMirrorTrans >>> 4) & 7;
                    var celTransparentColor: number = celMirrorTrans & 0x0F;
                    if (celMirrorLoop == i)
                        celMirrored = false;

                    var cel = new Cel(celWidth, celHeight, celTransparentColor, celMirrored, celMirrorLoop);
                    if (!celMirrored) {
                        cel.pixelData = new Uint8Array(cel.width * cel.height);
                        for (var k = 0; k < cel.pixelData.length; k++) {
                            cel.pixelData[k] = celTransparentColor;
                        }
                        var celY: number = 0;
                        var celX: number = 0;
                        while (true) {
                            var chunkData: number = data.readUint8();
                            if (chunkData == 0) {
                                celX = 0;
                                celY++;
                                if (celY >= celHeight)
                                    break;
                            }
                            var color: number = chunkData >>> 4;
                            var numPixels: number = chunkData & 0x0F;
                            for (var x: number = 0; x < numPixels; x++) {
                                cel.pixelData[celY * celWidth + celX + x] = color;
                            }
                            celX += numPixels;
                        }
                    }
                    loop.cels[j] = cel;
                    data.position = streamPosCel;
                }
                this.loops[i] = loop;
                data.position = streamPosLoop;
            }
            data.position = descriptionOffset;
            while (true) {
                var chr: number = data.readUint8();
                if (chr == 0)
                    break;
                this.description += String.fromCharCode(chr);
            }
        }
    }
} 