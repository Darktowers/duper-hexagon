module.exports = function(grunt)
{
	grunt.initConfig({
		ngAnnotate: {
			options: {},
			angular: {
				files: {
					'js/app.annotated.js': ['js/app.js', 'js/RecordSrv.js', 'js/LevelUnlockSrv.js', 'js/MainCtrl.js']
				}
			}
		},
		uglify: {
			my_target: {
				files: {
					'js/app.min.js': ['js/duper-hexagon.js', 'js/app.annotated.js']
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-ng-annotate');
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.registerTask('default', ['ngAnnotate', 'uglify']);
};