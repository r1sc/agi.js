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
                Fs.downloadAllFiles("", ["font.bin"], (buffers: Fs.IByteStreamDict) => {
                    fontStream = buffers["font.bin"];
                    done();
                });
            });
        });
    }
}