namespace Agi {
    /* writing text via HTML is easier than drawing a dialogue box and blitting in the text. Anyway it beats alert(..)
       If there's a goal to run this code server side then this needs to change.
       For now assume HTML and hide all the implementation details. 
       */
    export class Dialogue {
        mode = 1;
        outterEl;
        innerEl;

        constructor() {
            this.outterEl = document.createElement("div")
            this.innerEl = document.createElement("div")
            this.outterEl.appendChild(this.innerEl)
            document.body.appendChild(this.outterEl)

            this.outterEl.style.display = "none"   
            this.outterEl.style.width = "auto"  
            this.outterEl.style.top = "20%"
            this.outterEl.style.left = "25%"
            this.outterEl.style.position = "absolute"
            this.outterEl.style.backgroundColor = "white"
            this.outterEl.style.padding = "15px"
            this.outterEl.style.marginRight = "25%"
            this.outterEl.style.fontSize = "xx-large"
            
            this.innerEl.style.display = "block"
            this.innerEl.style.width = "auto"
            this.innerEl.style.height = "90%"
            this.innerEl.style.padding = "15px"
            this.innerEl.style.fontFamily = "system-ui"
            this.innerEl.style.fontWeight = "bolder"
            // this.innerEl.style.fontFamily = "agifont"
            this.innerEl.style.border = "solid 9px darkred"
        }

        open () {
            this.outterEl.style.display = "block" 
        }

        close() {
            this.outterEl.style.display = "none"                
        }

        setText(text) {
            this.innerEl.innerHTML = text 
        }

        setMode(mode) {
        
        }
    }
} 