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
			obstacle_types: ['single45', 'single5op', 'labyrinth', 'quickalt'],
			song: 'pixel_world'
		},
		{
			rotation_speed: 0.02,
			player_speed: Math.PI / 20,
			player_color: 0x994499,
			center_color: 0x993399,
			obstacle_color: 0x994499,
			bgcolor1: 0x331C33,
			bgcolor2: 0x221122,
			obstacle_speed: 8,
			first_tick: 30,
			obstacle_types: ['single45', 'single5op', 'ifuckedup', 'labyrinth', 'quickalt'],
			song: 'second_source'
		}
	];

	var SIZE_X = 800;
	var SIZE_Y = 600;
	var PLAYER_RADIUS = 10;
	var CENTER_RADIUS = 40;
	var CENTER_BORDER = 20;
	var NUM_INTERVALS = 6;

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
	var proportion_x = [];
	var proportion_y = [];
	// List of obstacles
	var obstacles = [];
	// x coordinates for each straight when we know that an obstacle is close enough to the player to actually touch
	// him/her
	var danger_zone = [];
	var leave_danger_zone = [];

	var drawSingleObstacle = function (interval, obstacle_width)
	{
		var calc_interval = function (interval)
		{
			if (interval_points[interval].x !== 0)
			{
				var m = Math.abs(interval_points[interval].y / interval_points[interval].x); // as in y = mx
				proportion_x[interval] = 1 / Math.sqrt(1 + m * m);
				proportion_y[interval] = m * proportion_x[interval];
			} else
			{
				proportion_x[interval] = 0;
				proportion_y[interval] = 1;
			}
			// TODO: surely there's a nicer way to do this
			if (interval_points[interval].x < 0)
			{
				proportion_x[interval] *= -1;
			}
			if (interval_points[interval].y < 0)
			{
				proportion_y[interval] *= -1;
			}
			var danger = CENTER_RADIUS + CENTER_BORDER + PLAYER_RADIUS;
			var leave_danger = CENTER_RADIUS + CENTER_BORDER - PLAYER_RADIUS;
			danger_zone[interval] = {
				x: danger * proportion_x[interval],
				y: danger * proportion_y[interval]};
			leave_danger_zone[interval] =  {
				x: leave_danger * proportion_x[interval],
				y: leave_danger * proportion_y[interval]};
		};

		var p1 = interval_points[interval].clone();
		var p2 = interval_points[interval + 1].clone();
		if (proportion_x[interval] === undefined)
		{
			calc_interval(interval);
		}
		if (proportion_x[interval + 1] === undefined)
		{
			calc_interval(interval + 1);
		}

		var p3 = new Phaser.Point(interval_points[interval + 1].x + obstacle_width * proportion_x[interval + 1],
			interval_points[interval + 1].y + obstacle_width * proportion_y[interval + 1]);
		var p4 = new Phaser.Point(interval_points[interval].x + obstacle_width * proportion_x[interval],
			interval_points[interval].y + obstacle_width * proportion_y[interval]);
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

	var updateObstacles = function ()
	{
		var to_remove = [];
		obstacles.map(function (obstacle, index)
		{
			var points = obstacle.points;
			var interval = obstacle.interval;
			var graphics = obstacle.graphics;
			var old_x_0 = points[0].x;
			var old_y_0 = points[0].y;
			var old_x_2 = points[2].x;
			var old_y_2 = points[2].y;
			points[0].x -= level.obstacle_speed * proportion_x[interval];
			points[0].y -= level.obstacle_speed * proportion_y[interval];
			points[1].x -= level.obstacle_speed * proportion_x[interval + 1];
			points[1].y -= level.obstacle_speed * proportion_y[interval + 1];
			points[2].x -= level.obstacle_speed * proportion_x[interval + 1];
			points[2].y -= level.obstacle_speed * proportion_y[interval + 1];
			points[3].x -= level.obstacle_speed * proportion_x[interval];
			points[3].y -= level.obstacle_speed * proportion_y[interval];

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
						(points[0].x / danger_zone[interval].x < 1 || points[0].y / danger_zone[interval].y < 1))
				{
					obstacle.entered_danger = true;
					blocked_intervals[interval]++;
					if (player_interval === interval)
					{
						onCrash();
					}
				} if (obstacle.left_danger === false &&
						(points[3].x / leave_danger_zone[interval].x < 1 || points[3].y / leave_danger_zone[interval].y < 1))
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
			obstacles.map(function(obstacle)
			{
				obstacle.graphics.clear();
			});
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
						tick: tick,
						width: width,
						interval: interval
					});
				}
			}
		};

		if (tick === next_obstacle_set_at)
		{
			var type = obstacle_types[Math.floor(Math.random() * obstacle_types.length)];
			if (type === 'single45')
			{
				for (var wave = 0; wave < 4; wave++)
				{
					var i1 = Math.floor(Math.random() * 6);
					var i2 = Math.floor(Math.random() * 6);
					drawWave(40, tick + wave * 240 / level.obstacle_speed, [i1, i2]);
				}
				next_obstacle_set_at += 960 / level.obstacle_speed;
			} else if (type === 'single5op')
			{
				var gap = Math.floor(Math.random() * 6);
				var alt_gap = (gap + 3) % 6;
				for (var wave = 0; wave < 4; wave++)
				{
					drawWave(40, tick + wave * 240 / level.obstacle_speed, wave % 2 === 0 ? [gap] : [alt_gap]);
				}
				next_obstacle_set_at += 960 / level.obstacle_speed;
			} else if (type === 'labyrinth') {
				var gap = Math.floor(Math.random() * 6);
				for (var wave = 0; wave < 6; wave++)
				{
					var next_gap = (gap + (Math.random() > 0.5 ? 1 : -1) + 6) % 6;
					drawWave(80, tick + wave * 160 / level.obstacle_speed, [gap]);
					if (wave < 5)
					{
						drawWave(80, tick + wave * 160 / level.obstacle_speed + 80 / level.obstacle_speed, [gap, next_gap]);
					}
					gap = next_gap;
				}
				next_obstacle_set_at += 1120 / level.obstacle_speed;
			} else if (type === 'ifuckedup') {
				var gap = Math.floor(Math.random() * 6);
				for (var wave = 0; wave < 6; wave++)
				{
					var next_gap = (gap + (Math.random() > 0.5 ? 1 : -1) + 6) % 6;
					drawWave(40, tick + wave * 160 / level.obstacle_speed, [gap]);
					if (wave < 5)
					{
						drawWave(40, tick + wave * 160 / level.obstacle_speed + 80 / level.obstacle_speed, [gap, next_gap]);
					}
					gap = next_gap;
				}
				next_obstacle_set_at += 1120 / level.obstacle_speed;
			} else if (type === 'quickalt')
			{
				for (var wave = 0; wave < 3; wave++)
				{
					drawWave(40, tick + wave * 320 / level.obstacle_speed, [0, 2, 4]);
					drawWave(40, tick + wave * 320 / level.obstacle_speed + 160 / level.obstacle_speed, [1, 3, 5]);
				}
				next_obstacle_set_at += 1080 / level.obstacle_speed;
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
			game.load.audio('second_source', ['assets/music/second_source_lo.ogg', 'assets/music/second_source_lo.mp3']);
			game.load.audio('reboot_complete', ['assets/music/reboot_complete_lo.ogg', 'assets/music/reboot_complete_lo.mp3'])
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
					updateObstacles();
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