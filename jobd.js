
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Fishy Science Daemon Version 1
// Copyright 2017 Sleepless Software Inc. All Rights Reserved
// Author: Joe Hitchens <joe@sleepless.com>
// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// Standard node.js modules
var os = require("os");
var fs = require("fs");
var util = require("util");
var fs = require("fs");
var path = require("path");
var spawnSync = require("child_process").spawnSync;

// Sleepless Inc. modules
require("sleepless");
require("g")("log5");


// -----------------------------
// Misc. supporting functions
// -----------------------------

// Writes out an object semi-readable form for debugging purposes
var dump = function(o) {
	I(util.inspect(o), 3);
}

// return true if the path is a directory
var is_dir = function(path) {
	try { return fs.statSync(path).isDirectory(); } catch(e) { }
	return false;
}

var clobber_file = function(path) {
	try { fs.unlinkSync(path); } catch(e) { }
}

var add_crs = function(s) {
	if(os.platform() == "win32") {
		return s.replace(/\n/g, "\r\n");
	}
	return s;
}


// =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


var working = 0;		// number of jobs currently in working state


// start processing a job called "name"
var start = function(name) {

	working += 1;

	I("JOB \""+name+"\" starting");

	fs.renameSync("start/"+name, "working/"+name);		// move to working dir

	clobber_file("working/"+name+"/log.txt")
	clobber_file("working/"+name+"/errors.txt")

	// XXX as long as this is using spawnSync, it's probably not leveraging cpus.
	// XXX the cpu leveraging should be done in the science.js world anyway, since
	// XXX this is probably never going to be running multiple jobs at once.
	var r = spawnSync("node", [script], {
		cwd: "working/"+name,
		timeout: 1000 * 60 * 60,
		maxBuffer: 1000000,
		encoding: "utf8",
	});

	var ec = r.status;		// the exit code of the child process

	// add CR chars to these if we're running on windows (ew)
	r.stdout = add_crs(r.stdout);
	r.stderr = add_crs(r.stderr);

	// move to finished or failed dir
	if(ec == 0) {
		I("JOB \""+name+"\" finished");

		fs.writeFileSync("working/"+name+"/log.txt", r.stdout)

		fs.renameSync("working/"+name, "finished/"+name)
	}
	else {
		E("JOB \""+name+"\" **FAILED**");

		fs.writeFileSync("working/"+name+"/log.txt", r.stdout)
		fs.writeFileSync("working/"+name+"/errors.txt", r.stderr)

		fs.renameSync("working/"+name, "failed/"+name)
	}

	working -= 1;
}


var tick = function() {
	V("(working on "+working+" jobs)");

	if(working < num_cpus) {

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
I("FISHY SCIENCE JOB DAEMON");
var num_cpus = os.cpus().length;
I("Platform "+os.type()+" ("+os.platform()+") "+os.arch()+" "+num_cpus+"-CPUS");
I("Starting "+(new Date()));
var script = process.argv[1].replace( /[^\/]+$/, "science3.js")
var script = process.cwd() + "/science3.js";
V("script="+script);
process.chdir("./jobs");
setInterval(tick, 5 * 1000);




