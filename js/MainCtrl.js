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
		first_game: true,
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
		unlocked: LevelUnlockSrv.checkUnlock().unlocked,
		loading: false,
		show_loading: false,
		just_unlocked: [],
		start: function(level)
		{
			if ($scope.state.unlocked[level])
			{
				$scope.state.first_game = false;
				game.allowMusic(!$scope.state.disable_music);
				if (!$scope.state.best_times[level])
				{
					$scope.state.best_times[level] = 0;
					if (hints[level])
					{
						// If there is a hint for a new level, display it before starting the game
						$scope.state.hints   = hints[level].text;
						$scope.state.hinting = true;
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
				if ($scope.state.first_game === true)
				{
					$scope.state.start(0);
				}
			} else if ($event.which === 27) // Escape
			{
				ended_by_user     = true;
				$scope.state.menu = true;
				if ($scope.state.started === true)
				{
					$scope.state.started = false;
					game.end();
				}
			}
		}
	};

	var startGame = function(level)
	{
		$scope.state.current_level = level;
		$scope.state.hinting       = false;
		$scope.state.loading       = true;
		$scope.state.menu          = false;
		$timeout(function()
		{
			// Prevent loading dialog from appearing if we have to wait for less than 100 ms,
			// otherwise the screen will flicker
			if ($scope.state.loading === true)
			{
				$scope.state.show_loading = true;
			}
		}, 100);
		game.addLoadHandler(function()
		{
			$scope.state.loading      = false;
			$scope.state.show_loading = false;
			if ($scope.state.started === true)
			{
				setTimer();
			}
			game.enterRestarts(true);
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
			$scope.state.time = ((Date.now() - time) / 1000).toFixed(1);
		}, 100);
	};

	var game = duperHexagon();
	game.addStartHandler(function()
	{
		$scope.state.started       = true;
		$scope.state.crashed       = false;
		$scope.state.just_unlocked = [];
		setTimer();
	});

	game.addCrashHandler(function()
	{
		$scope.state.crashed = true;
		$interval.cancel(timer);

		if (!ended_by_user)
		{
			$scope.state.time = Number($scope.state.time);
			if ($scope.state.time > $scope.state.best_times[$scope.state.current_level])
			{
				RecordSrv.setRecord($scope.state.current_level, $scope.state.time);
				$scope.state.best_times[$scope.state.current_level] = $scope.state.time;
				var seconds                                         = Math.floor($scope.state.time);
				if (seconds >= $scope.state.unlock_at) // Can we unlock levels?
				{
					var unlock                 = LevelUnlockSrv.checkUnlock();
					$scope.state.unlocked      = unlock.unlocked;
					$scope.state.just_unlocked = unlock.just_unlocked;
				}
			}
			$scope.state.menu = false;
		} else
		{
			ended_by_user     = false;
			$scope.state.menu = true;
		}
		$timeout(); // update scope
	});

	game.enterRestarts(false);
	game.allowMusic(false);
	game.miniStart(0);
});