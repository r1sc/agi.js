/// <reference path="ByteStream.ts" />
module Fs {
    export interface IByteStreamDict {
        [index: string]: ByteStream;
    }

    export function downloadAllFiles(path: string, files: string[], done: (buffers: IByteStreamDict) => void) {
        var buffers: IByteStreamDict = {};
        var leftToDownload: number = files.length;

        function getBinary(url: string, success: (data: ArrayBuffer) => void): void {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';
            xhr.onreadystatechange = () => {
                if (xhr.readyState == 4) {
                    if (xhr.response === null) {
                        throw "Fatal error downloading '" + url + "'";
                    } else {
                        console.log("Successfully downloaded '" + url + "'");
                        success(xhr.response);
                    }
                }
            };
            xhr.send();
        }

        function handleFile(num: number) {
            getBinary(path + files[num], (buffer: ArrayBuffer) => {
                buffers[files[num]] = new ByteStream(new Uint8Array(buffer));
                leftToDownload--;
                if (leftToDownload === 0) {
                    done(buffers);
                }
            });
        }

        for (var i = 0; i < files.length; i++) {
            handleFile(i);
        }
    }
}