app.service('LevelUnlockSrv', function(RecordSrv)
{
	var PREREQUISITES = [
		[],     // Serenity: none
		[0],    // Tension: Serenity
		[1],    // Panic: Tension
		[0],    // Serenity+: Serenity
		[1, 3], // Tension+: Tension, Serenity+
		[2, 4], // Panic+: Panic, Tension+
		[3],    // Serenity Overtime: Serenity+
		[4, 6], // Tension Overtime: Tension+, Serenity Overtime
		[5, 7]  // Panic Overtime: Panic+, Serenity Overtime
	];

	var UNLOCK_AT = 60;
	var unlocked = [true, false, false, false, false, false, false, false, false];

	var checkUnlock = function()
	{
		var old_records   = RecordSrv.getRecords();
		for (var i = 1; i < 9; i++)
		{
			var level_unlocked = true;
			for (var j = 0; j < PREREQUISITES.length; j++)
			{
				if (Number(old_records[PREREQUISITES[i][j]]) < UNLOCK_AT)
				{
					level_unlocked = false;
				}
			}
			unlocked[i] = level_unlocked;
		}
		return unlocked;
	};

	var levelUnlocks = function(level)
	{
		var records = RecordSrv.getRecords();
		var result = [];
		// If this level has already been beaten, beating it again won't unlock any levels
		if (records[level] >= UNLOCK_AT)
		{
			return result;
		}

		for (var i = 1; i < PREREQUISITES.length; i++)
		{
			if (PREREQUISITES[i].indexOf(level) > -1)
			{
				var unlocks = true;
				PREREQUISITES[i].map(function(other_level)
				{
					if (level !== other_level && records[other_level] < UNLOCK_AT)
					{
						unlocks = false;
					}
				});
				if (unlocks)
				{
					result.push(i);
				}
			}
		}
		return result;
	};

	return {
		UNLOCK_AT: UNLOCK_AT,
		checkUnlock: checkUnlock,
		levelUnlocks: levelUnlocks
	};
});