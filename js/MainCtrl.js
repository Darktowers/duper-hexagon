app.controller('MainCtrl', function($scope, $interval, $timeout)
{
	'use strict';
	var time;

	$scope.state = {
		started: false,
		crashed: false,
		time: 0,
		best_time: 0,
		start: game.start
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
		if ($scope.state.time > $scope.state.best_time)
		{
			$scope.state.best_time = $scope.state.time;
		}
		$interval.cancel(update_interval);
		$timeout(); // update scope
	});
});