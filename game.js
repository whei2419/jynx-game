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
    physics: {
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

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang');

function preload() {
    this.load.image('backgroundEn', 'assets/bg.png');
    this.load.image('backgroundCh', 'assets/bgCh.png');
    this.load.image('jar1', 'assets/jar1.png');
    this.load.image('jar2', 'assets/jar2.png');
    this.load.image('jar3', 'assets/jar3.png');
    this.load.image('jar4', 'assets/jar4.png');
    this.load.image('goodObject', 'assets/6.png');
    this.load.image('badObject1', 'assets/1.png'); // feather
    this.load.image('badObject2', 'assets/2.png'); // feather
    this.load.image('badObject3', 'assets/3.png'); // rock
    this.load.image('badObject4', 'assets/4.png');
    this.load.image('badObject5', 'assets/5.png');
    this.load.image('vignette', 'assets/vignette.png');
    this.load.image('explosionspritesheet', 'assets/explosionspritesheet.png'); 
    this.load.image('glow', 'assets/glow.png'); // Placeholder for liquid image
    this.load.image('water-1', 'assets/water-1.png');
    this.load.image('jar0', 'assets/jar0.png');
    this.load.image('jar1', 'assets/jar1.png');
    this.load.image('jar2', 'assets/jar2.png');
    this.load.image('jar3', 'assets/jar3.png');
    this.load.image('jar4', 'assets/jar4.png');
    this.load.image('jar5', 'assets/jar5.png');
    this.load.image('jar6', 'assets/jar6.png');
    this.load.image('jar7', 'assets/jar7.png');
    this.load.image('jar8', 'assets/jar8.png');
    this.load.image('jar9', 'assets/jar9.png');
    this.load.image('jar10', 'assets/jar10.png');
    this.load.image('jar11', 'assets/jar11.png');
    this.load.image('jar12', 'assets/jar12.png');
    this.load.image('jar13', 'assets/jar13.png');
    this.load.image('jar14', 'assets/jar14.png');
    this.load.image('jar15', 'assets/jar15.png');
    this.load.image('jar16', 'assets/jar16.png');
    this.load.image('jar17', 'assets/jar17.png');
    this.load.image('countdown', 'assets/countdown.png');
    this.load.image('clock', 'assets/clock.png');
}

function create() {
    // Set the bounds of the world
    this.physics.world.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);

    // Set up background and make it stretch to game dimensions

    if (lang === 'chinese') {
        this.background = this.add.image(0, 0, 'backgroundCh').setOrigin(0, 0);
    } else {
        this.background = this.add.image(0, 0, 'backgroundEn').setOrigin(0, 0);
    }
    this.background.displayWidth = this.cameras.main.width;
    this.background.displayHeight = this.cameras.main.height;

    // Set up jar and enable physics
    this.jarImages = [
        'jar0', 'jar1', 'jar2', 'jar3', 'jar4', 'jar5', 'jar6', 'jar7', 'jar8', 'jar9',
        'jar10', 'jar11', 'jar12', 'jar13', 'jar14', 'jar15', 'jar16', 'jar17'
    ];
    this.jarLevel = 0; // 0 to (this.jarImages.length - 1)
    this.jar = this.add.sprite(0, 0, this.jarImages[this.jarLevel]).setOrigin(0.5);
    this.jar.setScale(0.8);
    const jarWidth = this.jar.displayWidth;
    const jarHeight = this.jar.displayHeight;

    // Create a container to hold the jar
    this.jarContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.height - 250, [this.jar]);
    this.jarContainer.setSize(jarWidth, jarHeight);
    this.physics.world.enable(this.jarContainer);
    this.jarContainer.body.setCollideWorldBounds(true);
 

    // Create a physics group for falling items
    this.items = this.physics.add.group();

    // Timer and score backgrounds and text, moved slightly inward for better appearance
    this.timerBg = this.add.image(200, 280, 'clock')
        .setOrigin(0.5)
        .setAlpha(0.92)
        .setDepth(99)
        .setVisible(false);
    this.timerText = this.add.text(200, 280, '0:30', {
        font: "bold 45px Arial Black, Arial, sans-serif",
        fill: "#C88D43",
        align: 'center',
    }).setOrigin(0.5).setDepth(100).setVisible(false);
    this.scoreBg = this.add.image(this.cameras.main.width - 200, 280, 'clock')
        .setOrigin(0.5)
        .setAlpha(0.92)
        .setDepth(99)
        .setVisible(false);
    this.scoreText = this.add.text(this.cameras.main.width - 200, 280, '0/18', {
        font: "bold 45px Arial Black, Arial, sans-serif",
        fill: "#C88D43",
        align: 'center',
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // Countdown text in the center
    this.countdownNumber = 3;
    // Add overlay for countdown with fade-in animation
    this.countdownOverlay = this.add.rectangle(
        this.cameras.main.centerX,
        this.cameras.main.centerY,
        this.cameras.main.width,
        this.cameras.main.height,
        0xffffff,
        0.6
    ).setDepth(999).setAlpha(0);
    this.tweens.add({
        targets: this.countdownOverlay,
        alpha: 1,
        duration: 500,
        ease: 'Quad.easeIn'
    });
    // Add background image for countdown timer with scale pop-in animation
    this.countdownBg = this.add.image(this.cameras.main.centerX, this.cameras.main.centerY, 'countdown')
        .setOrigin(0.5)
        .setDepth(1000)
        .setDisplaySize(480, 320)
        .setAlpha(0.95)
        .setScale(0.7);
    this.tweens.add({
        targets: this.countdownBg,
        scale: 1,
        duration: 400,
        ease: 'Back.Out'
    });
    // Countdown text styled and above background
    this.countdownText = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY, '3', {
        font: "bold 120px Arial Black, Arial, sans-serif",
        fill: "#FFA000",
    }).setOrigin(0.5).setDepth(1001);

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
            // Animate overlay and background out
            this.tweens.add({
                targets: [this.countdownOverlay, this.countdownBg],
                alpha: 0,
                duration: 400,
                onComplete: () => {
                    this.countdownOverlay.setVisible(false);
                    this.countdownBg.setVisible(false);
                }
            });
            this.countdownEvent.remove();
            this.startGame();
        }
    }.bind(this);

    // Define startGame as a scene method
    this.startGame = function() {
        // Add a 2 second delay before starting the timers
        this.time.delayedCall(2000, () => {
            // Animate timerBg and scoreBg (pop-in scale and fade-in)
            this.timerBg.setScale(0.7).setAlpha(0);
            this.scoreBg.setScale(0.7).setAlpha(0);
            this.tweens.add({
                targets: this.timerBg,
                scale: 1,
                alpha: 0.92,
                duration: 400,
                ease: 'Back.Out',
                delay: 200 // slight delay for effect
            });
            this.tweens.add({
                targets: this.scoreBg,
                scale: 1,
                alpha: 0.92,
                duration: 400,
                ease: 'Back.Out',
                delay: 400 // stagger for effect
            });
            // Animate timerText and scoreText (fade-in and slight upward move)
            this.timerText.setAlpha(0).setY(80);
            this.scoreText.setAlpha(0).setY(80);
            this.tweens.add({
                targets: this.timerText,
                alpha: 1,
                y: 280,
                duration: 350,
                ease: 'Quad.Out',
                delay: 350
            });
            this.tweens.add({
                targets: this.scoreText,
                alpha: 1,
                y: 280,
                duration: 350,
                ease: 'Quad.Out',
                delay: 550
            });
            this.timerBg.setVisible(true);
            this.timerText.setVisible(true);
            this.scoreBg.setVisible(true);
            this.scoreText.setVisible(true);
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

    // Add mouse movement listener for left/right movement
    this.input.on('pointermove', (pointer) => {
        // Only allow movement if countdown is finished
        if (!this.countdownEvent || this.countdownNumber <= 0) {
            this.jarContainer.x = Phaser.Math.Clamp(pointer.x, this.jarContainer.width / 2, this.cameras.main.width - this.jarContainer.width / 2);
        }
    });

    // Resize the game when the window is resized
    window.addEventListener('resize', () => this.resizeGame());
}

function update() {
    // Still check for overlap
    this.physics.overlap(this.jarContainer, this.items, catchItem, null, this);
}

function spawnItem() {
    var allItems = [
        // Make goodObject more frequent by adding it multiple times
        { key: 'goodObject', isGood: true },
        { key: 'goodObject', isGood: true },
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
    this.timerText.setText(`0:${timer < 10 ? '0' : ''}${timer}`);

    if (timer <= 0) {
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
        score++;
        this.scoreText.setText(score + '/18');
    } else {
        item.disableBody(true, true);
        bombAnimation.call(this);
    }
}

function goodAnimation() {
    // Animate the jar: scale up, rotate, and bounce
    this.tweens.add({
        targets: this.jar,
        scaleX: 1.05,
        scaleY: 1.05,
        angle: 10,
        duration: 120,
        ease: 'Cubic.easeOut',
        yoyo: true,
        hold: 80,
        onYoyo: () => {
            this.jar.setAngle(0);
        }
    });

    // Animate the jarContainer: quick upward jump and bounce
    this.tweens.add({
        targets: this.jarContainer,
        y: this.jarContainer.y - 30,
        duration: 100,
        ease: 'Quad.easeOut',
        yoyo: true,
        hold: 60
    });

    // Add a quick white flash overlay for feedback
    const flash = this.add.rectangle(this.cameras.main.centerX, this.cameras.main.centerY, this.cameras.main.width, this.cameras.main.height, 0xffffff, 0.18)
        .setDepth(2000);
    this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 180,
        onComplete: () => flash.destroy()
    });

    // Increase jar level and update image
    this.jarLevel = Math.min(this.jarLevel + 1, this.jarImages.length - 1);
    this.jar.setTexture(this.jarImages[this.jarLevel]);
}

function explosionAnimation() {
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(300, 255, 0, 0);
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
    this.game.pause();
    window.location.href = `finish.html?score=${score}&lang=${lang}`;
}

function resizeGame() {
    this.scale.resize(window.innerWidth, window.innerHeight);
    if (this.background) {
        this.background.displayWidth = window.innerWidth;
        this.background.displayHeight = window.innerHeight;
    }
}
