// https://gist.github.com/infloop/8469659
var Queue = (function () {
    function Queue() {
        // initialise the queue and offset
        this.queue = [];
        this.offset = 0;
    }
    /**
    * Returns the length of the queue.
    *
    * @returns {number}
    */
    Queue.prototype.getLength = function () {
        // return the length of the queue
        return (this.queue.length - this.offset);
    };

    /**
    * Returns true if the queue is empty, and false otherwise.
    *
    * @returns {boolean}
    */
    Queue.prototype.isEmpty = function () {
        // return whether the queue is empty
        return (this.queue.length == 0);
    };

    /**
    * Adds the specified item. The parameter is:
    *
    * @param item
    */
    Queue.prototype.add = function (item) {
        return this.queue.push(item);
    };

    /**
    * Gets an item and returns it. If the queue is empty then undefined is
    * returned.
    *
    * @returns {*}
    */
    Queue.prototype.get = function () {
        // if the queue is empty, return undefined
        if (this.queue.length == 0)
            return undefined;

        // store the item at the front of the queue
        var item = this.queue[this.offset];

        // increment the offset and remove the free space if necessary
        if (++this.offset * 2 >= this.queue.length) {
            this.queue = this.queue.slice(this.offset);
            this.offset = 0;
        }

        return item;
    };

    /**
    * Returns the item at the front of the queue (without dequeuing it). If the
    * queue is empty then undefined is returned.
    *
    * @returns {*}
    */
    Queue.prototype.peek = function () {
        // return the item at the front of the queue
        return (this.queue.length > 0 ? this.queue[this.offset] : undefined);
    };
    return Queue;
})();
//# sourceMappingURL=Queue.js.map
