(function ()
{
	"use strict";

	var SIZE_X = 800;
	var SIZE_Y = 600;
	var ROTATION_SPEED = 0.01;
	var PLAYER_RAIL_SIDES = 6;
	var PLAYER_RADIUS = 10;
	var CENTER_RADIUS = 40;
	var CENTER_BORDER = 20;
	var PLAYER_SPEED = Math.PI / 40;
	var PLAYER_COLOR = 0xFF66FF;
	var CENTER_COLOR = 0xFF33FF;
	var OBSTACLE_COLOR = PLAYER_COLOR;
	var BGCOLOR1 = 0x663366;
	var BGCOLOR2 = 0x442244;
	var OBSTACLE_WIDTH = 40;
	var OBSTACLE_SPEED = 4;

	var sqrt3 = Math.sqrt(3);
	var player_interval;
	var player_position = 5 * Math.PI / 6;

	var intervals;
	var blocked_intervals = [false, false, false, false, false, false];
	var crashed = false;

	var setUpIntervals = function ()
	{
		intervals = [0];
		var interval = 2 * Math.PI / PLAYER_RAIL_SIDES;
		for (var i = 1; i <= PLAYER_RAIL_SIDES; i++)
		{
			intervals.push(i * interval);
		}

		var player_poly = buildRegularPolygon(0, CENTER_RADIUS + CENTER_BORDER, 3, PLAYER_RADIUS, Math.PI / 2);
		player_graphics.beginFill(PLAYER_COLOR);
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

	var drawObstacle = function (interval)
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
			var danger = (CENTER_RADIUS + CENTER_BORDER + PLAYER_RADIUS);
			var leave_danger = (CENTER_RADIUS + CENTER_BORDER - PLAYER_RADIUS);
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

		var p3 = new Phaser.Point(interval_points[interval + 1].x + OBSTACLE_WIDTH * proportion_x[interval + 1],
			interval_points[interval + 1].y + OBSTACLE_WIDTH * proportion_y[interval + 1]);
		var p4 = new Phaser.Point(interval_points[interval].x + OBSTACLE_WIDTH * proportion_x[interval],
			interval_points[interval].y + OBSTACLE_WIDTH * proportion_y[interval]);
		var points = [p1, p2, p3, p4];
		var shape = new Phaser.Polygon(points);
		var graphics = new Phaser.Graphics(game, 0, 0);
		graphics.beginFill(OBSTACLE_COLOR);
		graphics.drawPolygon(shape);
		graphics.endFill();
		obstacles_group.add(graphics);
		obstacles.push({shape: shape, graphics: graphics, interval: interval, speed: OBSTACLE_SPEED, points: points,
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
			points[0].x -= OBSTACLE_SPEED * proportion_x[interval];
			points[0].y -= OBSTACLE_SPEED * proportion_y[interval];
			points[1].x -= OBSTACLE_SPEED * proportion_x[interval + 1];
			points[1].y -= OBSTACLE_SPEED * proportion_y[interval + 1];
			points[2].x -= OBSTACLE_SPEED * proportion_x[interval + 1];
			points[2].y -= OBSTACLE_SPEED * proportion_y[interval + 1];
			points[3].x -= OBSTACLE_SPEED * proportion_x[interval];
			points[3].y -= OBSTACLE_SPEED * proportion_y[interval];

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
					blocked_intervals[interval] = true;
					if (player_interval === interval)
					{
						onCrash();
					}
				} if (obstacle.left_danger === false &&
						(points[3].x / leave_danger_zone[interval].x < 1 || points[3].y / leave_danger_zone[interval].y < 1))
				{
					obstacle.left_danger = true;
					blocked_intervals[interval] = false;
				}
				obstacle.shape.setTo(points);
				graphics.clear();
				graphics.beginFill(OBSTACLE_COLOR);
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
		if (blocked_intervals[player_interval])
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
	var cursors;
	var song;

	var onCrash = function()
	{
		crashed = true;
		song.fadeOut(200);
	};

	var DuperHexagon = {
		preload: function ()
		{
			game.load.audio('pixel_world', ['assets/music/pixel_world_lo.ogg', 'assets/music/pixel_world_lo.mp3']);
		},
		create: function ()
		{
			song = game.add.audio('pixel_world');
			song.loop = true;
			song.play();

			// Do not stop when the window loses focus
			game.stage.disableVisibilityChange = true;
			game.world.setBounds(-SIZE_X / 2, -SIZE_Y / 2, SIZE_X / 2, SIZE_Y / 2);

			// The last to be declared is always painted on top
			background_group = game.add.group();
			obstacles_group  = game.add.group();
			center_group     = game.add.group();
			player_group     = game.add.group();

			var bg_polygons = backgroundTriangles();
			var background_graphics_odd = new Phaser.Graphics(game, 0, 0);
			var background_graphics_even = new Phaser.Graphics(game, 0, 0);
			background_graphics_odd.beginFill(BGCOLOR1);
			background_graphics_even.beginFill(BGCOLOR2);
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
			var center_hexagon_poly = buildRegularPolygon(0, 0, PLAYER_RAIL_SIDES, CENTER_RADIUS);
			center_hexagon_graphics.clear();
			center_hexagon_graphics.beginFill(CENTER_COLOR);
			center_hexagon_graphics.drawPolygon(center_hexagon_poly);
			center_hexagon_graphics.endFill();
			center_group.add(center_hexagon_graphics);

			player_graphics = game.add.graphics(0, 0);
			setUpIntervals();
			updatePlayerInterval();
			updatePlayerPos();

			cursors = game.input.keyboard.createCursorKeys();
		},
		update: function ()
		{
			if (crashed === false)
			{
				game.world.rotation += ROTATION_SPEED;
				if (cursors.left.isDown)
				{
					increasePlayerPos(-PLAYER_SPEED);
					updatePlayerPos();
				}
				else if (cursors.right.isDown)
				{
					increasePlayerPos(PLAYER_SPEED);
					updatePlayerPos();
				}
				updateObstacles();
			}
		}
	};

	// TODO: add obstacles inside the update function
	var someObstacles = function()
	{
		var i1 = Math.floor(Math.random() * 6);
		var i2 = Math.floor(Math.random() * 6);
		for (var i = 0; i < 6; i++)
		{
			if (i !== i1 && i !== i2)
			{
				drawObstacle(i);
			}
		}
		window.setTimeout(someObstacles, 1000);
	};

	window.setTimeout(someObstacles, 1000);

	var game = new Phaser.Game(SIZE_X, SIZE_Y, Phaser.AUTO, '', DuperHexagon);
})();