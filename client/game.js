class playScenes extends Phaser.Scene
{
  constructor() {
    super();
	}

	preload()
	{
		this.load.image('test-sprite', 'assets/test-sprite.png');
		this.load.image('fireball', 'assets/fireball.png');
		this.load.image('bg', 'assets/background.jpg');
		this.load.image('tiles', 'assets/Itch release raw tileset.png');
		this.load.tilemapTiledJSON('map', 'assets/map/mainMap.json');
		this.load.image('mask', 'assets/mask1.png');
		this.load.bitmapFont('carrier_command', 'assets/fonts/bitmapFonts/carrier_command.png', 'assets/fonts/bitmapFonts/carrier_command.xml');
		this.load.spritesheet('finder', 'assets/tilesetMPR.png', {frameWidth: 8, frameHeight: 8, startFrame: 63, endFrame: 64});
	}

    create()
    {
		let self = this;
		this.socket = io();
		this.gameEnd = false;

		this.velocity = 160;

		this.otherPlayers = this.physics.add.group();

		this.fire = [];
		this.time = 20;

		let bg = this.add.image(0, 0, 'bg').setOrigin(0, 0);
		this.cameras.main.setBounds(0, 0, bg.displayWidth, bg.displayHeight);

		this.physics.world.setBounds(0, 0, 1000, 1000);

		const map = this.make.tilemap({key: 'map'});
		const tileset = map.addTilesetImage('testTileset', 'tiles');
		this.platforms = map.createLayer('Platforms', tileset, 0, 0);
		this.platforms.setCollisionByExclusion(-1, true);

		this.cameras.main.zoom = 2;

		this.socket.on('currentPlayers', function(info){
			info.players.forEach(function(player){
				if(player.playerID === self.socket.id){
					self.addPlayer(self, player);
				}
				else
				{
					self.addOtherPlayers(self, player);
				}
			});

			if (self.playerType == 'hider') {
				createNPC(self, self.socket);
				self.socket.on("fireball", fireball => {
					let ball = self.physics.add.sprite(fireball.x, fireball.y, 'fireball').setScale(0.05);
					ball.direction = fireball.direction;
					self.fire.push(ball);
					let i = self.fire.length - 1;
					self.physics.add.collider(ball, self.platforms, _=> {
						ball.destroy();
						self.fire[i] = null;
					});
				});
			} else {
				self.socket.on("create npcs", npcInfo => {
					onNPCCreate(self, npcInfo);
				});
				self.socket.on("update npcs", onNPCUpdate);
			}
		});

		this.socket.on('playerMoved', function (playerInfo)
		{
			self.otherPlayers.getChildren().forEach(function(otherPlayer){
				if(playerInfo.playerID === otherPlayer.playerID)
				{
					otherPlayer.setPosition(playerInfo.x, playerInfo.y);
				}
			});
		});

		this.socket.on('game end', winner => {
			self.gameEnd = true;
			if (winner == 'finder') {
				this.finderWins();
			} else {
				this.hiderWins();
			}
		})

		this.cursors = this.input.keyboard.createCursorKeys();

		this.spotlight = this.make.sprite({
			x: 200,
			y: 200,
			key: 'mask',
			add: true
		});
	this.spotlight.scale = 2;

	bg.mask = new Phaser.Display.Masks.BitmapMask(this, this.spotlight);
	}

	addPlayer(self, playerInfo){
		if(playerInfo.type == 'hider')
		{
			self.player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'fireball').setScale(0.25);
			self.playerType = 'hider';
		}
		else
		{
			self.player = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'finder');
			self.playerType = 'finder';
			self.anims.create({
				key:'walk',
				frames: self.anims.generateFrameNumbers('finder', { start: 63, end: 64 }),
				frameRate: 10,
				repeat: -1
			})

			self.anims.create({
				key: 'still',
				frames: [ { key: 'finder', frame: 63 } ],
				frameRate: 20
			});
		}
		self.player.setCollideWorldBounds(true);
		self.player.direction = 'left';
		self.physics.add.existing(self.player, true);
		self.cameras.main.startFollow(self.player);
		self.physics.add.collider(self.player, self.platforms);
	}

	addOtherPlayers(self, playerInfo)
	{
		let otherPlayer;
		if(playerInfo.type == 'hider')
		{
			otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'fireball').setScale(0.25);
		}
		else
		{
			otherPlayer = self.physics.add.sprite(playerInfo.x, playerInfo.y, 'fireball').setScale(0.25);
		}
		otherPlayer.playerID = playerInfo.playerID;
		otherPlayer.type = playerInfo.type;
		otherPlayer.direction = 'left';
		self.otherPlayers.add(otherPlayer);
		self.physics.add.existing(otherPlayer, true);
		self.physics.add.collider(otherPlayer, self.platforms);
		self.otherPlayers.mask = new Phaser.Display.Masks.BitmapMask(this, this.spotlight);
	}

  update()
  {
		if (!this.gameEnd) {
			if (this.player)
			{
				this.updateMovement();
				this.updateServer();
			}
			if (this.playerType == 'hider') {
				updateNPC(this.socket);
			} else {
				if (this.time == 0) {
					this.emitFireBall();
					this.time = 20;
				}
				this.time--;
			}
			this.updateFireBall();
		}
	}

	updateMovement()
	{
		if(this.cursors.left.isDown)
		{
			this.player.setVelocityX(-this.velocity);
			this.player.direction = 'left';
		}
		else if (this.cursors.right.isDown)
		{
			this.player.setVelocityX(this.velocity);
			this.player.direction = 'right';
		}
		else
		{
			this.player.setVelocityX(0);
		}

		if(this.cursors.up.isDown)
		{
			this.player.setVelocityY(-this.velocity);
			this.player.direction = 'up';
		}
		else if (this.cursors.down.isDown)
		{
			this.player.setVelocityY(this.velocity);
			this.player.direction = 'down';
		}
		else
		{
			this.player.setVelocityY(0);
		}
		console.log(this.spotlight.x +" " +this.spotlight.y);
		this.spotlight.x = this.player.x;
    this.spotlight.y = this.player.y;
		if (this.player.body.velocity.x > 0) {
			this.player.setFlipX(false);
		} else if (this.player.body.velocity.x < 0) {
			// otherwise, make them face the other side
			this.player.setFlipX(true);
		}

		const velocity = this.player.body.velocity;
		if (this.playerType == 'finder') {
			if(velocity.x != 0 || velocity.y != 0)
			{
				this.player.anims.play('walk', true);
			} else
			{
				this.player.anims.play('still', true);
			}
		}
	}

	updateFireBall() {
		for (let i=0; i<this.fire.length; i++) {
			if (this.fire[i] != null) {
				let fireballDir = this.fire[i].direction;
				if (fireballDir === 'up') {
					this.fire[i].body.setVelocityY(-this.velocity*1.5);
				} else if (fireballDir === 'down') {
					this.fire[i].body.setVelocityY(this.velocity*1.5);
				} else if (fireballDir === 'left') {
					this.fire[i].body.setVelocityX(-this.velocity*1.5);
				} else {
					this.fire[i].body.setVelocityX(this.velocity*1.5);
				}
				if (this.fire[i].body.checkWorldBounds()) {
					this.fire[i].destroy();
					this.fire[i] = null;
				}
			}
		}
	}

	emitFireBall()
	{
		let spaceBar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
		if (Phaser.Input.Keyboard.JustDown(spaceBar)) {
			let fireball = this.physics.add.sprite(this.player.x, this.player.y, 'fireball').setScale(0.05);
			fireball.direction = this.player.direction;
			this.fire.push(fireball);
			let i = this.fire.length - 1;
			this.physics.add.collider(fireball, this.platforms, _=> {
				fireball.destroy();
				this.fire[i] = null;
			});
			this.otherPlayers.getChildren().forEach((otherPlayer) => {
				if (otherPlayer.type == 'hider') {
						this.physics.add.collider(fireball, otherPlayer, ()=> {
							fireball.destroy();
							this.fire[i] = null;
							otherPlayer.destroy();
							this.finderWins();
							this.socket.emit("game end", "finder");
						});
					}
			});
			this.socket.emit("fireball", {x:fireball.x, y:fireball.y, direction:fireball.direction});
		}
	}

	finderWins() {
		if (this.playerType == "hider") {
			this.player.destroy();
			let bmpText = this.add.bitmapText(this.cameras.main.x, this.cameras.main.y,
										'carrier_command',"You've Lost :-(",34);
		} else {
			this.otherPlayers.getChildren().forEach(otherPlayer => {
				if (otherPlayer.type == 'hider') {
					otherPlayer.destroy();
				}
			});
			let bmpText = this.add.bitmapText(this.cameras.main.x, this.cameras.main.y,
										'carrier_command',"You win!",34);
		}
	}

		hiderWins() {
			if (this.playerType == 'hider') {
				bmpText = this.add.bitmapText(this.cameras.main.x, this.cameras.main.y,
					'carrier_command',"You win!",34);
			} else {
				bmpText = this.add.bitmapText(this.cameras.main.x, this.cameras.main.y,
					'carrier_command',"You've Lost :-(",34);
			}
		}

	updateServer()
	{
		let x = this.player.x;
		let y = this.player.y;

		if(this.player.oldPosition && (x !== this.player.oldPosition.x || y !== this.player.oldPosition.y))
		{
			this.socket.emit('playerMovement', {x: this.player.x, y: this.player.y});
		}

		this.player.oldPosition = {
			x: this.player.x,
			y: this.player.y
		}
	}
}

export default playScenes;