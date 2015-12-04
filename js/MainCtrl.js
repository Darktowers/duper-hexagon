app.controller('MainCtrl', function($scope, $interval, $timeout)
{
	'use strict';
	var time;

	$scope.state = {
		started: false,
		crashed: false,
		time: 0,
		best_times: [],
		loading: false,
		start: function(level)
		{
			$scope.state.current_level = level;
			if (!$scope.state.best_times[$scope.state.current_level])
			{
				$scope.state.best_times[$scope.state.current_level] = 0;
			}

			$scope.state.loading = true;
			game.addLoadHandler(function()
			{
				$scope.state.loading = false;
			});

			game.start(level);
		}
	};

	var update_interval;

	game.addStartHandler(function()
	{
		time = Date.now();
		$scope.state.started = true;
		$scope.state.crashed = false;
		$scope.state.time = 0;
		update_interval = $interval(function()
		{
			$scope.state.time = ((Date.now() - time) / 1000).toFixed(1);
		}, 100);
	});

	game.addCrashHandler(function()
	{
		$scope.state.crashed = true;
		$scope.state.time = Number($scope.state.time);
		if ($scope.state.time > $scope.state.best_times[$scope.state.current_level])
		{
			$scope.state.best_times[$scope.state.current_level] = $scope.state.time;
		}
		$interval.cancel(update_interval);
		$timeout(); // update scope
	});
});