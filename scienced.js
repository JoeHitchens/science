
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Fishy Science Daemon Version 1
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// Standard node.js modules
var fs = require("fs");
var util = require("util");
var fs = require("fs");
var path = require("path");

// Sleepless Inc. modules
require("sleepless");


// -----------------------------
// Misc. supporting functions
// -----------------------------

// Writes out an object semi-readable form for debugging purposes
var dump = function(o) {
	log(util.inspect(o), 3);
}

// return true if the path is a directory
var is_dir = function(path) {
	var stat = fs.statSync(path);
	return stat.isDirectory();
}



// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var start = function(path) {
	log("path="+path);
	fs.unlink(path);
}


var tick = function() {

	var dir = "./work/start"
	var files = fs.readdirSync(dir)
	files.forEach(function(file) {
		var path = dir + "/" + file;
		if(is_dir(path) {
			log("Starting job: "+path);
			setTimeout(start, 1 * 1000, path);
		}
		else {
			log("ignoring file: "+path);
		}
	});

}



// start the daemon running
setInterval(tick, 2 * 1000);




