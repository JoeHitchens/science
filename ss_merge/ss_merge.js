

fs = require("fs");
util = require("util");

XLSX = require("xlsx");
XU = XLSX.utils;
EC = XU.encode_cell;

sleepless = require("sleepless");



max_errors = 0;		// 0 disables max error exiting behavior
num_errors = 0;

argv = process.argv;
if(argv.length < 3) {
	log("Usage: node ss_merge.js file1.xlsx [file2.xlsx ...]");	
	process.exit(1);
};



// walk through the command line arguments
// expect each one to be a filename/path
// load each one as a butter and feed it through XLSX to convert it to a workbook object.
// then append each workbook to the wbs array.
files = [];
wbs = [];
for(var i = 2; i < argv.length; i += 1) {

	var fname = argv[i];

	log("Loading file "+fname);
	var buf = fs.readFileSync(fname);
	var wb = XLSX.read(buf, {type:'buffer'});


	wb.SheetNames.forEach(function(shname) {
		var sheet = wb.Sheets[shname];
		var rng = XU.decode_range(sheet['!ref']);
		sheet.num_cols = rng.e.c + 1;
		sheet.num_rows = rng.e.r + 1;
		log("  worksheet '"+shname+"' has "+sheet.num_cols+" columns and "+sheet.num_rows+" rows");
	});

	wbs.push(wb);
	files.push(fname);
}



// This will be an object with default blank values for all the distinct
// keys found in the first rows of all the worksheets in all the workbooks.
// It will be cloned to create new fish objects.
proto_fish = {};


// Scan first row of all sheets in all workbooks
// Use the value found to make a key in proto_fish with default value of ""
log("Making the proto-fish ...");
// iterate through the workbooks
for(var i = 0; i < wbs.length; i += 1) {
	//log("  "+files[i]);

	var wb = wbs[i];

	// iterate through the worksheets in the workbook
	for(var shnum = 0; shnum < wb.SheetNames.length; shnum += 1) {
		var shname = wb.SheetNames[shnum];
		//log("    "+shname);
		var sheet = wb.Sheets[shname];
		sheet.lookup = [];


		// iterate through the columns in the first row of the sheet
		for(var c = 0; c < sheet.num_cols; c += 1) {
			var addr = EC({r:0, c:c});
			var cell = sheet[addr];
			if(cell !== undefined) {
				// cell is not empty
				var fld = (cell.v).toId();
				sheet.lookup[c] = fld;
				proto_fish[fld] = "";
			}
		}
	};

}
//log("proto_fish = "+util.inspect(proto_fish));


// return a clone of the proto_fish
function new_fish() {
	return j2o(o2j(proto_fish));
};


// the fish hash which holds fish objects, keyed by their NWFSC fish ID (nwfsc)
fishes = {};

// pull a fish out of the hash by it's nwfsc
function get_fish(nwfsc) {
	var fish = fishes[nwfsc];
	if(fish === undefined) {
		fish = new_fish();
		fish.nwfsc = nwfsc;
		fishes[nwfsc] = fish;
	}
	return fish;
};


log("Making the fish ...");
for(var i = 0; i < wbs.length; i += 1) {
	log("  File: "+files[i]);

	var wb = wbs[i];

	// iterate through the worksheets in the workbook
	for(var shnum = 0; shnum < wb.SheetNames.length; shnum += 1) {
		var shname = wb.SheetNames[shnum];
		log("    Sheet: "+shname);
		var sheet = wb.Sheets[shname];

		// iterate through the rows starting with the second row.
		for(var r = 1; r < sheet.num_rows; r += 1) {
			var tmp_fish = new_fish();		// make a temp fish to hold the values from this row.
			// iterate through the columns of this row and add the flds found to the temp_fish
			for(var c = 0; c < sheet.num_cols; c += 1) {
				var addr = EC({r:r, c:c});
				var cell = sheet[addr];
				if(cell !== undefined) {
					// cell is not empty
					var fld = sheet.lookup[c];		// get the fld name from the lookup table
					tmp_fish[fld] = cell.v;
				}
			}
			if(!tmp_fish.nwfsc) {
				//log("row "+r+": no NWFSC found");
				continue;
			}
			let nwfsc = tmp_fish.nwfsc;				// the nwfsc of the fish we're working on
			var fish = get_fish(nwfsc);	// fetch the real fish object for this nwfsc
			// merge the tmp_fish's data with the real fish
			// iterate through the fields found in the tmp fish ...
			for(var fld in tmp_fish) {
				let new_v = tmp_fish[fld];
				// now fld is the field found in the tmp_fish and new_v is it's value
				if(fish[fld] == "") {
					fish[fld] = new_v;	// real fish doesn't have this value, so copy it from tmp to real
					continue;
				}
				// the real fish has some data in this field.
				if(new_v == "") {
					// tmp fish has "no data" for this field, so do nothing.
					continue;
				}
				if(fish[fld] == new_v) {
					// tmp fish has the "same data" for this field, so do nothing.
					continue;
				}
				// both have data for this field, but it's not the same.
				log("sheet '"+shname+"': row "+r+": ERROR: Different data for fish '"+nwfsc+"': field='"+fld+"': previously saw '"+fish[fld]+"'; now see '"+new_v+"'");
				num_errors += 1;
				if(max_errors > 0 && num_errors >= max_errors) {
					log("exiting ... after max "+max_errors+" errors reached.");
					process.exit(1);
				}
				fish[fld] = "ERROR";
			}
		}
	};

}



// first convert the fish has to sorted array
a_fishes = [];		// make an array
// iterate through the fish hash and push each fish onto the array.
for(var nwfsc in fishes) {
	a_fishes.push(fishes[nwfsc]);
}
// sort the array alphabetically by nwfsc
log("Sorting fish by NWFSC ...");
a_fishes.sort((a, b)=>{
	if(a.nwfsc > b.nwfsc) { return 1 };
	if(a.nwfsc < b.nwfsc) { return -1 };
	return 0;
});

// convert the a_fishes array to an array-of-arrays (aoa)
log("Organizing data ...");
aoa = [];
hdr_row = null;
a_fishes.forEach((fish, i)=>{

	if(i == 0) {
		// this the first one, so ...
		hdr_row = [];		// make the header row
		// iterate through the fields in this first fish and push the field names onto the array
		for(var fld in fish) {
			hdr_row.push(fld);
		}
		// push the hdr_row array onto the array-of-arrays 
		aoa.push(hdr_row);
	}

	// do the actual fish data
	var row = [];		// make a row for this fish
	// iterate through the flds using the hdr_row order and push each value onto the row array
	hdr_row.forEach((fld, i)=>{
		row.push(fish[fld]);
	});
	// push the row onto the array-of-arrays
	aoa.push(row);
});

wb = XLSX.utils.book_new();		// Create a new excel workbook called wb
ws = XU.aoa_to_sheet(aoa);		// convert the array-of-arrays to a worksheet
XU.book_append_sheet(wb, ws, "A Bucket of Fish");	// add the worksheet to the workbook

out_file = "output.xlsx";
log("Writing to '"+out_file+"'");
XLSX.writeFile(wb, out_file);	// write the workbook out to a file.

log("Done.");




