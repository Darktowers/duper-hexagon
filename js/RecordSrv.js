app.service('RecordSrv', function(localStorageService)
{
	var records = null;

	var getRecords = function()
	{
		if (records)
		{
			return records;
		}
		records = [];
		for (var i = 0; i < 9; i++)
		{
			var record = localStorageService.get('level' + i);
			if (!record)
			{
				record = 0;
			}
			records.push(record);
		}
		return records;
	};

	var setRecord = function(level, time)
	{
		localStorageService.set('level' + level, time);
		records = null;
	};

	return {
		getRecords: getRecords,
		setRecord: setRecord
	};
});