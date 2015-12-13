app.controller('MainCtrl', function($scope, $interval, $timeout, RecordSrv, LevelUnlockSrv)
{
	'use strict';

	var time;

	var hints = [
		{
			text: ['Press Left and Right to move around the center hexagon.', 'Try not to crash.'],
			duration: 5000
		},
		null,
		null,
		{
			text: ['Lighter obstacles pass through the center to the other side.',
				'Darker obstacles bounce off the center and travel back.',
				'You\'ll need to dodge both of these twice.'],
			duration: 8000
		},
		null,
		null,
		{
			text: ['In Overtime mode, everything becomes faster and faster.',
				'Pick up hexagons to reduce the speed.'],
			duration: 5000
		},
		null,
		null
	];

	// Whether the user pressed Escape to end the game
	var ended_by_user = false;
	var game_started  = false;
	var game_loading  = false;

	$scope.state = {
		mode: 'welcome',
		disable_music: false,
		started: false,
		crashed: false,
		hints: [],
		time: 0,
		selected_level: 0,
		unlock_at: LevelUnlockSrv.UNLOCK_AT,
		best_times: RecordSrv.getRecords(),
		level_names: ['Serenity', 'Tension', 'Panic', 'Serenity+', 'Tension+', 'Panic+', 'Serenity Overtime',
			'Tension Overtime', 'Panic Overtime'],
		unlocked: LevelUnlockSrv.checkUnlock(),
		loading: false,
		next_unlock: [],
		start: function(level)
		{
			if (state.unlocked[level])
			{
				state.show_welcome = false;
				game.allowMusic(!state.disable_music);
				if (!state.best_times[level])
				{
					state.best_times[level] = 0;
					if (hints[level])
					{
						// If there is a hint for a new level, display it before starting the game
						state.mode  = 'hints';
						state.hints = hints[level].text;
						game.miniStart(level);
						game.allowMoving(true);
						$timeout(function()
						{
							startGame(level);
						}, hints[level].duration);
					} else
					{
						startGame(level);
					}
				} else
				{
					startGame(level);
				}
			}
		},
		onKeyDown: function($event)
		{
			if (game.isGameCreated())
			{
				if ($event.which === 13) // Enter key
				{
					handleEnter();
				} else if ($event.which === 27) // Escape
				{
					handleEscape();
				} else if ($event.which >= 37 && $event.which <= 40) // Arrow keys
				{
					handleArrow($event.which);
				}
			}
		},
		level_range: [0, 1, 2, 3, 4, 5, 6, 7, 8]
	};

	var handleEnter = function()
	{
		if (state.mode === 'welcome')
		{
			if (state.unlocked[1] === false)
			{
				state.mode = 'ingame';
				state.start(0);
			} else
			{
				state.mode = 'menu';
			}
		} else if (state.mode === 'crashed')
		{
			state.start(state.current_level);
		} else if (state.mode === 'menu')
		{
			state.start(state.selected_level);
		}
	};

	var handleEscape = function()
	{
		ended_by_user = true;
		state.mode    = 'menu';
		if (state.started === true)
		{
			state.started = false;
			game.end();
		}
	};

	var handleArrow = function(key)
	{
		if (state.mode === 'menu')
		{
			var selected = state.selected_level;
			if (key === 37) // left
			{
				selected--;
				if (selected < 0 || selected % 3 === 2)
				{
					selected += 3;
				}
			} else if (key === 38) // up
			{
				selected -= 3;
				if (selected < 0)
				{
					selected += 9;
				}
			} else if (key === 39) // right
			{
				selected++;
				if (selected % 3 === 0)
				{
					selected -= 3;
				}
			} else if (key === 40) // down
			{
				selected += 3;
				if (selected >= 9)
				{
					selected -= 9;
				}
			}
			if (state.unlocked[selected])
			{
				state.selected_level = selected;
			}
		}
	};

	var state = $scope.state;

	var startGame = function(level)
	{
		state.current_level = level;
		game_loading        = true;
		state.crashed       = false;
		state.mode          = 'ingame';
		$timeout(function()
		{
			// Prevent loading dialog from appearing if we have to wait for less than 100 ms,
			// otherwise the screen will flicker
			if (game_loading === true)
			{
				state.mode = 'loading';
			}
		}, 100);
		game.addLoadHandler(function()
		{
			game_loading = false;
			state.mode   = 'ingame';
			if (state.started === true)
			{
				setTimer();
			}
		});
		game.start(level);
		$timeout();
	};

	var timer;
	var setTimer = function()
	{
		state.time = 0;
		time       = Date.now();
		if (timer)
		{
			$interval.cancel(timer);
		}
		timer = $interval(function()
		{
			state.time = ((Date.now() - time) / 1000).toFixed(1);
		}, 100);
	};

	var game = duperHexagon();
	game.addStartHandler(function()
	{
		state.started        = true;
		state.selected_level = state.current_level;
		state.mode           = 'ingame';
		state.next_unlock    = LevelUnlockSrv.levelUnlocks(state.current_level);
		setTimer();
	});

	game.addCrashHandler(function()
	{
		$interval.cancel(timer);
		state.crashed = true;

		if (!ended_by_user)
		{
			state.time = Number(state.time);
			if (state.time > state.best_times[state.current_level])
			{
				RecordSrv.setRecord(state.current_level, state.time);
				state.best_times[state.current_level] = state.time;
				var seconds                           = Math.floor(state.time);
				if (seconds >= state.unlock_at) // Can we unlock levels?
				{
					state.unlocked = LevelUnlockSrv.checkUnlock();
				}
			}
			state.mode = 'crashed';
		} else
		{
			ended_by_user = false;
			state.mode    = 'menu';
		}
		$timeout(); // update scope
	});

	game.enterRestarts(false);
	game.allowMusic(false);
	game.miniStart(0);
});