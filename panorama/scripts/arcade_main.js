/* CLASSES */

var gameOpen = false;

class GameObject {

    constructor(id, name, properties) {
        this.id = id;
        this.name = name;
        this.panel = $.CreatePanel("Panel", myCanvas, `CanvasObject_${id}`);

        this.position = {x: 0, y: 0};

        //$.Msg(`Properties: `);
        for (const [property, value] of Object.entries(properties)) {
            try {
                //$.Msg(` - ${property}: ${value}`);
                this.panel.style[property] = value;
            } catch (e) {
                $.Warning("Error reading property for gameobject - ");
                $.Warning(`${this.toString()} -> ${property}`);
            }
        }

        GameObject.prototype.toString = function() {
            return `GameObject ${this.id} - ${this.name}`;
        }

        this.panel.SetPanelEvent("onmouseover", () => {
            ArcadeEngine.focusedObject = this.panel;
            this.panel.SetFocus(true);
        })
        
        this.panel.SetPanelEvent("onmouseout", () => {
            ArcadeEngine.focusedObject = null;
            this.panel.SetFocus(false);
        })
    }

    /**
     * Changes the position of the GameObject.
     * 
     * @param {number} x 
     * @param {number} y 
     */
    Move(x, y) {
        this.position.x += x;
        this.position.y += y;
    }

    /**
     * Updates the GameObject.
     */
    Update() {
        let pos = { x: Math.round(this.position.x), y: Math.round(this.position.y)}
        this.panel.style.position = `${pos.x}.0px ${pos.y}.0px 0.0px`;
    }

    /**
     * Destroys the Game Object
     */
    Destroy() {
        ArcadeEngine.DestroyObject(this);
    }

}

class ArcadeEngine {

    static gameObjectsCounter = 0;
    static focusedObject = null;

    static gameObjects = [];

    static startCallbacks = [];
    static updateCallbacks = [];
    static keyCallbacks = {

    };

    static lastUpdateTime = Date.now();

    static gameOpen = false;
    static gameActive = false;

    /**
     * Creates a Game Object, with a name and css properties.
     * 
     * @param {string} name The name of the Game Object.
     * @param {{}} properties Key, Value object of css properties.
     * 
     * @example
     * ```js
     * ArcadeEngine.createGameObject("RedSquare", {
     *     width: "16px",
     *     height: "16px",
     *     backgroundColor: "#FF4136"
     * });
     * ```
     * @returns 
     */
    static createGameObject(name, properties) {
        let go = new GameObject(this.gameObjectsCounter, name, properties);
        // finally, update game objects counter
        this.gameObjectsCounter++;
        this.gameObjects.push(go);
        return go;
    }

    /**
     * Runs a function when a specific key has been pressed.
     * Registers the key in the `keyCallbacks` object if not already present.
     * 
     * @param {string} key 
     * @param {(key: string) => {}} callback 
     */
    static onKeyPress(key, callback) {
        $.RegisterKeyBind("", key, function(){callback(key)});

        if (!ArcadeEngine.keyCallbacks[key]) {
            ArcadeEngine.keyCallbacks[key] = [];
            $.RegisterKeyBind("", key, function() {
                // check edge case where key bind was registered in another game
                if (!ArcadeEngine.keyCallbacks[key]) return;
                // run each cb for a key
                for (const cb of ArcadeEngine.keyCallbacks[key]) {
                    cb(key);
                }
            });
        }

        ArcadeEngine.keyCallbacks[key].push(callback);
    }

    /**
     * Starts the update loop
     */
    static Play() {
        $.Msg("Game Started!");

        ArcadeEngine.gameActive = true;
        ArcadeEngine.gameOpen = true;

        // Run start callbacks
        for (const callback of this.startCallbacks) {
            callback();
        }

        const updateInterval = 16;
        const update = () => {
            const now = Date.now();
            const dt = (now - this.lastUpdateTime) / 1000;
            this.lastUpdateTime = now;

            if (this.gameOpen && this.gameActive) {

                for (const callback of this.updateCallbacks) {
                    callback(dt);
                }

                for (const gameObject of ArcadeEngine.gameObjects) {
                    gameObject.Update();
                }

            } else if (!this.gameActive) {
                // break loop if game not active anymore
                return;
            }

            $.Schedule(updateInterval / 1000, update);
        }
        
        update();
    }

    /**
     * Runs the sent function when the game has been started.
     * 
     * @param {() => {}} callback 
     */
    static OnStart(callback) {
        this.startCallbacks.push(callback);
    }
    
    /**
     * Runs the sent function every frame (game update), if the arcade screen is open & the game is active.
     * 
     * @param {(dt: number) => {}} callback The function to run on frame update.
     */
    static OnUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    /**
     * Destroys the GameObject.
     * 
     * @param {GameObject} gameObject The GameObject to destroy.
     */
    static DestroyObject(gameObject) {
        if (!gameObject) {
            return;
        }

        if (gameObject.panel) {
            gameObject.panel.DeleteAsync(0);
            gameObject.panel = null;
        }

        const objectIndex = ArcadeEngine.gameObjects.indexOf(gameObject);
        if (objectIndex !== -1) {
            ArcadeEngine.gameObjects.splice(objectIndex, 1);
        }
    }

    /**
     * Resets the ArcadeEngine "Scene"
     */
    static Clear() {
        for (let i = ArcadeEngine.gameObjects.length - 1; i >= 0; i--) {
            ArcadeEngine.gameObjects[i].Destroy();
        }

        for (let i = ArcadeEngine.updateCallbacks.length - 1; i >= 0; i--) {
            ArcadeEngine.updateCallbacks.pop();
        }

        ArcadeEngine.keyCallbacks = {};

        this.gameActive = false;
        this.gameOpen = false;
    }

}

class SnakeGame {

    static Instance = null;

    constructor() {
        if (SnakeGame.Instance) {
            return;
        }

        SnakeGame.Instance = this;

        this.player = ArcadeEngine.createGameObject("Player", {
            width: "12px",
            height: "12px",
            margin: "4px",
            backgroundColor: "#39FF14",
        });

        this.dimensionsOfGame = {
            x: 40,
            y: 20
        }

        this.snake = [this.player];

        this.apple = null;
        this.score = 0;

        this.player.facing = "E";

        this.moveRate = 8;
        this.moveInterval = 1/this.moveRate;
        this.timeSinceLastMove = 1/this.moveRate;
    }

    resetGame() {
        if (!ArcadeEngine.gameActive) {
            // reset snake length
            this.snake.forEach((segment) => {
                segment.Destroy();
            });

            this.player = ArcadeEngine.createGameObject("Player", {
                width: "12px",
                height: "12px",
                margin: "4px",
                backgroundColor: "#39FF14",
            });

            this.snake = [this.player];
            this.score = 0;
    
            // reset snake position
            this.player.position = { x: 0, y: 0 };
            this.player.facing = `E`;
            ArcadeEngine.Play();

            // spawn original apple
            this.spawnApple();

            // update callback
            ArcadeEngine.OnUpdate((dt) => {
                if (dt >= 1) {
                    $.Msg(`Time passed: ${dt}`)
                    return;
                }
                this.timeSinceLastMove -= dt;
                if (this.timeSinceLastMove <= 0) {
                    this.timeSinceLastMove = this.moveInterval;
            
                    this.moveSnake();
                    this.checkCollisions();
            
                    if (this.player.position.x >= 648 || this.player.position.x < 0 || this.player.position.y >= 360 || this.player.position.y < 0) {
                        $.Msg(`Game over! Score = ${this.score}`);
                        ArcadeEngine.gameActive = false;
                    }
                }
            })

            // key presses
            ArcadeEngine.onKeyPress("key_W", (key) => {
                if (!this.player) return;
                this.player.facing = "N"
            })
            
            ArcadeEngine.onKeyPress("key_A", (key) => {
                if (!this.player) return;
                this.player.facing = "W"
            })
            
            ArcadeEngine.onKeyPress("key_S", (key) => {
                if (!this.player) return;
                this.player.facing = "S"
            })
            
            ArcadeEngine.onKeyPress("key_D", (key) => {
                if (!this.player) return;
                this.player.facing = "E"
            })
        } else {
            $.Msg("Continuing game...");
        }
    }
    
    spawnApple() {
        const randomX = Math.floor(Math.random() * this.dimensionsOfGame.x) * 16;
        const randomY = Math.floor(Math.random() * this.dimensionsOfGame.y) * 16;
    
        if (this.apple) {
            this.apple.Destroy();
        }
    
        this.apple = ArcadeEngine.createGameObject("Apple", {
            width: "12px",
            height: "12px",
            margin: "4px",
            backgroundColor: "#FF4136"
        });
    
        this.apple.position = { x: randomX, y: randomY };
        this.apple.Update();
    }
    
    growSnake() {
        const lastSegment = this.snake[this.snake.length - 1];
        const newSegment = ArcadeEngine.createGameObject("SnakeSegment", {
            width: "12px",
            height: "12px",
            margin: "4px",
            backgroundColor: "#39FF14"
        })
        newSegment.position = { x: lastSegment.position.x, y: lastSegment.position.y };
        newSegment.Update();
        this.snake.push(newSegment);
    }
    
    moveSnake() {
        for (let i = this.snake.length - 1; i > 0; i--) {
            this.snake[i].position.x = this.snake[i - 1].position.x;
            this.snake[i].position.y = this.snake[i - 1].position.y;
        }
    
        switch (this.player.facing) {
            case `N`:
                this.player.Move(0,-16);
                break;
            case `E`:
                this.player.Move(16,0);
                break;
            case `S`:
                this.player.Move(0,16);
                break;
            case `W`:
                this.player.Move(-16,0);
                break;
        }
    
        this.snake.forEach(segment => segment.Update());
    }
    
    checkCollisions() {
        // check for head collision on snake
        for (let i = 0; i < this.snake.length; i++) {
            if (this.player.id === this.snake[i].id) continue;
            if (this.player.position.x === this.snake[i].position.x && this.player.position.y === this.snake[i].position.y) {
                $.Msg(`Game over! Score = ${this.score}`);
                $.Msg(`${this.player.toString()} vs ${this.snake[i].toString()}`);
                ArcadeEngine.gameActive = false;
                //ArcadeEngine.gameOpen = false;
                return;
            }
        }
    
        // check collision for apple
        if (this.apple && this.player.position.x === this.apple.position.x && this.player.position.y === this.apple.position.y) {
            this.score += 1;
            this.growSnake();
            this.spawnApple();
        }
    }
}

class PongGame {
    
    static Instance = null;

    constructor() {
        if (PongGame.Instance) {
            return;
        }

        PongGame.Instance = this;
    }

    resetGame() {
        this.playerScore = 0;
        this.aiScore = 0;

        this.paddleMoveSpeed = 4;   // in pixels per frame
        this.ballMoveSpeed = 4;     // in pixels per frame

        this.playerPaddle = ArcadeEngine.createGameObject("PlayerPaddle", {
            width: "24px",
            height: "80px",
            backgroundColor: "#FFFFFF"
        });

        this.playerPaddle.moveDirection = "N";

        this.aiPaddle = ArcadeEngine.createGameObject("EnemyPaddle", {
            width: "24px",
            height: "80px",
            backgroundColor: "#FFFFFF"
        });

        // 60 pixels from edge
        this.playerPaddle.position.x = 60;
        this.aiPaddle.position.x = 588 - 24;    // -24 because width of paddle

        this.playerPaddle.position.y = 148;
        this.aiPaddle.position.y = 148;

        this.ball = ArcadeEngine.createGameObject("Ball", {
            width: "8px",
            height: "8px",
            backgroundColor: "#FFFFFF"
        });

        var coneAngle = 90;
        var angleDeg = (Math.random() * coneAngle) - (coneAngle / 2);
        var angle = angleDeg * (Math.PI / 180);
        var sign = Math.sign(Math.random() - 0.5);
        this.ball.moveDirection = { x: sign * Math.cos(angle), y: -Math.sin(angle) };
        this.ball.position.x = 320;
        this.ball.position.y = 184;

        ArcadeEngine.Play();

        // update callback
        ArcadeEngine.OnUpdate((dt) => {
            if (dt >= 1) {
                $.Msg(`Time passed: ${dt}`)
                return;
            }

            // move player paddle
            if (this.playerPaddle.moveDirection == "N") {
                this.playerPaddle.Move(0, -this.paddleMoveSpeed);
                if (this.playerPaddle.position.y <= 0) {
                    this.playerPaddle.position.y = 0;
                    this.playerPaddle.Update();
                }
            } else {
                this.playerPaddle.Move(0, this.paddleMoveSpeed);
                if (this.playerPaddle.position.y >= 292) {
                    this.playerPaddle.position.y = 292;
                    this.playerPaddle.Update();
                }
            }

            // move ball
            this.ball.Move(this.ballMoveSpeed * this.ball.moveDirection.x, this.ballMoveSpeed * this.ball.moveDirection.y);

            // move ai Paddle
            const dz = 12; // deadzone
            const pdc = this.aiPaddle.position.y + 40;

            if (Math.abs(this.ball.position.y - pdc) > dz) {
                if (this.ball.position.y < pdc) {
                    // move paddle up
                    this.aiPaddle.Move(0, -this.paddleMoveSpeed);
                    if (this.aiPaddle.position.y <= 0) {
                        this.aiPaddle.position.y = 0;
                        this.aiPaddle.Update();
                    }
                } else {
                    // move paddle down
                    this.aiPaddle.Move(0, this.paddleMoveSpeed);
                    if (this.aiPaddle.position.y >= 292) {
                        this.aiPaddle.position.y = 292;
                        this.aiPaddle.Update();
                    }
                }
            }

            // check screen collisions
            // top/bottom = bounce
            // left/right = score
            if ((this.ball.position.y <= 0 && this.ball.moveDirection.y < 0)) {
                this.ball.moveDirection.y = -this.ball.moveDirection.y;
                this.ball.position.y = 0;
                this.aiPaddle.Update();
            } else if (this.ball.position.y >= 366 && this.ball.moveDirection.y > 0) {
                this.ball.moveDirection.y = -this.ball.moveDirection.y;
                this.ball.position.y = 366;
                this.aiPaddle.Update();
            }

            if (this.ball.position.x <= -8) {
                this.aiScore++;
                this.resetBall();
                $.Msg(`AI Scored! (${this.aiScore})`);
            } else if (this.ball.position.x >= 640) {
                this.playerScore++;
                this.resetBall();
                $.Msg(`Player Scored! (${this.playerScore})`);
            }

            // end game if score is over 7 for either player, and a greater difference than 2
            if ((this.aiScore >= 7 || this.playerScore >= 7) && Math.abs(this.playerScore - this.aiScore) >= 2) {
                this.gameOver();
            }

            // check paddle collisions
            // if hit, bounce
            if (this.checkCollision(this.ball, this.playerPaddle)) {
                this.ball.moveDirection.x = Math.abs(this.ball.moveDirection.x);
                this.adjustBallAngle(this.ball, this.playerPaddle);
                this.ballMoveSpeed += 0.1;
            } else if (this.checkCollision(this.ball, this.aiPaddle)) {
                this.ball.moveDirection.x = -Math.abs(this.ball.moveDirection.x);
                this.adjustBallAngle(this.ball, this.aiPaddle);
                this.ballMoveSpeed += 0.1;
            }
        })

        // key presses
        ArcadeEngine.onKeyPress("key_W", (key) => {
            this.playerPaddle.moveDirection = "N";
        })

        ArcadeEngine.onKeyPress("key_S", (key) => {
            this.playerPaddle.moveDirection = "S";
        })
    }

    resetBall() {
        var coneAngle = 90;
        var angleDeg = (Math.random() * coneAngle) - (coneAngle / 2);
        var angle = angleDeg * (Math.PI / 180);
        var sign = Math.sign(Math.random() - 0.5);
        this.ball.moveDirection = { x: sign * Math.cos(angle), y: -Math.sin(angle) };
        this.ball.position.x = 320;
        this.ball.position.y = 184;
        this.ballMoveSpeed = 4;
    }

    gameOver() {
        $.Msg(`Game over!`);
        $.Msg(`Player Score = ${this.playerScore}`);
        $.Msg(`AI Score = ${this.aiScore}`);
        ArcadeEngine.gameActive = false;
        return;
    }

    checkCollision(ball, paddle) {
        return (
            ball.position.x < paddle.position.x + 24 &&
            ball.position.x + 24 > paddle.position.x &&
            ball.position.y < paddle.position.y + 80 &&
            ball.position.y + 80 > paddle.position.y
        );
    }

    adjustBallAngle(ball, paddle) {
        let paddleCenter = paddle.position.y + 80 / 2;
        let ballCenter = ball.position.y + 8 / 2;

        let offset = (ballCenter - paddleCenter) / (80 / 2);

        let maxAngle = 60;
        let angleDeg = offset * maxAngle;
        let angleRad = angleDeg * (Math.PI / 180);

        ball.moveDirection.x = Math.cos(angleRad) * Math.sign(ball.moveDirection.x);
        ball.moveDirection.y = Math.sin(angleRad);
    }

}

class GuidedOwlGame {
    
    static Instance = null;

    constructor() {
        if (GuidedOwlGame.Instance) {
            return;
        }

        GuidedOwlGame.Instance = this;
    }

    resetGame() {

        this.player = ArcadeEngine.createGameObject("GuidedOwl", {
            width: "48px",
            height: "32px",
            backgroundColor: "#55FF66",
        })

        this.player.position.x = 64;
        this.player.position.y = (376 - 32) / 2

        this.player.velocity = 0; // y velocity
        this.gravity = 256; // increase in velocity per frame

        this.columns = [];

        this.score = 0;

        ArcadeEngine.onKeyPress("key_Space", (key) => {
            if (this.player.velocity > 0) {
                this.player.velocity = -128;
            } else {
                this.player.velocity += -128;
            }
        })

        ArcadeEngine.onKeyPress("key_Escape", (key) => {
            this.gameOver();
        })

        ArcadeEngine.Play();

        this.spawnInterval = 2;
        this.timeSinceLastSpawn = 2;

        ArcadeEngine.OnUpdate((dt) => {
            if (dt >= 1) {
                $.Msg(`Time passed: ${dt}`)
                return;
            }

            // spawn columns
            this.timeSinceLastSpawn -= dt;
            if (this.timeSinceLastSpawn <= 0) {
                this.spawnColumns();
                this.timeSinceLastSpawn = this.spawnInterval;
            }

            // update player velocity
            this.player.velocity += this.gravity * dt;
            this.player.Move(0, this.player.velocity * dt);

            if (this.player.position.y >= 376 - 32 || this.player.position.y <= 0) {
                this.gameOver();
            }

            // update columns
            for (let i = this.columns.length - 1; i >= 0; i--) {
                let [top, bottom] = this.columns[i];

                top.Move(-128 * dt, 0);
                bottom.Move(-128 * dt, 0);

                if (this.checkCollision(this.player, top) || this.checkCollision(this.player, bottom)) {
                    this.gameOver();
                }

                if (top.position.x + top.width <= 0) {
                    top.Destroy();
                    bottom.Destroy();
                    this.columns.splice(i, 1);

                    this.score++;
                }
            }
        })
    }

    gameOver() {
        $.Msg(`Game over! Score = ${this.score}`);
        ArcadeEngine.gameActive = false;
        return;
    }

    spawnColumns() {
        const gapSize = Math.floor(80 + Math.random() * 40);
        const columnWidth = 48;
        const maxTopHeight = 374 - gapSize - 32;
    
        if (maxTopHeight < 0) {
            $.Msg(`Invalid gapSize or topHeight range. maxTopHeight: ${maxTopHeight}`);
            return;
        }
    
        const topHeight = Math.floor(Math.random() * maxTopHeight);
        const bottomY = topHeight + gapSize;
        const bottomHeight = 374 - bottomY;
    
        const topColumn = ArcadeEngine.createGameObject("TopColumn", {
            width: `${columnWidth}.0px`,
            height: `${topHeight}.0px`,
            backgroundColor: "#D2B48C",
        });
        topColumn.position.x = 640;
        topColumn.position.y = 0;
        topColumn.width = columnWidth;
        topColumn.height = topHeight;
    
        const bottomColumn = ArcadeEngine.createGameObject("BottomColumn", {
            width: `${columnWidth}.0px`,
            height: `${bottomHeight}.0px`,
            backgroundColor: "#D2B48C",
        });
        bottomColumn.position.x = 640;
        bottomColumn.position.y = bottomY;
        bottomColumn.width = columnWidth;
        bottomColumn.height = bottomHeight;
    
        this.columns.push([topColumn, bottomColumn]);
    }    

    checkCollision(player, column) {
        return !(
            player.position.x + 48 < column.position.x ||
            player.position.x > column.position.x + column.width ||
            player.position.y + 32 < column.position.y ||
            player.position.y > column.position.y + column.height
        )
    }
}

// init to 0 clicks
var counter = 0;
// init to false
var visible = false;

// arcade panel
var arcadePanel = $("#arcade_menu_panel");
var canvasContainer = $("#canvasContainer");

$("#arcade_menu_panel").visible = false;

const myCanvas = $.CreatePanel("Panel", canvasContainer, "MyCanvasPanel");

myCanvas.AddClass("canvas");    // apply canvas style
myCanvas.SetDraggable(true);    // allow dragging of this panel
myCanvas.SetAcceptsFocus(true); // allows you to focus on the panel

myCanvas.SetPanelEvent("onactivate", () => {
    if (ArcadeEngine.focusedObject) {
        $.Msg("Clicked an object!");
    } else {
        $.Msg("Clicked Canvas without object!");
    }
})

/* FUNCTIONS */

function arcadeCounterClicked() {
    counter++;
    $("#ArcadeCounterLabel").text = `This text has been clicked ${counter} times...`;
    // play sound effect (not working)
    //$.PlaySoundEvent("s2r://panorama/sounds/784372__silverillusionist__comedic-sting.vsnd_c")
}

function toggleArcadeMenu() {
    visible = !visible;
    if (visible) {
        $("#arcade_menu_panel").visible = true;
        ArcadeEngine.gameOpen = true;
    } else {
        $("#arcade_menu_panel").visible = false;
        ArcadeEngine.gameOpen = false;
    }
}

var game = null;

// initalize games
new SnakeGame();
new PongGame();
new GuidedOwlGame();

function selectViperGame() {
    if (game == SnakeGame.Instance) return;
    ArcadeEngine.Clear();

    game = SnakeGame.Instance;
    $.Msg("Selected Viper!");
}

function selectPongGame() {
    if (game == PongGame.Instance) return;
    ArcadeEngine.Clear();

    game = PongGame.Instance;
    $.Msg("Selected Pong!");
}

function selectGuidedOwlGame() {
    if (game == GuidedOwlGame.Instance) return;
    ArcadeEngine.Clear();

    game = GuidedOwlGame.Instance;
    $.Msg("Selected Guided Owl!");
}

function startGame() {
    if (!game) {
        $.Msg("No game selected...");
        return;
    }
    if (!ArcadeEngine.gameActive) {
        ArcadeEngine.Clear();
        game.resetGame();
    } else {
        $.Msg("Continuing game...");
    }
}

/*

When I left off...

- Just finished flappy bird clone... idk what i want to work on next

Ideas/TODO:

- Properties have components that you can modify in the game object.
    - These will just be modified, then modify their respective style property on the xml.
    - Examples
        - pos -> x, y   | coordinates to change where location is on the screen
        - rect -> w, h  | store the bounding box of the object
        - text -> str   | displays text on the canvas [NECESSARY FOR SCORE TEXT / TITLE SCREENS]
        - btn -> fn     | allows running a function on clicking the object [KINDA ALREADY SUPPORTED]
- Improve UI of Arcade
    X Header/Title of the arcade needs to look cleaner.
    X Buttons for starting different games.
    - Custom UI art?
    - Canvas should have a checkerboard background? (texture not working yet)
    - Maybe some CRT shader for the "canvas" (if it is possible)
- Make some basic games.
    X Pong  (Lash?)
    X Snake (Viper)
    X Flappy Bird (Grey Talon Flappy Owl)
    - 2048 (medium)
    - Breakout (easy)
    - Asteroids (easy? but controls have a limit)
    - Clicker / Idle Game (easy? but can't save data)
    - Roguelike??? (hard, but would be cool)
- Improve finished games.
    - Pong
        - Art
        - UI
        - Sound
    - Snake
        - Art
        - UI
        - Sound
    - Flappy Bird
        - Art
        - UI
        - Sound
- Hide the arcade when switching tabs(?)
    - Shouldn't show while in hero select, match history, etc.
    - Use conditional styles somehow?
- QOL Refactoring
    - ArcadeEngine.Play(); should not have to be called in every game, maybe do it outside somehow?
    - Move games & ArcadeEngine to separate scripts, if possible.
    - 

*/