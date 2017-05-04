namespace Agi {
    export class FastQueue {
        maxSize: number = 8000;
        private container: Uint8Array = new Uint8Array(this.maxSize);
        private eIndex: number = 0;
        private dIndex: number = 0;

        isEmpty(): boolean {
            return this.eIndex == this.dIndex;
        }

        enqueue(val: number) {
            if (this.eIndex + 1 == this.dIndex || (this.eIndex + 1 == this.maxSize && this.dIndex == 0))
                throw "Queue overflow";
            this.container[this.eIndex++] = val;
            if (this.eIndex == this.maxSize)
                this.eIndex = 0;
        }

        dequeue(): number {
            if (this.dIndex == this.maxSize)
                this.dIndex = 0;
            if (this.dIndex == this.eIndex)
                throw "The queue is empty";
            return this.container[this.dIndex++];
        }
    }
}