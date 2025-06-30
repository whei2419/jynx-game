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

var timer = 20;
var score = 0;

var countdownText;
var timerText;
var scoreText;

var isPaused = false;

const params = new URLSearchParams(window.location.search);
const lang = params.get('lang');

function preload() {
    this.load.audio('explosionSound', 'assets/SOUNDTRACK/bomb effects.mp3');
    this.load.audio('collectSound', 'assets/SOUNDTRACK/collect bird nest.mp3');
    this.load.audio('win', 'assets/SOUNDTRACK/game won.mp3');
    this.load.audio('countDown', 'assets/SOUNDTRACK/countdownsound.mp3');
    this.load.audio('bg-sound', 'assets/SOUNDTRACK/bg.mp3');
    this.load.audio('wrongitem', 'assets/SOUNDTRACK/wrong item.mp3');
    this.load.audio('buzzer', 'assets/SOUNDTRACK/long-buzzer.mp3');

    this.load.image('backgroundEn', 'assets/bg.png');
    this.load.image('backgroundCh', 'assets/bgCh.png');
    this.load.image('gamebg', 'assets/dutch/mainBackground.webp');  
    
    // Load good objects from folder and parse points from filename
    this.goodObjects = [
        { key: 'goodObject_1_1', path: 'assets/dutch/fallingObjects/1 point (1).webp', points: 1 },
        { key: 'goodObject_1_2', path: 'assets/dutch/fallingObjects/1 point (2).webp', points: 1 },
        { key: 'goodObject_1_3', path: 'assets/dutch/fallingObjects/1 point (3).webp', points: 1 },
        { key: 'goodObject_1_4', path: 'assets/dutch/fallingObjects/1 point (4).webp', points: 1 },
        { key: 'goodObject_1_5', path: 'assets/dutch/fallingObjects/1 point (5).webp', points: 1 },
        { key: 'goodObject_1_6', path: 'assets/dutch/fallingObjects/1 point (6).webp', points: 1 },
        { key: 'goodObject_7_1', path: 'assets/dutch/fallingObjects/7 point (1).webp', points: 7 },
        { key: 'goodObject_7_2', path: 'assets/dutch/fallingObjects/7 point (2).webp', points: 7 },
    ];

    this.goodObjects.forEach(obj => {
        this.load.image(obj.key, obj.path);
    });

    this.load.image('vignette', 'assets/vignette.png');
    this.load.spritesheet('explosion', 'assets/exp.png', { frameWidth: 300, frameHeight: 300 });
    this.load.image('glow', 'assets/glow.png'); // Placeholder for liquid image
    this.load.image('water-1', 'assets/water-1.png');
    this.load.image('countdown', 'assets/countdown.png');
    this.load.image('clock', 'assets/clock.png');
    this.load.image('default', 'assets/whitetimer.png');
    this.load.image('yellow', 'assets/10sec.png');
    this.load.image('red', 'assets/redtimer.png');
    this.load.image('scorebg', 'assets/scorebg-with-jar.png');
    this.load.image('bowl', 'assets/dutch/bowl.webp');
    this.load.image('overlayTop', 'assets/dutch/overlaytop.webp');
    this.load.image('timerContainerBg', 'assets/dutch/timer.webp');
    this.load.image('scoreContainerBg', 'assets/dutch/totalscore.webp');
    this.load.image('milkSplash', 'assets/dutch/milk splash.png');
}

function create() {
    // Set the bounds of the world
    this.physics.world.setBounds(0, 0, this.cameras.main.width, this.cameras.main.height);

    // create a sprite animation explosion
    this.anims.create({
        key: 'explosion',
        frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 21 }),
        frameRate: 16,
        repeat: 0,
        hideOnComplete: true
    });

    this.explosionSound = this.sound.add('explosionSound');
    this.collectSound = this.sound.add('collectSound');
    this.winSound = this.sound.add('win');
    this.countdownSound = this.sound.add('countDown');
    this.wrongItemSound = this.sound.add('wrongitem');
    this.bgSound = this.sound.add('bg-sound', { loop: true });
    this.buzzerSound = this.sound.add('buzzer', { loop: false });
 
    this.countdownSound.play();

    this.background = this.add.image(0, 0, 'gamebg').setOrigin(0, 0);
    this.background.displayWidth = this.cameras.main.width;
    this.background.displayHeight = this.cameras.main.height;

    this.overlayTop = this.add.image(0, 0, 'overlayTop').setOrigin(0, 0);
    this.overlayTop.setScrollFactor(0);
    this.overlayTop.scaleX = this.cameras.main.width / this.overlayTop.width;
    this.overlayTop.scaleY = this.overlayTop.scaleX;
    this.overlayTop.setDepth(98);


    // Set up bowl and enable physics
    this.bowl = this.add.sprite(0, 0, 'bowl').setOrigin(0.5);
    this.bowl.setScale(0.5);
    const bowlWidth = this.bowl.displayWidth;
    const bowlHeight = this.bowl.displayHeight;

    // Create a container to hold the bowl
    this.bowlContainer = this.add.container(this.cameras.main.centerX, this.cameras.main.height - 150, [this.bowl]);
    this.bowlContainer.setSize(bowlWidth, bowlHeight);
    this.physics.world.enable(this.bowlContainer);
    this.bowlContainer.body.setCollideWorldBounds(true);
    this.bowlContainer.body.setSize(bowlWidth * 0.8, bowlHeight * 0.4);
    this.bowlContainer.body.setOffset(bowlWidth * 0.1, 40);
 
    this.spawnDelay = 1200; // Initial spawn delay (ms)
    this.dropGravity = 300; // Initial gravity for falling items
    this.spawnAcceleration = 0.98; // How much to multiply spawnDelay each interval (slower acceleration)
    this.gravityAcceleration = 1.03; // How much to multiply dropGravity each interval (slower acceleration)
    this.minSpawnDelay = 600; // Minimum spawn delay (slower minimum)
    this.maxDropGravity = 900; // Maximum gravity (slower max)
    this.isGameOver = false; // Track game over state

    // Create a physics group for falling items
    this.items = this.physics.add.group();

    // Timer and score backgrounds and text, moved slightly inward for better appearance
    this.timerContainerBg = this.add.image(this.cameras.main.width - 500, 100, 'timerContainerBg').setOrigin(0.5).setDepth(99);
    // Adjust the multiplier (e.g., 0.3) to resize the timer container
    this.timerContainerBg.setScale(Math.min(this.cameras.main.width / this.timerContainerBg.width, this.cameras.main.height / this.timerContainerBg.height) * 0.3);
    this.physics.add.existing(this.timerContainerBg, true);

    // Adjust the X and Y values below to position the timer text
    this.timerText = this.add.text(this.cameras.main.width - 490, 117, '00:20', {
        fontFamily: 'HvDTrial_Brevia-ExtraBlack-BF6493a4064f0ec', // Adjust font size here
        fontSize: '40px',
        color: "#FFFFFF",
        align: 'center',
        fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

    this.scoreContainerBg = this.add.image(this.cameras.main.width - 170, 100, 'scoreContainerBg').setOrigin(0.5).setDepth(99);
    // Adjust the multiplier (e.g., 0.3) to resize the score container
    this.scoreContainerBg.setScale(Math.min(this.cameras.main.width / this.scoreContainerBg.width, this.cameras.main.height / this.scoreContainerBg.height) * 0.27);
    this.physics.add.existing(this.scoreContainerBg, true);

    // Adjust the X and Y values below to position the score text
    this.scoreText = this.add.text(this.cameras.main.width - 175, 117, '0', {
        fontFamily: 'HvDTrial_Brevia-ExtraBlack-BF6493a4064f0ec', // Adjust font size here
        fontSize: '40px',
        color: "#FFFFFF",
        align: 'center',
        fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(100);

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
        fontFamily: 'HvDTrial_Brevia-ExtraBlack-BF6493a4064f0ec',
        fontSize: '200px',
        color: "#063591",
        fontStyle: 'bold'
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
                duration: 100,
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
        this.countdownSound.stop();
        this.buzzerSound.play();
        // Add a 2 second delay before starting the timers
        this.time.delayedCall(500, () => {
            //play bg music
            this.buzzerSound.stop();
            this.bgSound.play();

            this.timerText.setVisible(true);
            this.scoreText.setVisible(true);
            this.spawnItemEvent = this.time.addEvent({
                delay: 100,
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
        this.spawnDelay = 100;
        this.dropGravity = 300;
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
        // Only allow movement if countdown is finished and game is not over
        if (!this.countdownEvent || this.countdownNumber <= 0) {
            if (!this.isGameOver) {
                this.bowlContainer.x = Phaser.Math.Clamp(
                    pointer.x,
                    this.bowlContainer.width / 2,
                    this.cameras.main.width - this.bowlContainer.width / 2
                );
            }
        }
    });

    this.resizeGame = () => {
        this.cameras.main.setSize(window.innerWidth, window.innerHeight);
        this.physics.world.setBounds(0, 0, window.innerWidth, window.innerHeight);

        if (this.background) {
            this.background.displayWidth = window.innerWidth;
            this.background.displayHeight = window.innerHeight;
        }

    };

    // Resize the game when the window is resized
    window.addEventListener('resize', this.resizeGame);
    this.resizeGame();
}

function update() {
    // Still check for overlap
    this.physics.overlap(this.bowlContainer, this.items, catchItem, null, this);
}

function spawnItem() {
    if (this.isGameOver) return; // Prevent spawning after game ends
    // Adjust spawn delay and drop gravity over time
    this.spawnDelay = Math.max(this.minSpawnDelay, this.spawnDelay * this.spawnAcceleration);
    this.dropGravity = Math.min(this.maxDropGravity, this.dropGravity * this.gravityAcceleration);
    if (this.spawnItemEvent) {
        this.spawnItemEvent.remove();
    }
    this.spawnItemEvent = this.time.addEvent({
        delay: this.spawnDelay,
        callback: this.spawnItem,
        callbackScope: this,
        loop: false
    });

    // Always spawn a good object
    var randomItem = Phaser.Math.RND.pick(this.goodObjects);
    randomItem.isGood = true;

    // Calculate item width for safe spawn
    const texture = this.textures.get(randomItem.key);
    const frame = texture.getSourceImage ? texture.getSourceImage() : null;
    const itemWidth = frame ? frame.width * 0.4 : 100 * 0.4; // 0.4 is your scale
    const minX = itemWidth / 2;
    const maxX = this.cameras.main.width - itemWidth / 2;
    var x = Phaser.Math.Between(minX, maxX);
    var y = -100;
    var item = this.items.create(x, y, randomItem.key);
    item.isGood = randomItem.isGood;
    if (randomItem.isGood) {
        item.setData('points', randomItem.points);
    }
    item.setOrigin(0.5);
    item.setScale(0.4);
    item.body.setAllowGravity(true);
    item.body.gravity.y = this.dropGravity;
    item.body.velocity.x = Phaser.Math.Between(-30, 30);
    item.setData('outOfBoundsKill', true);
}

function updateTimer() {
    if (this.isGameOver) return;

    timer--;
    if (timer >= 0) {
        const minutes = Math.floor(timer / 60);
        const seconds = timer % 60;
        const formattedTime = String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
        this.timerText.setText(formattedTime);
    }

    if (timer <= 0) {
        this.isGameOver = true;
        this.physics.pause();
        this.bgSound.stop();
        this.winSound.play();


        // Redirect to finish page after a delay
        this.time.delayedCall(2000, () => {
            window.location.href = `finish.html?score=${score}&lang=${lang}`;
        });
    }
}


function catchItem(bowlContainer, item) {
    if (this.isGameOver) {
        return;
    }

    const points = item.getData('points');

    if (points) {
        score += points;
        this.scoreText.setText(score);
        this.collectSound.play();

        // milk splash effect
        const splashX = item.x;
        const splashY = this.bowlContainer.y - (this.bowlContainer.height / 2);

        const milkSplash = this.add.image(splashX, splashY, 'milkSplash').setOrigin(0.5).setDepth(101).setScale(0.1);
        const scorePopup = this.add.text(splashX, splashY, `+${points}`, {
            fontFamily: 'HvDTrial_Brevia-ExtraBlack-BF6493a4064f0ec',
            fontSize: '30px',
            color: '#063591', // Dark blue color for visibility
            fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(102);

        this.tweens.add({
            targets: [milkSplash, scorePopup],
            alpha: 0,
            duration: 800, // 0.8 seconds fade out
            ease: 'Power1',
            onComplete: () => {
                milkSplash.destroy();
                scorePopup.destroy();
            }
        });

        // Animate the bowl: scale up, rotate, and bounce
        this.tweens.add({
            targets: this.bowl,
            scaleX: this.bowl.scaleX * 1.1, // Relative scale increase
            scaleY: this.bowl.scaleY * 1.1, // Relative scale increase
            rotation: 0.1,
            yoyo: true,
            repeat: 0,
            duration: 200,
            ease: 'Power1'
        });
    }

    // Destroy the item
    item.destroy();
}
