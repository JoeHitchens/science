
var CSV = {
	from_string: function(str) {
		str = str.trim().replace( /\r/, "" );
		var lines = str.trim().split("\n");			// convert it to array of lines

		// iterate through the lines
		for(var i = 0; i < lines.length; i++) {
			var line = lines[i];

			var a = line.split(",");		// roughly convert line to array of cells by splitting on cammas

			// iterate through the cells
			var cells = [];
			for(var j = 0; j < a.length; j++) {
				var c = a[j];				// c is the original cell
				if(c[0] == '"') {
					// cell starts with "
					if(c[c.length - 1] == '"') {
						// cell ends with "; double quoted cell containing no commas, nothing to fix
					}
					else {
						// this cell apparently split on a comma that was within a double quoted cell
						j++;
						while(j < a.length) {
							c += "," + a[j]
							if(c[c.length - 1] == '"') {
								// now it ends with a " - we've rebuilt the broken cell
								break;
							}
							j++;
						}
					}
					c = c.substr(1, c.length - 2);
				}
				c = c.replace( /""/g, '"' );	// unescape double quotes if present
				cells.push(c);					// add to array of processed cells
			}

			lines[i] = cells;		// replace raw line with the process array of cells.
		}

		return lines;
	},

	to_string:  function(lines) {
		var str = "";
		for(var i = 0; i < lines.length; i++) {
			var cells = lines[i];
			for(var j = 0; j < cells.length; j++) {
				cells[j] = ""+cells[j];
				if( cells[j].toLowerCase().match( /[^-_.a-z0-9]/ ) ) {
					// quote it
					cells[j] = '"' + cells[j].replace( /"/g, '""' ) + '"';
				}
			}
			str += cells.join(",") + "\n";
		}
		return str;
	},

};

if(typeof globals === "undefined" && typeof window === "object") {
	// browser
}
else {
	// node

	module.exports = CSV

	var fs = require("fs");
	
	CSV.from_file = function(filename, cb) {
		fs.readFile(filename, "utf8", function(err, str) {
			if(err) {
				cb(err, null);
			}
			else {
				cb(null, CSV.from_string(str));
			}
		});
	}


	CSV.to_file = function(csv, filename, cb) {
		var str = CSV.to_string(csv);
		fs.writeFile(filename, str, "utf8", cb);
	}

	// run tests if module is being executed directly
	if(require && require.main === module) {
		var argv = process.argv;
		if(argv.length < 4) {
			console.log("Usage: script input.csv output.csv");
		}
		else {
			console.log("reading from "+argv[2]);
			CSV.from_file(argv[2], function(e, csv) {
				console.log("read "+csv.length+" lines");
				console.log("writing to "+argv[3]);
				CSV.to_file(csv, argv[3], function(e) {
					console.log("done");
				});
			});
		}
	}

}



