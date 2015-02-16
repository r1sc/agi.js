module Agi {
    export class Logic {
        messages: string[] = [];
        constructor(public no: number, public data: Fs.ByteStream){}
    }
} 