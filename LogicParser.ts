namespace Agi {
    interface IStatement {
        (...args: number[]): void;
    }

    interface ITest {
        (...args: number[]): boolean;
    }

    class AstNode {
        constructor(public opcode: number, public byteOffset: number) {
            
        }
        public args: number[];
    }

    class Scope
    {
        public endOffset: number;
        public body: AstNode[] = [];
    }

    class ExpressionNode extends AstNode  {
        public eval(interpreter: Interpreter): boolean {
            throw "Cannot invoke ExpressionNode directly";
        }
    }

    class BinaryNode extends ExpressionNode {
        public type: number;
        public left: ExpressionNode;
        public right: ExpressionNode;
    }

    class AndNode extends BinaryNode {
        public eval(interpreter: Interpreter): boolean {
            var left = this.left.eval(interpreter);
            var right = this.right.eval(interpreter);
            return left && right;
        }
    }

    class OrNode extends BinaryNode {
        public eval(interpreter: Interpreter): boolean {
            var left = this.left.eval(interpreter);
            var right = this.right.eval(interpreter);
            return left || right;
        }
    }

    class TestNode extends ExpressionNode {
        constructor(opcode: number, byteOffset: number) {
            super(opcode, byteOffset);
        }

        public test: ITest;
        public negate: boolean = false;

        public eval(interpreter: Interpreter): boolean {
            var result = this.test.apply(interpreter, this.args);
            return this.negate ? !result : result;
        }
    }

    class StatementNode extends AstNode {
        constructor(opcode: number, byteOffset: number, private statement: IStatement) {
            super(opcode, byteOffset);
        }
        public execute(interpreter: Interpreter) {
            this.statement.apply(interpreter, this.args);
        }
    }

    class IfNode extends AstNode {
        constructor(byteOffset: number) {
            super(0xFF, byteOffset);
        }
        public expression: ExpressionNode;
        public then: Scope = new Scope();
        public else: Scope;
    }

    class GotoNode extends AstNode {
        constructor(byteOffset: number, public offset: number) {
            super(0xFE, byteOffset);
        }
    }

    class ReturnNode extends AstNode {
        constructor(byteOffset: number) {
            super(0x00, byteOffset);
        }
    }

    export class LogicParser {
        logic: Logic;
        scanStart: number;
        private decryptionKey: string = "Avis Durgan";
        private entryPoint: number;
        private messagesStartOffset: number;
        private static tests: string[] = [
            "equaln",
            "equalv",
            "lessn",
            "lessv",
            "greatern",
            "greaterv",
            "isset",
            "issetv",
            "has",
            "obj_in_room",
            "posn",
            "controller",
            "have_key",
            "said",
            "compare_strings",
            "obj_in_box",
            "center_posn",
            "right_posn"
        ];
        private static statements: string[] = [
            "return",
            "increment",
            "decrement",
            "assignn",
            "assignv",
            "addn",
            "addv",
            "subn",
            "subv",
            "lindirectv",
            "rindirect",
            "lindirectn",
            "set",
            "reset",
            "toggle",
            "set_v",
            "reset_v",
            "toggle_v",
            "new_room",
            "new_room_v",
            "load_logic",
            "load_logic_v",
            "call",
            "call_v",
            "load_pic",
            "draw_pic",
            "show_pic",
            "discard_pic",
            "overlay_pic",
            "show_pri_screen",
            "load_view",
            "load_view_v",
            "discard_view",
            "animate_obj",
            "unanimate_all",
            "draw",
            "erase",
            "position",
            "position_v",
            "get_posn",
            "reposition",
            "set_view",
            "set_view_v",
            "set_loop",
            "set_loop_v",
            "fix_loop",
            "release_loop",
            "set_cel",
            "set_cel_v",
            "last_cel",
            "current_cel",
            "current_loop",
            "current_view",
            "number_of_loops",
            "set_priority",
            "set_priority_v",
            "release_priority",
            "get_priority",
            "stop_update",
            "start_update",
            "force_update",
            "ignore_horizon",
            "observe_horizon",
            "set_horizon",
            "object_on_water",
            "object_on_land",
            "object_on_anything",
            "ignore_objs",
            "observe_objs",
            "distance",
            "stop_cycling",
            "start_cycling",
            "normal_cycle",
            "end_of_loop",
            "reverse_cycle",
            "reverse_loop",
            "cycle_time",
            "stop_motion",
            "start_motion",
            "step_size",
            "step_time",
            "move_obj",
            "move_obj_v",
            "follow_ego",
            "wander",
            "normal_motion",
            "set_dir",
            "get_dir",
            "ignore_blocks",
            "observe_blocks",
            "block",
            "unblock",
            "get",
            "get_v",
            "drop",
            "put",
            "put_v",
            "get_room_v",
            "load_sound",
            "sound",
            "stop_sound",
            "print",
            "print_v",
            "display",
            "display_v",
            "clear_lines",
            "text_screen",
            "graphics",
            "set_cursor_char",
            "set_text_attribute",
            "shake_screen",
            "configure_screen",
            "status_line_on",
            "status_line_off",
            "set_string",
            "get_string",
            "word_to_string",
            "parse",
            "get_num",
            "prevent_input",
            "accept_input",
            "set_key",
            "add_to_pic",
            "add_to_pic_v",
            "status",
            "save_game",
            "restore_game",
            "init_disk",
            "restart_game",
            "show_obj",
            "random",
            "program_control",
            "player_control",
            "obj_status_v",
            "quit",
            "show_mem",
            "pause",
            "echo_line",
            "cancel_line",
            "init_joy",
            "toggle_monitor",
            "version",
            "script_size",
            "set_game_id",
            "log",
            "set_scan_start",
            "reset_scan_start",
            "reposition_to",
            "reposition_to_v",
            "trace_on",
            "trace_info",
            "print_at",
            "print_at_v",
            "discard_view_v",
            "clear_text_rect",
            "set_upper_left",
            "set_menu",
            "set_menu_member",
            "submit_menu",
            "enable_member",
            "disable_member",
            "menu_input",
            "show_obj_v",
            "open_dialogue",
            "close_dialogue",
            "mul_n",
            "mul_v",
            "div_n",
            "div_v",
            "close_window",
            "set_simple",
            "push_script",
            "pop_script",
            "hold_key",
            "set_pri_base",
            "discard_sound",
            "hide_mouse",
            "allow_menu",
            "show_mouse",
            "fence_mouse",
            "mouse_posn",
            "release_key",
            "adj_ego_move_to_xy"
        ];

        constructor(private interpreter: Interpreter, private no: number) {
            this.loadLogic(no);
        }

        private readUint8(): number {
            return this.logic.data.readUint8();
        }
        private readUint16(): number {
            return this.logic.data.readUint16();
        }
        private readInt16(): number {
            return this.logic.data.readInt16();
        }
        private jumpRelative(offset: number): void {
            this.logic.data.position += offset;
        }

        loadLogic(no: number): void {
            this.logic = new Logic(no, Resources.readAgiResource(Resources.AgiResource.Logic, no));
            var messageOffset: number = this.readUint16();
            this.logic.data.position += messageOffset;
            var pos = this.logic.data.position;
            this.messagesStartOffset = pos;
            var numMessages: number = this.readUint8();
            var ptrMessagesEnd: number = this.readUint16();
            var decryptionIndex: number = 0;
            for (var i = 0; i < numMessages; i++) {
                var msgPtr: number = this.readUint16();
                if (msgPtr == 0)
                    continue;
                var mpos = this.logic.data.position;
                this.logic.data.position = pos + msgPtr + 1;
                var msg: string = "";
                while (true) {
                    var decrypted: string = String.fromCharCode(this.decryptionKey[decryptionIndex++].charCodeAt(0) ^ this.readUint8());
                    if (decryptionIndex >= this.decryptionKey.length)
                        decryptionIndex = 0;
                    if (decrypted == '\0')
                        break;
                    msg += decrypted;
                }
                this.logic.messages[i + 1] = msg;
                this.logic.data.position = mpos;
            }
            this.logic.data.position = pos - messageOffset;
            this.scanStart = this.entryPoint = this.logic.data.position;
        }

        decompile(): Scope {
            var program: Scope = new Scope();
            var scope: Scope = program;
            var scopeStack: Scope[] = [];
            var currentIfNode: IfNode;
            var lastGotoOffset: number = 0;

            this.logic.data.position = this.scanStart;
            while (this.logic.data.position < this.messagesStartOffset) {
                while (scope.endOffset > 0 && this.logic.data.position == scope.endOffset) {
                    if (scopeStack.length > 0)
                        scope = scopeStack.pop();
                    else
                        scope.endOffset = 0;
                }
                var opcode: number = this.readUint8();
                if (opcode == 0xFF) {
                    currentIfNode = new IfNode(this.logic.data.position);
                    scope.body.push(currentIfNode);

                    var expressionStack: ExpressionNode[] = [];
                    var or: boolean = false;

                    while (true) {
                        var negate: boolean = false;
                        opcode = this.readUint8();
                        if (opcode == 0xFF)
                            break;
                        else if (opcode == 0xFC) {
                            or = !or;
                            continue;
                        }
                        else if (opcode == 0xFD) {
                            negate = true;
                            opcode = this.readUint8();
                        }
                        var funcName = LogicParser.tests[opcode - 1];
                        var test = <ITest>this.interpreter["agi_test_" + funcName];
                        var args: number[] = [];
                        var numArgs = test.length;
                        if (opcode == 0x0E) {
                            numArgs = this.readUint8() * 2;
                        }
                        for (var i = 0; i < numArgs; i++) {
                            var arg = this.readUint8();
                            args.push(arg);
                        }
                        var testNode = new TestNode(opcode, this.logic.data.position);
                        testNode.opcode = opcode;
                        testNode.args = args;
                        testNode.negate = negate;
                        expressionStack.push(testNode);

                        if (expressionStack.length == 2) {
                            var bn: BinaryNode;
                            if (or)
                                bn = new OrNode(opcode, this.logic.data.position);
                            else {
                                bn = new AndNode(opcode, this.logic.data.position);
                            }
                            bn.right = expressionStack.pop();
                            bn.left = expressionStack.pop();
                            expressionStack.push(bn);
                        }
                    }

                    currentIfNode.expression = expressionStack.pop();
                    currentIfNode.then = new Scope();

                    scopeStack.push(scope);
                    scope = currentIfNode.then;
                    scope.endOffset = this.logic.data.position + this.readUint16() + 2;
                }
                else if (opcode == 0xFE) {
                    var rel = this.readInt16();
                    var offset = this.logic.data.position + rel;
                    if (rel < 0) {
                        scope.body.push(new GotoNode(this.logic.data.position, offset));
                        lastGotoOffset = this.logic.data.position;
                    } else {
                        currentIfNode.else = new Scope();
                        scope = currentIfNode.else;
                        scope.endOffset = offset;
                    }
                } else {
                    if (opcode == 0x00) {
                        scope.body.push(new ReturnNode(this.logic.data.position));
                        continue;
                    }
                    funcName = LogicParser.statements[opcode];
                    var statement = <IStatement>this.interpreter["agi_" + funcName];
                    var args: number[] = [];
                    for (var i = 0; i < statement.length; i++) {
                        var arg = this.readUint8();
                        args.push(arg);
                    }
                    scope.body.push(new StatementNode(opcode, this.logic.data.position, statement));
                }
            }

            //lines.push("");
            //lines.push("// Messages");
            //var j: number = 0;
            //this.logic.messages.forEach((message, i) => {
            //    lines.push("#message" + i + ' = "' + message.replace(/"/g, '\\"') + '"');
            //});

            //return lines;
            return program;
        }

        private static stNo: number = 0;
        parseLogic(): void {
            var orMode: boolean = false;
            var invertMode: boolean = false;
            var testMode: boolean = false;
            var testResult: boolean = true;
            var debugLine: string = "";
            var orResult: boolean = false;
            var funcName: string;
            var test: ITest;
            var statement: IStatement;
            var args: number[];

            this.logic.data.position = this.scanStart;
            while (true) {
                var opCodeNr: number = this.readUint8();
                if (opCodeNr == 0x00) {
                    //console.log("L" + this.logic.no + ": " + "return");
                    break;
                }
                else if (opCodeNr == 0x91) {
                    // set.scan.start
                    this.scanStart = this.logic.data.position + 1;
                }
                else if (opCodeNr == 0x92) {
                    // reset.scan.start
                    this.scanStart = this.entryPoint;
                }
                else if (opCodeNr == 0xFE) {
                    var n1: number = this.readUint8();
                    var n2: number = this.readUint8();
                    var offset: number = (((n2 << 8) | n1) << 16) >> 16;
                    this.jumpRelative(offset);
                    //console.log("L" + this.logic.no + ": " + "goto " + offset);
                }
                else if (opCodeNr == 0xFF) {
                    if (testMode) {
                        testMode = false;
                        // Evaluate last test
                        var elseOffset: number = this.readUint16();
                        if (testResult != true) {
                            //console.log(debugLine + ") = F");
                            this.jumpRelative(elseOffset);
                        } else {
                            //console.log(debugLine + ") = T");
                        }
                    } else {
                        debugLine = "if(";
                        invertMode = false;
                        orMode = false;
                        testResult = true;
                        orResult = false;
                        testMode = true;
                    }
                }
                else if (testMode) {
                    if (opCodeNr == 0xFC) {
                        orMode = !orMode;
                        if (orMode === true)
                            orResult = false;
                        else {
                            testResult = testResult && orResult;
                        }
                    } else if (opCodeNr == 0xFD)
                        invertMode = !invertMode;
                    else {
                        funcName = LogicParser.tests[opCodeNr - 1];
                        test = <ITest>this.interpreter["agi_test_" + funcName];
                        args = [];
                        var argLen: number = test.length;
                        if (opCodeNr == 0x0E) { // Said, variable nr of arguments
                            argLen = this.readUint8();
                            for (var i = 0; i < argLen; i++) {
                                args.push(this.readUint16());
                            }
                        } else {
                            for (var i = 0; i < argLen; i++) {
                                args.push(this.readUint8());
                            }
                        }
                        var result = test.apply(this.interpreter, args);
                        if (testResult == null)
                            debugLine += funcName;
                        else {
                            debugLine += (orMode ? " || " : " && ") + funcName;
                        }
                        if (invertMode) {
                            result = !result;
                            invertMode = false;
                        }

                        if (orMode) {
                            orResult = orResult || result;
                        } else {
                            testResult = testResult && result;
                        }
                    }
                } else {
                    funcName = LogicParser.statements[opCodeNr];
                    //console.log(funcName);
                    statement = <IStatement>this.interpreter["agi_" + funcName];
                    if (statement === undefined)
                        throw "Statement not implemented: " + funcName;
                    debugLine = funcName;
                    //console.log(LogicParser.stNo + " @L" + this.logic.no + ": " + debugLine);

                    args = [];
                    for (var i = 0; i < statement.length; i++) {
                        args.push(this.readUint8());
                    }
                    statement.apply(this.interpreter, args);
                    LogicParser.stNo++;
                    if (opCodeNr == 0x12) // new.room
                    {
                        this.logic.data.position = 0;
                        break;
                    }
                }
            }
        }
    }
}