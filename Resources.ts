namespace Resources {
    interface IDirectoryEntry {
        volNo: number;
        volOffset: number;
    }

    var logdirRecords: IDirectoryEntry[] = [],
        picdirRecords: IDirectoryEntry[] = [],
        viewdirRecords: IDirectoryEntry[] = [],
        snddirRecords: IDirectoryEntry[] = [];
    var volBuffers: Fs.ByteStream[] = [];
    var availableVols: boolean[] = [];

    export var fontStream: Fs.ByteStream;
    export var words: any = [];

    function parseDirfile(buffer: Fs.ByteStream, records: IDirectoryEntry[]): void {
        var length: number = buffer.length / 3;
        for (var i: number = 0; i < length; i++) {
            var val: number = (buffer.readUint8() << 16) + (buffer.readUint8() << 8) + buffer.readUint8();
            var volNo: number = val >>> 20;
            var volOffset: number = val & 0xFFFFF;
            if (val >>> 16 == 0xFF)
                continue;
            records[i] = { volNo: volNo, volOffset: volOffset };
            if (availableVols[volNo] === undefined)
                availableVols[volNo] = true;
        }
    }
    function parseWordFile(buffer){
        buffer.position = 52

        let words = []
        let previousWord = ""
        let currentWord = ""
        let bytesRead = 0

        while(true) {
            previousWord = currentWord
            currentWord = ''

            if(bytesRead >= buffer.length) break
            var byteIn = buffer.readUint8(true)
            bytesRead++
                
            currentWord = previousWord.substring(0, byteIn)

            while(true) {
                if(bytesRead >= buffer.length) break
                var byteIn = buffer.readUint8(true)
                bytesRead++

                if(byteIn < 32) {
                    currentWord += String.fromCharCode(byteIn ^ 127)
                }
                else if(byteIn == 95) {
                    currentWord += " "
                }
                else if(byteIn > 127) {
                    currentWord += String.fromCharCode((byteIn - 128) ^ 127)
                    break;
                }
            }

            var wordNoLo = buffer.readUint8(true)
            var wordNoHi = buffer.readUint8(true)
            var wordblockNum = wordNoLo*256 + wordNoHi;
            if(wordblockNum > 10000) wordblockNum = 0;
            bytesRead+=2 
            
            if(!isNaN(wordblockNum)){
                if(words[wordblockNum]) {
                    words[wordblockNum].push(currentWord)
                }
                else {
                    words[wordblockNum] = []
                    words[wordblockNum].push(currentWord)
                }                
            }
        }

        return words
    }

    export enum AgiResource {
        Logic,
        Pic,
        View,
        Sound
    }

    export function readAgiResource(type: AgiResource, num: number): Fs.ByteStream {
        var record = null;
        switch (type) {
            case AgiResource.Logic:
                record = logdirRecords[num];
                break;
            case AgiResource.Pic:
                record = picdirRecords[num];
                break;
            case AgiResource.View:
                record = viewdirRecords[num];
                break;
            case AgiResource.Sound:
                record = snddirRecords[num];
                break;
            default:
                throw "Undefined resource type: " + type;
        }
        var volstream = new Fs.ByteStream(volBuffers[record.volNo].buffer, record.volOffset);
        var sig: number = volstream.readUint16();
        var volNo: number = volstream.readUint8();
        var resLength = volstream.readUint16();
        var volPart = new Fs.ByteStream(volstream.buffer, record.volOffset + 5, record.volOffset + 5 + resLength);
        return volPart;
    }

    export function load(path: string, done: () => void) {
        Fs.downloadAllFiles(path, ["LOGDIR", "PICDIR", "VIEWDIR", "SNDDIR"], (buffers: Fs.IByteStreamDict) => {
            console.log("Directory files downloaded.");
            parseDirfile(buffers["LOGDIR"], logdirRecords);
            parseDirfile(buffers["PICDIR"], picdirRecords);
            parseDirfile(buffers["VIEWDIR"], viewdirRecords);
            parseDirfile(buffers["SNDDIR"], snddirRecords);
            var volNames: string[] = [];
            for (var i = 0; i < availableVols.length; i++) {
                if (availableVols[i] === true) {
                    volNames.push("VOL." + i);
                }
            }
            Fs.downloadAllFiles(path, volNames, (buffers: Fs.IByteStreamDict) => {
                console.log("Resource volumes downloaded.");
                for (var j: number = 0; j < volNames.length; j++) {
                    volBuffers[j] = buffers[volNames[j]];
                }

                // fonts don't come with the games. Maybe there should be a call for system files?
                // assume they are a folder up?
                var fontPath = path.endsWith("/") ? path.substring(0, path.length-1) : path // remove trailing slash
                    fontPath = fontPath.substring(0, fontPath.lastIndexOf("/")+1) // remove last folder 

                    Fs.downloadAllFiles(fontPath, ["font.bin"], (buffers: Fs.IByteStreamDict) => {
                    fontStream = buffers["font.bin"];
                    done();
                });

            // WORDS.TOK
            Fs.downloadAllFiles(path, ["WORDS.TOK"], (buffers) => {
                var wordsStream = buffers["WORDS.TOK"];
                Resources.words = parseWordFile(wordsStream)
                done();
            });
                
            });
        });
    }
}