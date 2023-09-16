/*
  Adventure Game Interpreter
  Original IBM PC version by Jeff Stephenson and Cris Iden
  of Sierra On-Line Inc. Around 1984-1989.
  
  JavaScript version by Erik Sandberg, 2014 (30th-ish anniversary!).
  This interpreter parses the original game resource files.
  I do not provide these files as they are the intellectual property of Sierra.
  
  This is not a straight port, but has been implemented from the specs
  defined by Lance Ewing, Peter Kelly, Claudio Matsuoka, Stu George and David Symonds
  at http://wiki.scummvm.org/index.php/AGI/Specifications
*/
namespace Agi {
    export var palette: number[] = [
        0x000000,
        0x0000AA,
        0x00AA00,
        0x00AAAA,
        0xAA0000,
        0xAA00AA,
        0xAA5500,
        0xAAAAAA,
        0x555555,
        0x5555FF,
        0x55FF55,
        0x55FFFF,
        0xFF5555,
        0xFF55FF,
        0xFFFF55,
        0xFFFFFF
    ];

    export var interpreter: Interpreter;
    export function start(path: string, context: CanvasRenderingContext2D) {
        Resources.load(path, () => {
            interpreter = new Interpreter(context);
            interpreter.start();

            window.onkeypress = function (e) {
                if(e.keyCode == 32) {
                    // block the default scroll behavior
                    e.preventDefault();
                }

                //if (e.which != 13) {
                    // enter should be allowed to close a dialog
                    interpreter.keyboardCharBuffer.push(e.which);
                    console.log("Keypress: "+e.keyCode);
                //}
            };
            window.onkeydown = function (e) {
                if(e.keyCode == 40) {
                    // block the default scroll behavior
                    e.preventDefault();
                }

                interpreter.keyboardSpecialBuffer.push(e.which);
                console.log("keydown: "+e.keyCode);
            };

            (function renderloop() {
                //window.requestAnimationFrame(renderloop);
                interpreter.cycle();
                setTimeout(renderloop, (1000 / 20) * interpreter.variables[10]);
            })();
        });
    }
}