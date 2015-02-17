module Fs {
    export class ByteStream {
        position: number = 0;
        length: number = 0;
        constructor(public buffer: Uint8Array, private startPosition: number = 0, private end: number = 0) {
            if (end == 0)
                this.end = this.buffer.byteLength;
            this.length = this.end - this.startPosition;
        }

        readUint8(): number {
            return this.buffer[this.startPosition + this.position++];
        }

        readUint16(littleEndian: boolean = true): number {
            var b1: number = this.buffer[this.startPosition + this.position++];
            var b2: number = this.buffer[this.startPosition + this.position++];
            if (littleEndian) {
                return (b2 << 8) + b1;
            }
            return (b1 << 8) + b2;
        }
    }
}