app.controller('MainCtrl', function($scope, $interval, $timeout)
{
	'use strict';
	var time;

	var levels = ['', 'Serenity', 'Tension', 'Panic', 'Serenity+', 'Tension+', 'Panic+', 'Serenity Overtime',
		'Tension Overtime', 'Panic Overtime'];

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
				'Darker obstacles go back from the center.',
				'Remember: you need to dodge them twice.'],
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
		started: false,
		crashed: false,
		hinting: false,
		hints: [],
		time: 0,
		best_times: [],
		loading: false,
		start: function(level)
		{
			$scope.state.first_game = false;
			if (!$scope.state.best_times[level])
			{
				$scope.state.best_times[level] = 0;
				if (hints[level])
				{
					// If there is a hint for a new level, display it before starting the game
					$scope.state.hints   = hints[level].text;
					$scope.state.hinting = true;
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
		onPressEnter : function($event)
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
		$scope.state.hinting = false;
		$scope.state.loading = true;
		game.addLoadHandler(function()
		{
			$scope.state.loading = false;
			if ($scope.state.started === true)
			{
				setTimer();
			}
		});

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
});