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
		var just_unlocked = [];
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
			if (level_unlocked)
			{
				if (!unlocked[i])
				{
					just_unlocked.push(i);
				}
				unlocked[i] = level_unlocked;
			}
		}
		return {
			unlocked: unlocked,
			just_unlocked: just_unlocked
		}
	};

	return {
		UNLOCK_AT: UNLOCK_AT,
		checkUnlock: checkUnlock
	};
});