var duper_hexagon = function()
{
	"use strict";

	var levels = [
		{}, // levels[0] is empty
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
			obstacle_types: ['single5', 'ifuckedup', 'quickrepeat', 'quickalt', 'multi4'],
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
			obstacle_types: ['fat5', 'fat5op', 'ifuckedup', 'labyrinth', 'quickeralt', 'multi4', '4fast'],
			song: 'reboot_complete'
		},
		{
			rotation_speed: 0.01,
			player_speed: Math.PI / 40,
			player_color: 0x994499,
			center_color: 0x993399,
			obstacle_color: 0x994499,
			obstacle_color_light: 0xCC66CC,
			obstacle_color_dark: 0x990099,
			bgcolor1: 0x331C33,
			bgcolor2: 0x221122,
			obstacle_speed: 4,
			first_tick: 0,
			obstacle_types: ['single45', 'single5op', '4labyrinth', '4ifuckedup', '4through', '5rebound'],
			song: 'pixel_world'
		}
	];

	var SIZE_X        = 800;
	var SIZE_Y        = 600;
	var PLAYER_RADIUS = 10;
	var CENTER_RADIUS = 40;
	var CENTER_BORDER = 20;
	var NUM_INTERVALS = 6;
	var PICKUP_HEIGHT = 60;

	var sqrt3           = Math.sqrt(3);
	var player_interval;
	var player_position = 5 * Math.PI / 6;

	var intervals;
	var blocked_intervals = [0, 0, 0, 0, 0, 0];
	var playing           = false;
	var crashed           = false;

	var setUpIntervals = function()
	{
		intervals    = [0];
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

	var calcIntervals = function()
	{
		var calcIntervalProportions = function(interval, is_pickup)
		{
			var proportion_x      = is_pickup === true ? pickup_proportion_x : obs_proportion_x;
			var proportion_y      = is_pickup === true ? pickup_proportion_y : obs_proportion_y;
			var points            = is_pickup === true ? median_interval_points : interval_points;
			var danger_zone       = is_pickup === true ? pickup_danger_zone : outer_danger_zone;
			var leave_danger_zone = is_pickup === true ? pickup_leave_danger_zone : inner_danger_zone;
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

			var danger       = CENTER_RADIUS + CENTER_BORDER + PLAYER_RADIUS * 2;
			var leave_danger = CENTER_RADIUS + CENTER_BORDER;
			if (is_pickup === true)
			{
				danger += PICKUP_HEIGHT / 2;
				leave_danger -= PICKUP_HEIGHT / 2;
			}
			danger_zone[interval]       = {
				x: danger * proportion_x[interval],
				y: danger * proportion_y[interval]
			};
			leave_danger_zone[interval] = {
				x: leave_danger * proportion_x[interval],
				y: leave_danger * proportion_y[interval]
			};
		};

		// Interval points must be big enough to reach from the center to any of the four corners
		var h = Math.sqrt(SIZE_X * SIZE_X + SIZE_Y * SIZE_Y) / 2;
		var l = h * 2 / sqrt3; // Side of an equilateral triangle with height h
		if (interval_points.length === 0)
		{
			interval_points.push(new Phaser.Point(0, l));
			interval_points.push(new Phaser.Point(-h, l / 2));
			interval_points.push(new Phaser.Point(-h, -l / 2));
			interval_points.push(new Phaser.Point(0, -l));
			interval_points.push(new Phaser.Point(h, -l / 2));
			interval_points.push(new Phaser.Point(h, l / 2));
			interval_points.push(interval_points[0]);
			median_interval_points.push(new Phaser.Point(-h / 2, 3 * l / 4));
			median_interval_points.push(new Phaser.Point(-h, 0));
			median_interval_points.push(new Phaser.Point(-h / 2, -3 * l / 4));
			median_interval_points.push(new Phaser.Point(h / 2, -3 * l / 4));
			median_interval_points.push(new Phaser.Point(h, 0));
			median_interval_points.push(new Phaser.Point(h / 2, 3 * l / 4));
			median_interval_points.push(median_interval_points[0]);
		}

		for (var interval = 0; interval < 6; interval++)
		{
			calcIntervalProportions(interval, true);
			calcIntervalProportions(interval, false);
		}
		obs_proportion_x[6]    = obs_proportion_x[0];
		obs_proportion_y[6]    = obs_proportion_y[0];
		pickup_proportion_x[6] = pickup_proportion_x[0];
		pickup_proportion_y[6] = pickup_proportion_y[0];
	};

	var backgroundTriangles = function()
	{
		var triangles = [];
		var zero      = new Phaser.Point(0, 0);
		for (var i = 0; i < 6; i++)
		{
			triangles.push(new Phaser.Polygon([interval_points[i], interval_points[i + 1], zero]));
		}
		return triangles;
	};

	// Proportions for calculating point locations. If a point (c,d) is 40 units away from point (a,b) on top of an
	// interval line, then (c,d) = (a + 40 * proportion_x, b + 40 * proportion_y).
	var obs_proportion_x    = [];
	var obs_proportion_y    = [];
	var pickup_proportion_x = [];
	var pickup_proportion_y = [];
	// Lists of obstacles and pickups
	var obstacles = [];
	var pickups   = [];
	// x coordinates for each straight when we know that an obstacle is close enough to the player to actually touch
	// him/her
	var outer_danger_zone        = [];
	var inner_danger_zone        = [];
	var pickup_danger_zone       = [];
	var pickup_leave_danger_zone = [];

	var getColor = function(obstacle)
	{
		if (obstacle.passes_through)
		{
			return level.obstacle_color_light;
		} else if (obstacle.rebounds)
		{
			return level.obstacle_color_dark;
		}
		return level.obstacle_color;
	};

	var drawSingleObstacle = function(obstacle)
	{
		var interval         = obstacle.interval;
		var width            = obstacle.width;
		var speed_multiplier = obstacle.speed_multiplier;
		var passes_through   = obstacle.passes_through || false;
		var rebounds         = obstacle.rebounds || false;
		var group            = passes_through || rebounds ? obstacles_group_top : obstacles_group;
		var color            = getColor(obstacle);

		var p1 = new Phaser.Point(interval_points[interval].x * speed_multiplier,
			interval_points[interval].y * speed_multiplier);
		var p2 = new Phaser.Point(interval_points[interval + 1].x * speed_multiplier,
			interval_points[interval + 1].y * speed_multiplier);
		var p3 = new Phaser.Point(p2.x + width * obs_proportion_x[interval + 1],
			p2.y + width * obs_proportion_y[interval + 1]);
		var p4 = new Phaser.Point(p1.x + width * obs_proportion_x[interval],
			p1.y + width * obs_proportion_y[interval]);

		var points   = [p1, p2, p3, p4];
		var shape    = new Phaser.Polygon(points);
		var graphics = new Phaser.Graphics(game, 0, 0);
		graphics.beginFill(color);
		graphics.drawPolygon(shape);
		graphics.endFill();
		group.add(graphics);
		obstacles.push({
			width: width,
			shape: shape,
			graphics: graphics,
			interval: interval,
			speed: level.obstacle_speed,
			points: points,
			entered_danger: false,
			left_danger: false,
			speed_multiplier: speed_multiplier,
			passes_through: passes_through,
			passing_through: false,
			rebounds: rebounds
		});
	};

	var drawPickup = function(interval)
	{
		var pickup      = game.add.sprite(
			median_interval_points[interval].x,
			median_interval_points[interval].y,
			'pickup');
		pickup.anchor.x = 0.5;
		pickup.anchor.y = 0.5;
		obstacles_group.add(pickup);
		pickup.interval = interval;
		pickup.rotation = -5 * Math.PI / 6 + Math.PI * interval / 3;
		pickups.push(pickup);
	};

	var updateObstaclesAndPickups = function()
	{
		var points;
		/**
		 * Checks whether a polygon has entered or left the danger zone by comparing some of its points to the
		 * delimiting the danger zone's inner and outer boundaries.
		 *
		 * The idea of this is as follows: since the center is at (0,0), the points' values decrease consistently until
		 * they reach the center. Therefore, to know whether the danger zone has been entered or exited, we just need to
		 * compare the magnitude of a point against the beginning/end of the danger zone; if it's smaller, the point is
		 * past the danger zone.
		 *
		 * When the point moves from (0,0) to the outside, everything is reversed; the beginning of the danger zone is
		 * the inner boundary, not the outer one, and a point is past a boundary when its magnitude is bigger than the
		 * boundary point's.
		 *
		 * @param interval The interval which has to be tested
		 * @param first_zone Whether to test if the polygon may be entering the danger zone (true) or leaving it (false)
		 * @param in_to_out Whether the polygon is moving from the inside to the outside (true) or not (false)
		 */
		var checkZone = function(interval, first_zone, in_to_out)
		{
			first_zone            = first_zone !== false;
			in_to_out             = in_to_out === true;
			var point             = first_zone ? points[0] : points[3];
			var target_collection = first_zone === in_to_out ? inner_danger_zone : outer_danger_zone;
			var check_x           = target_collection[interval].x !== 0;
			var check_y           = target_collection[interval].y !== 0;
			if (in_to_out)
			{
				check_x = check_x && point.x / target_collection[interval].x > 1;
				check_y = check_y && point.y / target_collection[interval].y > 1;
			} else
			{
				check_x = check_x && point.x / target_collection[interval].x < 1;
				check_y = check_y && point.y / target_collection[interval].y < 1;
			}
			return check_x || check_y;
		};

		var to_remove = [];
		var interval;

		obstacles.map(function(obstacle, index)
		{
			points       = obstacle.points;
			var graphics = obstacle.graphics;
			interval     = obstacle.interval;
			var old_x_0  = points[0].x;
			var old_y_0  = points[0].y;
			var old_x_2  = points[2].x;
			var old_y_2  = points[2].y;
			var speed    = level.obstacle_speed * obstacle.speed_multiplier;
			var sign     = obstacle.rebounds && obstacle.past_center ? -1 : 1;
			points[0].x -= speed * sign * obs_proportion_x[interval];
			points[0].y -= speed * sign * obs_proportion_y[interval];
			points[1].x -= speed * sign * obs_proportion_x[interval + 1];
			points[1].y -= speed * sign * obs_proportion_y[interval + 1];
			points[2].x -= speed * sign * obs_proportion_x[interval + 1];
			points[2].y -= speed * sign * obs_proportion_y[interval + 1];
			points[3].x -= speed * sign * obs_proportion_x[interval];
			points[3].y -= speed * sign * obs_proportion_y[interval];

			if (obstacle.rebounds && obstacle.past_center && !obstacle.rebounded)
			{
				var diff_x = obstacle.width * obs_proportion_x[obstacle.interval];
				var diff_y = obstacle.width * obs_proportion_y[obstacle.interval];
				if (Math.abs(points[0].x - points[3].x) < Math.abs(diff_x) ||
					Math.abs(points[0].y - points[3].y) < Math.abs(diff_y))
				{
					points[3].x = points[2].x = points[3].y = points[2].y = 0;
				} else
				{
					obstacle.rebounded = true;
					points[3].x        = points[0].x - diff_x;
					points[3].y        = points[0].y - diff_y;
					diff_x             = obstacle.width * obs_proportion_x[obstacle.interval + 1];
					diff_y             = obstacle.width * obs_proportion_y[obstacle.interval + 1];
					points[2].x        = points[1].x - diff_x;
					points[2].y        = points[1].y - diff_y;
				}
			}

			// the shorter side turned from positive to negative or vice versa (got to the center)
			if (old_x_0 * points[0].x <= 0 && old_y_0 * points[0].y <= 0 && !obstacle.past_center)
			{
				if (obstacle.passes_through === true)
				{
					obstacle.passing_through  = true;
				} else if (!obstacle.rebounded)
				{
					points[0].x = points[0].y = points[1].x = points[1].y = 0;
				}
			}
			// the longer side turned from positive to negative or vice versa (got to the center)
			if (old_x_2 * points[2].x <= 0 && old_y_2 * points[2].y <= 0)
			{
				if (obstacle.passes_through !== true && obstacle.rebounds !== true)
				{
					to_remove.push(index);
					graphics.kill();
				} else if (!obstacle.past_center)
				{
					obstacle.past_center = true;
				}
			} else
			{
				// Case when an obstacle has passed through the center and begins travelling outside through the
				// opposite interval
				if (obstacle.passing_through || obstacle.rebounded)
				{
					var alt_interval = obstacle.rebounds ? interval : (interval + 3) % 6;
					if (points[0].x / interval_points[alt_interval].x > 1 ||
						points[0].y / interval_points[alt_interval].y > 1)
					{
						to_remove.push(index);
						graphics.kill();
					} else
					{
						if (!obstacle.reentered_danger && checkZone(alt_interval, true, true))
						{
							obstacle.reentered_danger = true;
							blocked_intervals[alt_interval]++;
							if (player_interval === alt_interval)
							{
								onCrash();
							}
						}
						if (!obstacle.releft_danger && checkZone(alt_interval, false, true))
						{
							obstacle.releft_danger = true;
							blocked_intervals[alt_interval]--;
						}
					}
				}
				if (obstacle.past_center !== true) // Normal case: travelling from the outside towards the center
				{
					if (obstacle.entered_danger === false && checkZone(interval, true, false))
					{
						obstacle.entered_danger = true;
						blocked_intervals[interval]++;
						if (player_interval === interval)
						{
							onCrash();
						}
					}
					if (obstacle.entered_danger === true && obstacle.left_danger === false &&
						checkZone(interval, false, false))
					{
						obstacle.left_danger = true;
						blocked_intervals[interval]--;
					}
				}
				obstacle.shape.setTo(points);
				graphics.clear();
				graphics.beginFill(getColor(obstacle));
				graphics.drawPolygon(obstacle.shape);
				graphics.endFill();
			}
		});

		for (var i = to_remove.length - 1; i >= 0; i--)
		{
			obstacles.splice(to_remove[i], 1);
		}

		to_remove = [];
		pickups.map(function(pickup, index)
		{
			interval  = pickup.interval;
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
					if (pickup_leave_danger_zone[interval].x / pickup.x < 1 ||
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

	var updatePlayerPos = function()
	{
		player_graphics.rotation = player_position;
	};

	var regularPolygonPoints = function(x, y, sides, radius, angle)
	{
		var x_points = [];
		var y_points = [];
		angle        = angle === undefined ? 0 : angle;
		var height   = sqrt3 * radius / 2;
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

	var buildRegularPolygon = function(x, y, sides, radius, angle)
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
				found           = true;
			}
		}
		if (!found)
		{
			player_interval = intervals.length - 1;
		}
	};

	var increasePlayerPos = function(offset)
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
	var obstacles_group_top;
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

		level              = levels[level_index] ? levels[level_index] : levels[curr_level];
		level.pickup_speed = sqrt3 * level.obstacle_speed / 2;
		curr_level         = level_index ? level_index : curr_level;
		music_loaded       = false;

		song      = game.add.audio(level.song);
		song.loop = true;

		crashed              = false;
		playing              = true;
		tick                 = 0;
		next_obstacle_set_at = level.first_tick;
		next_obstacles       = [];
		obstacle_types       = level.obstacle_types;

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
			pickups           = [];
			obstacles         = [];
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

		var background_graphics_odd  = new Phaser.Graphics(game, 0, 0);
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
		var center_hexagon_poly     = buildRegularPolygon(0, 0, NUM_INTERVALS, CENTER_RADIUS);
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
	var tick                 = 0;
	var next_obstacle_set_at = 0;
	var next_obstacles       = [];

	// Create and enqueue sets of obstacles
	var obstacleSets = function()
	{
		var drawWave = function(wave)
		{
			for (var interval = 0; interval < 6; interval++)
			{
				if (wave.gaps.indexOf(interval) === -1)
				{
					next_obstacles.push({
						tick: Math.round(wave.start_tick),
						width: wave.width,
						interval: interval,
						speed_multiplier: wave.speed_multiplier || 1,
						passes_through: wave.passes_through || false,
						rebounds: wave.rebounds || false
					});
				}
			}
		};

		if (tick >= next_obstacle_set_at)
		{
			var type = obstacle_types[Math.floor(Math.random() * obstacle_types.length)];
			var gap, alt_gap, wave, width;
			if (type === 'single45') // 4 or 5 obstacles
			{
				var wave_duration = 240;
				for (wave = 0; wave < 4; wave++)
				{
					var i1 = Math.floor(Math.random() * 6);
					var i2 = Math.floor(Math.random() * 6);
					if (i1 === i2 && type === 'quick4s')
					{
						i2++;
					}
					drawWave({
						width: 40,
						start_tick: tick + wave * wave_duration / level.obstacle_speed,
						gaps: [i1, i2]
					});
				}
				next_obstacle_set_at += wave_duration * 4 / level.obstacle_speed;

			} else if (type === 'single5op' || type === 'single5' || type === 'fat5' || type === 'fat5op')
			{
				// 5 obstacles,  with the exit on opposite ends (single5op) or random (single5)
				gap     = Math.floor(Math.random() * 6);
				alt_gap = (gap + 3) % 6;
				for (wave = 0; wave < 4; wave++)
				{
					if (type === 'single5' || type === 'fat5')
					{
						gap     = Math.floor(Math.random() * 6);
						alt_gap = gap;
					}
					width = 40;
					if (type === 'fat5' || type === 'fat5op')
					{
						width = 80;
					}
					drawWave({
						width: width,
						start_tick: tick + wave * 240 / level.obstacle_speed,
						gaps: wave % 2 === 0 ? [gap] : [alt_gap]
					});
				}
				next_obstacle_set_at += 960 / level.obstacle_speed;
			} else if (type === 'labyrinth' || type === 'ifuckedup' || type === '4labyrinth' || type === '4ifuckedup')
			{
				// Gaps open and close, 5-4-5-4... (no prefix) or symmetrical 4-2-4-2... (4-prefix)
				gap   = Math.floor(Math.random() * 6);
				width = 84;
				if (type === 'ifuckedup' || type === '4ifuckedup')
				{
					width = 40;
				}
				for (wave = 0; wave < 6; wave++)
				{
					var next_gap   = (gap + (Math.random() > 0.5 ? 1 : -1) + 6) % 6;
					var leave_even = [gap];
					var leave_odd  = [gap, next_gap];
					if (type === '4labyrinth' || type === '4ifuckedup')
					{
						leave_even.push((gap + 3) % 6);
						leave_odd.push((gap + 3) % 6);
						leave_odd.push((next_gap + 3) % 6);
					}
					drawWave({
						width: width,
						start_tick: tick + wave * 160 / level.obstacle_speed,
						gaps: leave_even
					});
					if (wave < 5)
					{
						drawWave({
							width: width,
							start_tick: tick + (80 + wave * 160) / level.obstacle_speed,
							gaps: leave_odd
						});
					}
					gap = next_gap;
				}
				next_obstacle_set_at += 1120 / level.obstacle_speed;
			} else if (type === 'quickalt' || type === 'quickeralt')
			{
				// Quick alternating 3 obstacles
				for (wave = 0; wave < 3; wave++)
				{
					drawWave({
						width: 40,
						start_tick: tick + wave * 320 / level.obstacle_speed,
						gaps: [0, 2, 4]
					});
					drawWave({
						width: 40,
						start_tick: tick + (160 + wave * 320) / level.obstacle_speed,
						gaps: [1, 3, 5]
					});
				}
				next_obstacle_set_at += 1080 / level.obstacle_speed;
				if (type === 'quickeralt')
				{
					next_obstacle_set_at -= 120 / level.obstacle_speed;
				}
			} else if (type === 'multi4' || type === 'multi5')
			{
				for (wave = 0; wave < 3; wave++)
				{
					var obs = Math.floor(Math.random() * 6);
					var gaps_normal;
					var gaps_fast;
					if (type === 'multi4')
					{
						var flip    = Math.random() < 0.5;
						gaps_normal = [(obs + 1) % 6, (obs + 2) % 6, (obs + 4) % 6, (obs + 5) % 6];
						gaps_fast   = [obs, (obs + (flip ? 1 : 2)) % 6, (obs + 3) % 6, (obs + (flip ? 4 : 5)) % 6];
					} else
					{
						gaps_normal = [(obs + 1) % 6, (obs + 3) % 6, (obs + 5) % 6];
						gaps_fast   = [obs, (obs + 2) % 6, (obs + 4) % 6, (obs + 5) % 6];
					}
					drawWave({
						width: 40,
						start_tick: tick + wave * 320 / level.obstacle_speed,
						gaps: gaps_normal
					});
					drawWave({
						width: 40,
						start_tick: tick + wave * 320 / level.obstacle_speed,
						gaps: gaps_fast,
						speed_multiplier: 1.5
					});
				}
				next_obstacle_set_at += 960 / level.obstacle_speed;
			} else if (type === 'quickrepeat')
			{
				// Similar to labyrinth, but is longer and has 2 or 3 changes in every direction
				gap             = Math.floor(Math.random() * 6);
				var total_waves = 0;
				for (var subset = 0; subset < 4; subset++)
				{
					var waves = Math.floor(Math.random() * 2) + 2; // 2 or 3
					for (wave = 0; wave < waves; wave++)
					{
						drawWave({
							width: 72,
							start_tick: tick + (wave + total_waves) * 140 / level.obstacle_speed,
							gaps: [gap]
						});
						if (wave < waves - 1 || subset < 3)
						{
							alt_gap = (gap + (subset % 2 === 0 ? 1 : 5)) % 6;
							drawWave({
								width: 72,
								start_tick: tick + ((wave + total_waves) * 140 + 70) / level.obstacle_speed,
								gaps: [gap, alt_gap]
							});
							gap = alt_gap;
						}
					}
					total_waves += waves;
				}
				next_obstacle_set_at += (total_waves + 1) * 140 / level.obstacle_speed;
			} else if (type === '4fast')
			{
				// 4 fast obstacles with symmetric exits
				for (wave = 0; wave < 6; wave++)
				{
					gap = Math.floor(Math.random() * 6);
					drawWave({
						width: 40,
						start_tick: tick + wave * 240 / level.obstacle_speed,
						gaps: [gap, (gap + 3) % 6],
						speed_multiplier: 1.5
					});
				}
				next_obstacle_set_at += 1440 / level.obstacle_speed;
			} else if (type === '4through')
			{
				// 4 obstacles which pass through the center
				for (wave = 0; wave < 3; wave++)
				{
					gap     = Math.floor(Math.random() * 6);
					alt_gap = Math.random() > 0.25 ? (gap + 2) % 6 : (gap + 3) % 6;
					drawWave({
						width: 40,
						start_tick: tick + wave * 360 / level.obstacle_speed,
						gaps: [gap, alt_gap],
						passes_through: true
					});
				}
				next_obstacle_set_at += 1080 / level.obstacle_speed;
			} else if (type === '5rebound')
			{
				// 5 obstacles which rebound
				for (wave = 0; wave < 3; wave++)
				{
					gap     = Math.floor(Math.random() * 6);
					drawWave({
						width: 40,
						start_tick: tick + wave * 480 / level.obstacle_speed,
						gaps: [gap],
						rebounds: true
					});
				}
				next_obstacle_set_at += 1440 / level.obstacle_speed;
			}
		}
		drawPartialSets();
	};

	var drawPartialSets = function()
	{
		while (next_obstacles.length > 0 && next_obstacles[0].tick <= tick)
		{
			var obstacle = next_obstacles.shift();
			drawSingleObstacle(obstacle);
		}
	};

	var music_loaded = false;
	var game_created = false;

	var DuperHexagon = {
		preload: function()
		{
			game.load.audio('pixel_world', ['assets/music/pixel_world_lo.ogg', 'assets/music/pixel_world_lo.mp3']);
			game.load.audio('second_source',
				['assets/music/second_source_lo.ogg', 'assets/music/second_source_lo.mp3']);
			game.load.audio('reboot_complete',
				['assets/music/reboot_complete_lo.ogg', 'assets/music/reboot_complete_lo.mp3']);
			game.load.image('pickup', 'assets/img/pickup.png');
		},
		create: function()
		{
			game_created = true;
			// Do not stop when the window loses focus
			game.stage.disableVisibilityChange = true;
			game.world.setBounds(-SIZE_X / 2, -SIZE_Y / 2, SIZE_X / 2, SIZE_Y / 2);

			calcIntervals();

			// The last to be declared is always painted on top
			background_group    = game.add.group();
			obstacles_group     = game.add.group();
			center_group        = game.add.group();
			obstacles_group_top = game.add.group();
			player_group        = game.add.group();

			keys       = game.input.keyboard.createCursorKeys();
			keys.A     = game.input.keyboard.addKey(Phaser.Keyboard.A);
			keys.D     = game.input.keyboard.addKey(Phaser.Keyboard.D);
			keys.enter = game.input.keyboard.addKey(Phaser.Keyboard.ENTER);
			keys.enter.onDown.add(function()
			{
				tryRestart();
			});
		},
		update: function()
		{
			if (music_loaded)
			{
				if (crashed === false && playing === true)
				{
					var left  = keys.left.isDown || keys.A.isDown;
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
		addStartHandler: function(cb)
		{
			start_callbacks.push(cb);
		},
		addLoadHandler: function(cb)
		{
			loaded_callbacks.push(cb);
		},
		addCrashHandler: function(cb)
		{
			crash_callbacks.push(cb);
		}
	};
};