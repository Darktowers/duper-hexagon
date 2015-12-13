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

	$scope.state = {
		show_welcome: true,
		disable_music: false,
		started: false,
		crashed: false,
		hinting: false,
		menu: false,
		hints: [],
		time: 0,
		unlock_at: LevelUnlockSrv.UNLOCK_AT,
		best_times: RecordSrv.getRecords(),
		level_names: ['Serenity', 'Tension', 'Panic', 'Serenity+', 'Tension+', 'Panic+', 'Serenity Overtime',
			'Tension Overtime', 'Panic Overtime'],
		unlocked: LevelUnlockSrv.checkUnlock(),
		loading: false,
		show_loading: false,
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
						state.hints   = hints[level].text;
						state.hinting = true;
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
			if ($event.which === 13) // Enter key
			{
				if (state.show_welcome === true)
				{
					if (state.unlocked[1] === false)
					{
						state.start(0);
					} else
					{
						state.show_welcome = false;
						state.menu = true;
					}
				} else if (state.started === true)
				{
					state.start(state.current_level);
				}
			} else if ($event.which === 27) // Escape
			{
				ended_by_user     = true;
				state.menu = true;
				if (state.started === true)
				{
					state.started = false;
					game.end();
				}
			}
		}
	};

	var state = $scope.state;

	var startGame = function(level)
	{
		state.current_level = level;
		state.hinting       = false;
		state.loading       = true;
		state.menu          = false;
		$timeout(function()
		{
			// Prevent loading dialog from appearing if we have to wait for less than 100 ms,
			// otherwise the screen will flicker
			if (state.loading === true)
			{
				state.show_loading = true;
			}
		}, 100);
		game.addLoadHandler(function()
		{
			state.loading      = false;
			state.show_loading = false;
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
		time = Date.now();
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
		state.started     = true;
		state.crashed     = false;
		state.next_unlock = LevelUnlockSrv.levelUnlocks(state.current_level);
		setTimer();
	});

	game.addCrashHandler(function()
	{
		state.crashed = true;
		$interval.cancel(timer);

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
			state.menu = false;
		} else
		{
			ended_by_user     = false;
			state.menu = true;
		}
		$timeout(); // update scope
	});

	game.enterRestarts(false);
	game.allowMusic(false);
	game.miniStart(0);
});