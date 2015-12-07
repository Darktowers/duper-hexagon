var duper_hexagon = function ()
{
	"use strict";

	var levels = [
		{},
		{
			rotation_speed: 0.01,
			player_speed: Math.PI / 40,
			player_color: 0xFF66FF,
			center_color: 0xFF33FF,
			obstacle_color: 0xFF66FF,
			bgcolor1: 0x663366,
			bgcolor2: 0x442244,
			obstacle_speed: 4,
			first_tick: 0,
			obstacle_types: ['single45', 'single5op', '4labyrinth', '4ifuckedup'],
			song: 'pixel_world'
		},
		{
			rotation_speed: 0.015,
			player_speed: 3 * Math.PI / 80,
			player_color: 0x33CCDD,
			center_color: 0x00EEFF,
			obstacle_color: 0x33CCDD,
			bgcolor1: 0x226666,
			bgcolor2: 0x144444,
			obstacle_speed: 6,
			first_tick: 30,
			obstacle_types: ['single45', 'single5', 'ifuckedup', 'labyrinth', 'quickalt'],
			song: 'second_source'
		},
		{
			rotation_speed: 0.02,
			player_speed: Math.PI / 20,
			player_color: 0xFF6633,
			center_color: 0xFF7740,
			obstacle_color: 0xFF6633,
			bgcolor1: 0x662010,
			bgcolor2: 0x44140C,
			obstacle_speed: 8,
			first_tick: 60,
			obstacle_types: ['single45', 'single5', 'ifuckedup', 'labyrinth', 'quickeralt'],
			song: 'reboot_complete'
		}
	];

	var SIZE_X = 800;
	var SIZE_Y = 600;
	var PLAYER_RADIUS = 10;
	var CENTER_RADIUS = 40;
	var CENTER_BORDER = 20;
	var NUM_INTERVALS = 6;
	var PICKUP_HEIGHT = 60;

	var sqrt3 = Math.sqrt(3);
	var player_interval;
	var player_position = 5 * Math.PI / 6;

	var intervals;
	var blocked_intervals = [0, 0, 0, 0, 0, 0];
	var playing = false;
	var crashed = false;

	var setUpIntervals = function ()
	{
		intervals = [0];
		var interval = 2 * Math.PI / NUM_INTERVALS;
		for (var i = 1; i <= NUM_INTERVALS; i++)
		{
			intervals.push(i * interval);
		}

		var player_poly = buildRegularPolygon(0, CENTER_RADIUS + CENTER_BORDER, 3, PLAYER_RADIUS, Math.PI / 2);
		player_graphics.beginFill(level.player_color);
		player_graphics.drawPolygon(player_poly);
		player_graphics.endFill();
	};

	// Points which, when connected to (0,0) through a segment, divide the game screen in six equilateral triangles
	var interval_points = [];
	// Points which, when connected to (0,0) through a segment, become a set of medians for the above triangles
	var median_interval_points = [];

	var backgroundTriangles = function ()
	{
		// A background triangle's height, must be enough to reach from the center to any of the four corners
		var h = Math.sqrt(SIZE_X * SIZE_X + SIZE_Y * SIZE_Y) / 2;
		var l = h * 2 / sqrt3; // Side of an equilateral triangle with height h
		var zero = new Phaser.Point(0, 0);
		if (interval_points.length === 0)
		{
			interval_points.push(new Phaser.Point(0, l));
			interval_points.push(new Phaser.Point(-h, l / 2));
			interval_points.push(new Phaser.Point(-h, -l / 2));
			interval_points.push(new Phaser.Point(0, -l));
			interval_points.push(new Phaser.Point(h, -l / 2));
			interval_points.push(new Phaser.Point(h, l / 2));
			interval_points.push(interval_points[0]);
			median_interval_points.push(new Phaser.Point(-h/2, 3 * l / 4));
			median_interval_points.push(new Phaser.Point(-h, 0));
			median_interval_points.push(new Phaser.Point(-h/2, - 3 * l / 4));
			median_interval_points.push(new Phaser.Point(h/2, - 3 * l / 4));
			median_interval_points.push(new Phaser.Point(h, 0));
			median_interval_points.push(new Phaser.Point(h/2, 3 * l / 4));
			median_interval_points.push(median_interval_points[0]);
		}

		var triangles = [];
		for (var i = 0; i < 6; i++)
		{
			triangles.push(new Phaser.Polygon([interval_points[i], interval_points[i + 1], zero]));
		}
		return triangles;
	};

	// Proportions for calculating point locations. If a point (c,d) is 40 units away from point (a,b) on top of an
	// interval line, then (c,d) = (a + 40 * proportion_x, b + 40 * proportion_y).
	var obs_proportion_x = [];
	var obs_proportion_y = [];
	var pickup_proportion_x = [];
	var pickup_proportion_y = [];
	// Lists of obstacles and pickups
	var obstacles = [];
	var pickups = [];
	// x coordinates for each straight when we know that an obstacle is close enough to the player to actually touch
	// him/her
	var obs_danger_zone = [];
	var obs_leave_danger_zone = [];
	var pickup_danger_zone = [];
	var pickup_leave_danger_zone = [];

	var calcInterval = function (interval, is_pickup)
	{
		var proportion_x      = is_pickup === true ? pickup_proportion_x      : obs_proportion_x;
		var proportion_y      = is_pickup === true ? pickup_proportion_y      : obs_proportion_y;
		var points            = is_pickup === true ? median_interval_points   : interval_points;
		var danger_zone       = is_pickup === true ? pickup_danger_zone       : obs_danger_zone;
		var leave_danger_zone = is_pickup === true ? pickup_leave_danger_zone : obs_leave_danger_zone;
		if (points[interval].x !== 0)
		{
			var m = Math.abs(points[interval].y / points[interval].x); // as in y = mx
			proportion_x[interval] = 1 / Math.sqrt(1 + m * m);
			proportion_y[interval] = m * proportion_x[interval];
		} else
		{
			proportion_x[interval] = 0;
			proportion_y[interval] = 1;
		}

		proportion_x[interval] = points[interval].x < 0 ? -proportion_x[interval] : proportion_x[interval];
		proportion_y[interval] = points[interval].y < 0 ? -proportion_y[interval] : proportion_y[interval];

		var danger = CENTER_RADIUS + CENTER_BORDER + PLAYER_RADIUS;
		var leave_danger = CENTER_RADIUS + CENTER_BORDER - PLAYER_RADIUS;
		if (is_pickup === true)
		{
			danger += PICKUP_HEIGHT / 2;
			leave_danger -= PICKUP_HEIGHT / 2;
		}
		danger_zone[interval] = {
			x: danger * proportion_x[interval],
			y: danger * proportion_y[interval]};
		leave_danger_zone[interval] =  {
			x: leave_danger * proportion_x[interval],
			y: leave_danger * proportion_y[interval]};
	};

	var drawSingleObstacle = function (interval, obstacle_width)
	{
		var p1 = interval_points[interval].clone();
		var p2 = interval_points[interval + 1].clone();
		if (obs_proportion_x[interval] === undefined)
		{
			calcInterval(interval);
		}
		if (obs_proportion_x[interval + 1] === undefined)
		{
			calcInterval(interval + 1);
		}

		var p3 = new Phaser.Point(interval_points[interval + 1].x + obstacle_width * obs_proportion_x[interval + 1],
			interval_points[interval + 1].y + obstacle_width * obs_proportion_y[interval + 1]);
		var p4 = new Phaser.Point(interval_points[interval].x + obstacle_width * obs_proportion_x[interval],
			interval_points[interval].y + obstacle_width * obs_proportion_y[interval]);
		var points = [p1, p2, p3, p4];
		var shape = new Phaser.Polygon(points);
		var graphics = new Phaser.Graphics(game, 0, 0);
		graphics.beginFill(level.obstacle_color);
		graphics.drawPolygon(shape);
		graphics.endFill();
		obstacles_group.add(graphics);
		obstacles.push({shape: shape, graphics: graphics, interval: interval, speed: level.obstacle_speed, points: points,
			entered_danger: false, left_danger: false});
	};

	var drawPickup = function(interval)
	{
		if (pickup_proportion_x[interval] === undefined)
		{
			calcInterval(interval, true);
		}

		var pickup = game.add.sprite(
				median_interval_points[interval].x,
				median_interval_points[interval].y,
				'pickup');
		pickup.anchor.x = 0.5;
		pickup.anchor.y = 0.5;
		obstacles_group.add(pickup);
		pickup.interval = interval;
		pickup.rotation = - 5 * Math.PI/6 + Math.PI * interval / 3;
		pickups.push(pickup);
	};

	var updateObstaclesAndPickups = function ()
	{
		var to_remove = [];
		var interval;

		obstacles.map(function (obstacle, index)
		{
			var points = obstacle.points;
			var graphics = obstacle.graphics;
			interval = obstacle.interval;
			var old_x_0 = points[0].x;
			var old_y_0 = points[0].y;
			var old_x_2 = points[2].x;
			var old_y_2 = points[2].y;
			points[0].x -= level.obstacle_speed * obs_proportion_x[interval];
			points[0].y -= level.obstacle_speed * obs_proportion_y[interval];
			points[1].x -= level.obstacle_speed * obs_proportion_x[interval + 1];
			points[1].y -= level.obstacle_speed * obs_proportion_y[interval + 1];
			points[2].x -= level.obstacle_speed * obs_proportion_x[interval + 1];
			points[2].y -= level.obstacle_speed * obs_proportion_y[interval + 1];
			points[3].x -= level.obstacle_speed * obs_proportion_x[interval];
			points[3].y -= level.obstacle_speed * obs_proportion_y[interval];

			// turned from positive to negative or vice versa
			if (old_x_0 * points[0].x <= 0 && old_y_0 * points[0].y <= 0)
			{
				points[0].x = points[0].y = points[1].x = points[1].y = 0;
			}
			// turned from positive to negative or vice versa
			if (old_x_2 * points[2].x <= 0 && old_y_2 * points[2].y <= 0)
			{
				to_remove.push(index);
				graphics.kill();
			} else
			{
				if (obstacle.entered_danger === false &&
						(points[0].x / obs_danger_zone[interval].x < 1 || points[0].y / obs_danger_zone[interval].y < 1))
				{
					obstacle.entered_danger = true;
					blocked_intervals[interval]++;
					if (player_interval === interval)
					{
						onCrash();
					}
				} if (obstacle.left_danger === false &&
						(points[3].x / obs_leave_danger_zone[interval].x < 1 || points[3].y / obs_leave_danger_zone[interval].y < 1))
				{
					obstacle.left_danger = true;
					blocked_intervals[interval]--;
				}
				obstacle.shape.setTo(points);
				graphics.clear();
				graphics.beginFill(level.obstacle_color);
				graphics.drawPolygon(obstacle.shape);
				graphics.endFill();
			}
		});

		for (var i = to_remove.length - 1; i >= 0; i--)
		{
			obstacles.splice(i, 1);
		}

		to_remove = [];
		pickups.map(function(pickup, index)
		{
			interval = pickup.interval;
			var old_x = pickup.x;
			var old_y = pickup.y;
			pickup.x -= level.pickup_speed * pickup_proportion_x[interval];
			pickup.y -= level.pickup_speed * pickup_proportion_y[interval];
			// turned from positive to negative or vice versa
			if (old_x * pickup.x <= 0 && old_y * pickup.y <= 0)
			{
				to_remove.push(index);
				pickup.kill();
			} else
			{
				// Has entered the collision zone with the player
				if (pickup.x / pickup_danger_zone[interval].x < 1 ||
						pickup.y / pickup_danger_zone[interval].y < 1)
				{
					// Hasn't left the collision zone with the player
					if (pickup_leave_danger_zone[interval].x / pickup.x  < 1 ||
							pickup_leave_danger_zone[interval].y / pickup.y < 1)
					{
						if (interval === player_interval)
						{
							onGotPickup(interval);
							pickup.kill();
							to_remove.push(index);
						}
					}
				}
			}
		});

		for (i = to_remove.length - 1; i >= 0; i--)
		{
			pickups.splice(i, 1);
		}
	};

	var onGotPickup = function(interval)
	{
		console.log('got pickup', interval);
	};

	var updatePlayerPos = function ()
	{
		player_graphics.rotation = player_position;
	};

	var regularPolygonPoints = function (x, y, sides, radius, angle)
	{
		var x_points = [];
		var y_points = [];
		angle = angle === undefined ? 0 : angle;
		var height = sqrt3 * radius / 2;
		// Avoid expensive sine and cosine calculations for the center hexagon
		if (sides === 6 && angle === 0)
		{
			x_points = [x, x + height, x + height, x, x - height, x - height];
			y_points = [y + radius, y + radius / 2, y - radius / 2, y - radius, y - radius / 2, y + radius / 2];
		} else
		{
			var increment = 2 * Math.PI / sides;
			for (var i = 0; i < sides; i++)
			{
				var curr_angle = increment * i + angle;
				x_points.push(x + Math.cos(curr_angle) * radius);
				y_points.push(y + Math.sin(curr_angle) * radius);
			}
		}
		return {
			x: x_points,
			y: y_points
		};
	};

	var buildRegularPolygon = function (x, y, sides, radius, angle)
	{
		var coords = regularPolygonPoints(x, y, sides, radius, angle);
		var points = [];
		for (var i = 0; i < sides; i++)
		{
			points.push(new Phaser.Point(coords.x[i], coords.y[i]));
		}
		return new Phaser.Polygon(points);
	};

	var updatePlayerInterval = function()
	{
		var found = false;
		for (var i = 1; i < intervals.length && !found; i++)
		{
			if (player_position < intervals[i])
			{
				player_interval = i - 1;
				found = true;
			}
		}
		if (!found)
		{
			player_interval = intervals.length - 1;
		}
	};

	var increasePlayerPos = function (offset)
	{
		var old_pos = player_position;
		player_position += offset;
		if (player_position < 0)
		{
			player_position += 2 * Math.PI;
		} else if (player_position > 2 * Math.PI)
		{
			player_position -= 2 * Math.PI;
		}
		updatePlayerInterval();
		if (blocked_intervals[player_interval] > 0)
		{
			player_position = old_pos;
			updatePlayerInterval();
		}
	};

	var obstacles_group;
	var center_group;
	var background_group;
	var player_group;
	var player_graphics;
	var keys;
	var song;

	var onCrash = function()
	{
		crashed = true;
		playing = false;
		song.fadeOut(200);
		crash_callbacks.map(function(cb)
		{
			cb();
		});
	};

	var curr_level;
	var level;
	var restart = function(level_index)
	{
		// Do not proceed if we are still in the preloading phase. Instead of that, try again in 100 ms.
		if (game_created === false)
		{
			window.setTimeout(function()
			{
				restart(level_index);
			}, 100);
			return;
		}

		level = levels[level_index] ? levels[level_index] : levels[curr_level];
		level.pickup_speed = sqrt3 * level.obstacle_speed / 2;
		curr_level = level_index ? level_index : curr_level;
		music_loaded = false;

		song = game.add.audio(level.song);
		song.loop = true;

		crashed = false;
		playing = true;
		tick = 0;
		next_obstacle_set_at = level.first_tick;
		next_obstacles = [];
		obstacle_types = level.obstacle_types;

		// Clean up a previous run
		if (player_graphics)
		{
			player_graphics.clear();
			pickups.map(function(pickup)
			{
				pickup.kill();
			});
			obstacles.map(function(obstacle)
			{
				obstacle.graphics.clear();
			});
			pickups = [];
			obstacles = [];
			blocked_intervals = [0, 0, 0, 0, 0, 0];
		}

		// If the user restarts before the song finished fading out, wait for it to finish fading out before playing it
		// again (otherwise, it won't be played)
		var playSong = function()
		{
			song.volume = 1;
			song.play();
		};
		if (song.isPlaying)
		{
			song.onFadeComplete.add(function()
			{
				playSong();
				song.onFadeComplete.removeAll();
			});
		} else
		{
			playSong();
		}

		var bg_polygons = backgroundTriangles();
		var background_graphics_odd = new Phaser.Graphics(game, 0, 0);
		var background_graphics_even = new Phaser.Graphics(game, 0, 0);
		background_graphics_odd.beginFill(level.bgcolor1);
		background_graphics_even.beginFill(level.bgcolor2);
		for (var i = 0; i < bg_polygons.length; i++)
		{
			var graphics = i % 2 === 0 ? background_graphics_even : background_graphics_odd;
			graphics.drawPolygon(bg_polygons[i]);
		}
		background_graphics_odd.endFill();
		background_graphics_even.endFill();
		background_group.add(background_graphics_even);
		background_group.add(background_graphics_odd);

		var center_hexagon_graphics = new Phaser.Graphics(game, 0, 0);
		var center_hexagon_poly = buildRegularPolygon(0, 0, NUM_INTERVALS, CENTER_RADIUS);
		center_hexagon_graphics.clear();
		center_hexagon_graphics.beginFill(level.center_color);
		center_hexagon_graphics.drawPolygon(center_hexagon_poly);
		center_hexagon_graphics.endFill();
		center_group.add(center_hexagon_graphics);

		player_graphics = game.add.graphics(0, 0);
		setUpIntervals();
		updatePlayerInterval();
		updatePlayerPos();

		start_callbacks.map(function(cb)
		{
			cb();
		});
	};

	var tryRestart = function(level)
	{
		if (playing === false && (level !== undefined || curr_level !== undefined))
		{
			restart(level);
		}
	};

	var obstacle_types;
	var tick = 0;
	var next_obstacle_set_at = 0;
	var next_obstacles = [];

	// Create and enqueue sets of obstacles
	var obstacleSets = function()
	{
		var drawWave = function(width, tick, gaps)
		{
			for (var interval = 0; interval < 6; interval++)
			{
				if (gaps.indexOf(interval) === -1)
				{
					next_obstacles.push({
						tick: Math.round(tick),
						width: width,
						interval: interval
					});
				}
			}
		};

		if (tick >= next_obstacle_set_at)
		{
			var type = obstacle_types[Math.floor(Math.random() * obstacle_types.length)];
			if (type === 'single45') // 4 or 5 obstacles
			{
				var wave_duration = 240;
				for (var wave = 0; wave < 4; wave++)
				{
					var i1 = Math.floor(Math.random() * 6);
					var i2 = Math.floor(Math.random() * 6);
					if (i1 === i2 && type === 'quick4s')
					{
						i2++;
					}
					drawWave(40, tick + wave * wave_duration / level.obstacle_speed, [i1, i2]);
				}
				next_obstacle_set_at += wave_duration * 4 / level.obstacle_speed;

			// 5 obstacles,  with the exit on opposite ends (single5op) or random (single5)
			} else if (type === 'single5op' || type === 'single5')
			{
				var gap = Math.floor(Math.random() * 6);
				var alt_gap = (gap + 3) % 6;
				for (var wave = 0; wave < 4; wave++)
				{
					if (type === 'single5')
					{
						gap = Math.floor(Math.random() * 6);
						alt_gap = gap;
					}
					drawWave(40, tick + wave * 240 / level.obstacle_speed, wave % 2 === 0 ? [gap] : [alt_gap]);
				}
				next_obstacle_set_at += 960 / level.obstacle_speed;
			// Gaps open and close, 5-4-5-4... (no prefix) or symmetrical 4-2-4-2... (4-prefix)
			} else if (type === 'labyrinth' || type === 'ifuckedup' || type === '4labyrinth' || type === '4ifuckedup') {
				var gap = Math.floor(Math.random() * 6);
				var width = 84;
				if (type === 'ifuckedup' || type === '4ifuckedup')
				{
					width = 40;
				}
				for (var wave = 0; wave < 6; wave++)
				{
					var next_gap = (gap + (Math.random() > 0.5 ? 1 : -1) + 6) % 6;
					var leave_even = [gap];
					var leave_odd = [gap, next_gap];
					if (type === '4labyrinth' || type === '4ifuckedup')
					{
						leave_even.push((gap + 3) % 6);
						leave_odd.push((gap + 3) % 6);
						leave_odd.push((next_gap + 3) % 6);
					}
					drawWave(width, tick + wave * 160 / level.obstacle_speed, leave_even);
					if (wave < 5)
					{
						drawWave(width, tick + wave * 160 / level.obstacle_speed + 80 / level.obstacle_speed, leave_odd);
					}
					gap = next_gap;
				}
				next_obstacle_set_at += 1120 / level.obstacle_speed;
			} else if (type === 'quickalt' || type === 'quickeralt') // Quick alternating 3 obstacles
			{
				for (var wave = 0; wave < 3; wave++)
				{
					drawWave(40, tick + wave * 320 / level.obstacle_speed, [0, 2, 4]);
					drawWave(40, tick + wave * 320 / level.obstacle_speed + 160 / level.obstacle_speed, [1, 3, 5]);
				}
				next_obstacle_set_at += 1080 / level.obstacle_speed;
				if (type === 'quickeralt')
				{
					next_obstacle_set_at -= 120 / level.obstacle_speed;
				}
			}
		}
		drawPartialSets();
	};

	var drawPartialSets = function()
	{
		while (next_obstacles.length > 0 && next_obstacles[0].tick === tick)
		{
			var obstacle = next_obstacles.shift();
			drawSingleObstacle(obstacle.interval, obstacle.width);
		}
	};

	var music_loaded = false;
	var game_created = false;

	var DuperHexagon = {
		preload: function ()
		{
			game.load.audio('pixel_world', ['assets/music/pixel_world_lo.ogg', 'assets/music/pixel_world_lo.mp3']);
			game.load.audio('second_source',
					['assets/music/second_source_lo.ogg', 'assets/music/second_source_lo.mp3']);
			game.load.audio('reboot_complete',
					['assets/music/reboot_complete_lo.ogg', 'assets/music/reboot_complete_lo.mp3']);
			game.load.image('pickup', 'assets/img/pickup.png');
		},
		create: function ()
		{
			game_created = true;
			// Do not stop when the window loses focus
			game.stage.disableVisibilityChange = true;
			game.world.setBounds(-SIZE_X / 2, -SIZE_Y / 2, SIZE_X / 2, SIZE_Y / 2);

			// The last to be declared is always painted on top
			background_group = game.add.group();
			obstacles_group  = game.add.group();
			center_group     = game.add.group();
			player_group     = game.add.group();

			keys       = game.input.keyboard.createCursorKeys();
			keys.A     = game.input.keyboard.addKey(Phaser.Keyboard.A);
			keys.D     = game.input.keyboard.addKey(Phaser.Keyboard.D);
			keys.enter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
			keys.enter.onDown.add(function()
			{
				tryRestart();
			});
		},
		update: function ()
		{
			if (music_loaded)
			{
				if (crashed === false && playing === true)
				{
					var left  = keys.left.isDown  || keys.A.isDown;
					var right = keys.right.isDown || keys.D.isDown;
					game.world.rotation += level.rotation_speed;
					if (left)
					{
						increasePlayerPos(-level.player_speed);
						updatePlayerPos();
					}
					else if (right)
					{
						increasePlayerPos(level.player_speed);
						updatePlayerPos();
					}
					obstacleSets();
					updateObstaclesAndPickups();
					tick++;
				}
			} else if (level && this.cache.isSoundDecoded(level.song))
			{
				music_loaded = true;
				loaded_callbacks.map(function(cb)
				{
					cb();
				});
			}
		}
	};

	var game = new Phaser.Game(SIZE_X, SIZE_Y, Phaser.AUTO, 'game', DuperHexagon);

	var start_callbacks  = [];
	var loaded_callbacks = [];
	var crash_callbacks  = [];

	return {
		start: tryRestart,
		addStartHandler : function(cb)
		{
			start_callbacks.push(cb);
		},
		addLoadHandler : function(cb)
		{
			loaded_callbacks.push(cb);
		},
		addCrashHandler : function(cb)
		{
			crash_callbacks.push(cb);
		}
	};
};