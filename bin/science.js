
fs = require("fs");
path = require("path");
zlib = require("zlib");
exec = require("child_process").exec;

require("sleepless");
require("meet");



data_in = process.argv[2] || "data_in";
data_out = process.argv[3] || "data_out";
//log("data_in="+data_in);
//log("data_out="+data_out);

cmd = "find \""+data_in+"\" | grep .fastq.gz";
exec(cmd, function(err, stdout, stderr) {
	throwIf(err);
	
	//files = stdout.trim().split("\n").map(function(f) {
	//	return path.basename(f);
	//});
	files = stdout.trim().split("\n");

	//log(o2j(files));
	log("Directory "+data_in+" contains "+files.length+" .fastq.gz files");

	var m = new Meet();
	files = [files[0], files[1]];
	files.forEach(function(file) {
		m.queue(do_science, file);
	});
	m.allDone(process.exit);

});


do_science = function(p, cb) {
	var file = path.basename(p);
	//log("FILE: "+file);

	fs.readFile(p, function(err, buffer) {
		throwIf(err);
		zlib.gunzip(buffer, function(err, data) {
			throwIf(err);
			var text = data.toString("utf8");
			//throwIf(text == "", "(empty)");
			if(text == "") {
				log(file+" is empty");
			}
			else {
				//log("text="+text);
				var lines = text.split("\n");
				log(file+" has lines "+lines.length);
				//log(text.toString("utf8").abbr(100));
			}
			cb();
		});
	});
}



