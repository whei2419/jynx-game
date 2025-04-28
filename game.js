//phazer game 
// caching game 
//rulle of the game  
// object 1-3 end game over but before that  show a sprite animation of explotion and also shake the screen
// 4-5  bad animation 
// 6 good animation add scrore need 18 to win
// 3 sec countdown before start the game

var config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'gameContainer',
    physics: {                // <-- Add this block
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

var game = new Phaser.Game(config);

var timer = 30;
var score = 0;

var countdownText;
var timerText;
var scoreText;
var items;
var jar;
var cursors;
var explosion;
var spawnItemEvent;
var gameTimerEvent;

function preload() {
    this.load.image('background', 'assets/bg.png');
    this.load.image('jar', 'assets/jar.png');
    this.load.image('goodObject', 'assets/6.png');
    this.load.image('badObject1', 'assets/1.png'); // feather
    this.load.image('badObject2', 'assets/2.png'); // feather
    this.load.image('badObject3', 'assets/3.png'); // rock
    this.load.image('badObject4', 'assets/4.png');
    this.load.image('badObject5', 'assets/5.png');
    this.load.image('vignette', 'assets/vignette.png');
    this.load.spritesheet('explosion', 'assets/explosion_spritesheet.png', { frameWidth: 1030, frameHeight: 1080 });
    this.load.image('jarGlow', 'assets/glow.png'); // Add your glow image to assets folder
}

function create() {
    // Set the bounds of the world
    this.physics.world.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);

    // Create explosion animation
    this.anims.create({
        key: 'explode',
        frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 22 }),
        frameRate: 15,
        repeat: 0 // Only play once
    });

    // Set up background and make it stretch to game dimensions
    this.background = this.add.sprite(0, 0, 'background').setOrigin(0, 0);
    this.background.displayWidth = this.cameras.main.width;
    this.background.displayHeight = this.cameras.main.height;

    // Set up jar and enable physics
    this.jar = this.physics.add.sprite(this.cameras.main.centerX, this.cameras.main.height - 80, 'jar').setOrigin(0.5);
    this.jar.setScale(0.8);
    this.jar.setCollideWorldBounds(true);

    // Add jar glow overlay, initially invisible
    this.jarGlow = this.add.image(this.jar.x, this.jar.y, 'jarGlow')
        .setOrigin(0.5)
        .setScale(0.9)
        .setAlpha(0)
        .setDepth(11);

    // Create a physics group for falling items
    this.items = this.physics.add.group();

    // Initialize the timer and score display
    this.timerText = this.add.text(20, 20, 'Time: 30', { font: "24px Arial", fill: "#ffffff" });
    this.scoreText = this.add.text(this.cameras.main.width - 150, 20, 'Score: 0', { font: "24px Arial", fill: "#ffffff" });

    // Countdown text in the center
    this.countdownNumber = 3;
    this.countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', {
        font: "80px Arial",
        fill: "#FFA500"
    }).setOrigin(0.5);

    // Add vignette overlay, initially invisible
    this.vignette = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'vignette')
        .setOrigin(0.5)
        .setDisplaySize(this.cameras.main.width, this.cameras.main.height)
        .setAlpha(0)
        .setDepth(1000);

    // Define updateCountdown as a scene method
    this.updateCountdown = function() {
        this.countdownNumber--;
        if (this.countdownNumber > 0) {
            this.countdownText.setText(this.countdownNumber);
        } else {
            this.countdownText.setText('');
            this.countdownEvent.remove();
            this.startGame();
        }
    }.bind(this);

    // Define startGame as a scene method
    this.startGame = function() {
        this.spawnItemEvent = this.time.addEvent({
            delay: 1000,
            callback: this.spawnItem,
            callbackScope: this,
            loop: true
        });
        this.gameTimerEvent = this.time.addEvent({
            delay: 1000,
            callback: this.updateTimer,
            callbackScope: this,
            loop: true
        });
    }.bind(this);

    // Define spawnItem and updateTimer as scene methods for callbackScope
    this.spawnItem = spawnItem.bind(this);
    this.updateTimer = updateTimer.bind(this);

    this.countdownEvent = this.time.addEvent({
        delay: 1000,
        callback: this.updateCountdown,
        callbackScope: this,
        loop: true
    });

    // Setup the cursor keys for movement
    this.cursors = this.input.keyboard.createCursorKeys();

    // Resize the game when the window is resized
    window.addEventListener('resize', () => this.resizeGame());
}

function update() {
    // Handle jar movement based on cursor keys
    if (this.cursors.left.isDown) {
        this.jar.x -= 5;
    } else if (this.cursors.right.isDown) {
        this.jar.x += 5;
    }

    // Make sure the glow follows the jar
    if (this.jarGlow) {
        this.jarGlow.x = this.jar.x;
        this.jarGlow.y = this.jar.y;
    }

    // Check for overlap (catch items)
    this.physics.overlap(this.jar, this.items, catchItem, null, this);
}

function spawnItem() {
    var allItems = [
        { key: 'goodObject', isGood: true },
        { key: 'badObject1', isGood: false },
        { key: 'badObject2', isGood: false },
        { key: 'badObject3', isGood: false },
        { key: 'badObject4', isGood: false },
        { key: 'badObject5', isGood: false }
    ];

    var randomItem = Phaser.Math.RND.pick(allItems);
    var x = Phaser.Math.Between(0, this.cameras.main.width);
    var y = -100;
    var item = this.items.create(x, y, randomItem.key);
    item.isGood = randomItem.isGood;
    item.setOrigin(0.5);
    item.setScale(0.6); // Scale each item individually
    item.body.setAllowGravity(true);
    item.body.gravity.y = 300;
    item.body.velocity.x = Phaser.Math.Between(-30, 30);
    item.setData('outOfBoundsKill', true);
}

function updateTimer() {
    timer--;
    this.timerText.setText('Time: ' + timer);

    if (timer <= 0) {
        this.time.removeEvent(spawnItemEvent);
        this.time.removeEvent(gameTimerEvent);
        endGame.call(this);
    }
}

function catchItem(jar, item) {
    if (item.texture.key === 'badObject1' || item.texture.key === 'badObject2' || item.texture.key === 'badObject3') {
        item.disableBody(true, true);
        explosionAnimation.call(this);
        setTimeout(() => {
            endGame.call(this);
        }, 3000);
    } else if(item.texture.key === 'goodObject') {
        item.disableBody(true, true);
        goodAnimation.call(this);
    } else {
        item.disableBody(true, true);
        bombAnimation.call(this);
    }
    score++;
    this.scoreText.setText('Score: ' + score);
}

function goodAnimation() {
    // Fade in jar and glow together
    this.jar.setAlpha(0);
    this.jarGlow.setAlpha(0);
    this.tweens.add({
        targets: [this.jar, this.jarGlow],
        alpha: 1,
        duration: 200,
        onComplete: () => {
            this.tweens.add({
                targets: [this.jar, this.jarGlow],
                alpha: 0,
                duration: 200,
                hold: 200,
                yoyo: true,
                onYoyo: () => {
                    this.jar.setAlpha(1);
                    this.jarGlow.setAlpha(0);
                }
            });
        }
    });
}

function explosionAnimation() {
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(300, 255, 0, 0);
    this.explosion = this.add.sprite(this.jar.x, this.jar.y, 'explosion').setOrigin(0.5);
    this.explosion.play('explode');
    this.explosion.on('animationcomplete', () => {
        this.explosion.destroy();
    });
}

function bombAnimation() {
    this.tweens.add({
        targets: this.jar,
        x: this.jar.x - 20,
        duration: 50,
        ease: 'Linear',
        yoyo: true,
        repeat: 4
    });
    // Fade in and out vignette overlay
    this.tweens.add({
        targets: this.vignette,
        alpha: 1,
        duration: 400,
        yoyo: true,
        hold: 200,
        onStart: () => { this.vignette.setVisible(true); },
        onComplete: () => { this.vignette.setAlpha(0); }
    });
}

function endGame() {
    alert("Game Over! Your score: " + score);
    this.scene.restart();
}

function resizeGame() {
    this.scale.resize(window.innerWidth, window.innerHeight);
    if (this.background) {
        this.background.displayWidth = window.innerWidth;
        this.background.displayHeight = window.innerHeight;
    }
}
