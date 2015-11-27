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
	var player_position = 3 * Math.PI / 2;

	var intervals;

	var setUpPlayerRail = function ()
	{
		intervals = [0];
		var interval = 2 * Math.PI / PLAYER_RAIL_SIDES;
		for (var i = 1; i <= PLAYER_RAIL_SIDES; i++)
		{
			intervals.push(i * interval);
		}

		player_poly = buildRegularPolygon(0, CENTER_RADIUS + CENTER_BORDER, 3, PLAYER_RADIUS, Math.PI / 2);
		player_graphics.beginFill(PLAYER_COLOR);
		player_graphics.drawPolygon(player_poly);
		player_graphics.endFill();
	};

	// Points which, when connected to (0,0) through a segment, divide the game screen in six equilateral triangles
	var interval_points = [];

	var backgroundTriangles = function ()
	{
		// A background triangle's height, must be enough to reach from the center to any of the four corners
		var h = Math.sqrt(SIZE_X * SIZE_X + SIZE_Y * SIZE_Y);
		var l = h * 2 / sqrt3; // Side of an equilateral triangle with height h
		var zero = new Phaser.Point(0, 0);
		if (interval_points.length === 0)
		{
			interval_points.push(new Phaser.Point(l, 0));
			interval_points.push(new Phaser.Point(l / 2, h));
			interval_points.push(new Phaser.Point(-l / 2, h));
			interval_points.push(new Phaser.Point(-l, 0));
			interval_points.push(new Phaser.Point(-l / 2, -h));
			interval_points.push(new Phaser.Point(l / 2, -h));
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

	var drawObstacle = function (interval)
	{
		var calc_interval = function (interval)
		{
			var m = Math.abs(interval_points[interval].y / interval_points[interval].x); // as in y = mx
			proportion_x[interval] = 1 / Math.sqrt(1 + m * m);
			proportion_y[interval] = m * proportion_x[interval];
			// TODO: surely there's a nicer way to do this
			if (interval_points[interval].x < 0)
			{
				proportion_x[interval] *= -1;
			}
			if (interval_points[interval].y < 0)
			{
				proportion_y[interval] *= -1;
			}
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
		var graphics = game.add.graphics(0, 0);
		graphics.beginFill(OBSTACLE_COLOR);
		graphics.drawPolygon(shape);
		graphics.endFill();
		obstacles.push({shape: shape, graphics: graphics, interval: interval, speed: OBSTACLE_SPEED, points: points});
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
			var old_x_2 = points[2].x;
			points[0].x -= OBSTACLE_SPEED * proportion_x[interval];
			points[0].y -= OBSTACLE_SPEED * proportion_y[interval];
			points[1].x -= OBSTACLE_SPEED * proportion_x[interval + 1];
			points[1].y -= OBSTACLE_SPEED * proportion_y[interval + 1];
			points[2].x -= OBSTACLE_SPEED * proportion_x[interval + 1];
			points[2].y -= OBSTACLE_SPEED * proportion_y[interval + 1];
			points[3].x -= OBSTACLE_SPEED * proportion_x[interval];
			points[3].y -= OBSTACLE_SPEED * proportion_y[interval];
			if (old_x_0 * points[0].x < 0) // turned from positive to negative or vice versa
			{
				points[0].x = points[0].y = points[1].x = points[1].y = 0;
			}
			if (old_x_2 * points[2].x < 0) // turned from positive to negative or vice versa
			{
				to_remove.push(index);
				graphics.kill();
			} else
			{
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

	var redrawPlayerPos = function ()
	{
		var index = null;
		for (var i = 0; i < intervals.length - 1 && index === null; i++)
		{
			if (player_position < intervals[i + 1])
			{
				index = i;
			}
		}
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
			x_points = [x + radius, x + radius / 2, x - radius / 2, x - radius, x - radius / 2, x + radius / 2];
			y_points = [y, y + height, y + height, y, y - height, y - height];
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

	var increasePlayerPos = function (offset)
	{
		player_position += offset;
		if (player_position < 0)
		{
			player_position += 2 * Math.PI;
		} else if (player_position > 2 * Math.PI)
		{
			player_position -= 2 * Math.PI;
		}
	};

	var background_graphics_odd;
	var background_graphics_even;
	var center_hexagon_graphics;
	var center_hexagon_poly;
	var player_graphics;
	var player_poly;
	var cursors;
	var song;


	var redrawCenterHexagon = function()
	{
		center_hexagon_graphics.clear();
		center_hexagon_graphics.beginFill(CENTER_COLOR);
		center_hexagon_graphics.drawPolygon(center_hexagon_poly);
		center_hexagon_graphics.endFill();
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

			var bg_polygons = backgroundTriangles();
			background_graphics_odd = game.add.graphics(0, 0);
			background_graphics_even = game.add.graphics(0, 0);
			background_graphics_odd.beginFill(BGCOLOR1);
			background_graphics_even.beginFill(BGCOLOR2);
			for (var i = 0; i < bg_polygons.length; i++)
			{
				var graphics = i % 2 === 0 ? background_graphics_even : background_graphics_odd;
				graphics.drawPolygon(bg_polygons[i]);
			}
			background_graphics_odd.endFill();
			background_graphics_even.endFill();

			center_hexagon_graphics = game.add.graphics(0, 0);
			center_hexagon_poly = buildRegularPolygon(0, 0, PLAYER_RAIL_SIDES, CENTER_RADIUS);
			redrawCenterHexagon();

			player_graphics = game.add.graphics(0, 0);
			setUpPlayerRail();
			redrawPlayerPos();

			cursors = game.input.keyboard.createCursorKeys();
		},
		update: function ()
		{
			game.world.rotation += ROTATION_SPEED;
			if (cursors.left.isDown)
			{
				increasePlayerPos(-PLAYER_SPEED);
				redrawPlayerPos();
			}
			else if (cursors.right.isDown)
			{
				increasePlayerPos(PLAYER_SPEED);
				redrawPlayerPos();
			}
			updateObstacles();
			redrawCenterHexagon();
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