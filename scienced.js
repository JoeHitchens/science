
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


var working = 0;		// number of jobs currently in working state


var work = function(name) {
	return 0;
}


// start processing a job called "name"
var start = function(name) {

	working += 1;

	log("starting job: "+name);

	fs.renameSync("start/"+name, "working/"+name);		// move to working dir

	// XXX do the work
	var r = work(name);

	// move to finished or failed dir
	if(r == 0) {
		log("finished: "+name);
		fs.renameSync("working/"+name, "finished/"+name)
	}
	else {
		log("**** FAILED: "+name);
		fs.renameSync("working/"+name, "failed/"+name)
	}

	working -= 1;
}


var tick = function() {
	log("(working on "+working+" jobs)");

	if(working < 1) {		// XXX change to num cpus

		var files = fs.readdirSync("start")
		for(var i = 0; i < files.length; i++) {
			var name = files[i];
			if(is_dir("start/" + name)) {
				start(name);
				break;
			}
		}

	}

}



// start the daemon running
log("FISHY SCIENCE DAEMON");
log("Starting "+(new Date()));
process.chdir("./jobs");
setInterval(tick, 2 * 1000);




