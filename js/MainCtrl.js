app.controller('MainCtrl', function($scope, $interval, $timeout)
{
	'use strict';

	var time;

	var hints = [
		null,
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
				'Pick hexagons up to reduce the speed.'],
			duration: 5000
		},
		null,
		null
	];

	$scope.state = {
		first_game: true,
		disable_music: false,
		started: false,
		crashed: false,
		hinting: false,
		hints: [],
		time: 0,
		best_times: [],
		loading: false,
		show_loading: false,
		start: function(level)
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
		},
		onPressEnter: function($event)
		{
			if ($scope.state.first_game === true && $event.which === 13) // Enter key
			{
				$scope.state.start(1);
			}
		}
	};

	var startGame = function(level)
	{
		$scope.state.current_level = level;
		$scope.state.hinting       = false;
		$scope.state.loading       = true;
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
		});
		game.enterRestarts(true);
		game.start(level);
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
	game.enterRestarts(false);
	game.allowMusic(false);
	game.addStartHandler(function()
	{
		$scope.state.started = true;
		$scope.state.crashed = false;
		setTimer();
	});

	game.addCrashHandler(function()
	{
		$scope.state.crashed = true;
		$scope.state.time    = Number($scope.state.time);
		if ($scope.state.time > $scope.state.best_times[$scope.state.current_level])
		{
			$scope.state.best_times[$scope.state.current_level] = $scope.state.time;
		}
		$interval.cancel(timer);
		$timeout(); // update scope
	});

	game.miniStart(1);
});