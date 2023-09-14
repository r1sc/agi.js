namespace Agi {
    export class Sound {
        constructor(soundNo, data) {
            this.data = data
            this.started = false
            this.ended = false
            this.frame = -1

            this.audioCtx = new AudioContext();
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.connect(this.audioCtx.destination);
            this.oscillator.type = "sine";            
            
            this.voices = { 
                voice1: {
                    durationRemaining: 0,
                    audioStop: true,
                    fequency: 0,
                    position: 0,
                    offset: 0
                },
                voice2: {
                    durationRemaining: 0,
                    audioStop: true,
                    fequency: 0,
                    position: 0,
                    offset: 0
                },
                voice3: {
                    durationRemaining: 0,
                    audioStop: true,
                    fequency: 0,
                    position: 0,
                    offset: 0
                },
                voice4: {
                    durationRemaining: 0,
                    audioStop: true,
                    fequency: 0,
                    position: 0,
                    offset: 0
                }
            }
        }

        doSoundFrame () {

            try{
                //console.log("beep " + this.frame + ": " + this.voices.voice1.frequency + " ("+this.voices.voice1.durationRemaining+")")
                this.oscillator.frequency.setValueAtTime(this.voices.voice1.frequency, this.audioCtx.currentTime); // value in hertz                 

                var now = new Date().getTime();
                while(new Date().getTime() < now + 5){  }  



            }catch(e){
                // Nothing to be done    
            }

            this.voices.voice1.durationRemaining = this.voices.voice1.durationRemaining - 4000

        }        

        play (soundNo, flagNo) {
            this.frame = 0;
            this.playCycle()
        }

        stop () {
            this.ended = true; 
            this.oscillator.stop()
        }
        
        playCycle () {
            var readNextFrame = false

            if(this.started == false) {
                this.oscillator.start();
                this.started = true
                readNextFrame = true
            }
            else if (this.voices.voice1.durationRemaining <= 0) {
                readNextFrame = true
            }

            if(readNextFrame) {
                this.frame = this.frame + 1 // starts at -1 so first frame is 0
                var littleEndian = false

                // read the header
                this.data.position = 0;
                var v1Offest = this.data.readUint8(littleEndian);
                var v2Offest = this.data.readUint8(littleEndian);
                var v3Offest = this.data.readUint8(littleEndian);
                var v4Offest = this.data.readUint8(littleEndian);
    
                // calculate the frame 
                this.data.position = this.voices.voice1.offset + ( this.frame * 5 ) 
    
                // Get the frequency for the duration frame
                var duration = this.data.readUint16(littleEndian);
                var noteHigh = this.data.readUint8(littleEndian);
                var noteLow = this.data.readUint8(littleEndian);
                var maxNoteLow = this.data.readUint8(littleEndian);                
    
                // decode the frequency
                this.voices.voice1.offset = v1Offest
                this.voices.voice1.durationRemaining = duration
                this.voices.voice1.frequency = 99320 / (((noteHigh & 0x3F) << 4) + (noteLow & 0x0F))
    
                if(duration == 65535 /* 0xFF 0xFF */) {
                    // marks the end of the audio
                    this.stop()
                }
                else if(isFinite(this.voices.voice1.frequency)==false) {
                    this.voices.voice1.frequency = 0;
                }
            }

            if(this.ended == false) {
                this.doSoundFrame()
            }
        }
    }
} 