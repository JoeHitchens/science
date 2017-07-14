
drop_target = I("drop_target");
output = I("output");

out = function(s) {
	var d = document.createElement("div");
	d.innerHTML = "<p>"+s+"</p>";
	output.appendChild(d);
}


to_text = function(file, cb) {
	var fr = new FileReader();
	fr.onload = function() { cb(fr.result); }
	fr.readAsText(file);
}

abort = function(s) {
	alert("Aborted.\n\n"+s);
}

warn = function(s) {
	out("WARNING: "+s);
}

valid_nwfsc = function(s) {
	return s.match( /\d{5}-\d{4}/ );
}

FDrop.attach(drop_target, function(files) {

	var file = files[0];
	if(!file) { return; };

	var fname = file.name;
	if(!fname.match( /\.csv$/i )) { return abort("I can only eat CSV files."); };

	var fname = file.name.replace(/\.csv$/i, "").toId();
	console.log("fname="+fname);

	to_text(file, function(txt) {
		var csv = CSV.from_string(txt);

		out("Loaded \""+file.name+"\".");
		out("File contains "+csv.length+" lines.");
		if(csv.length < 2) { return abort("Seems a little short doesn't it?"); }

		var cols = {};

		"NWFSC#;FL;Date of Capture;Dam;Sire;Dam Origin;Sire Origin".split(";").forEach(function(h) {
			var k = h.toId();
			var hrow = csv[0];
			for(var i = 0; i < hrow.length; i++) {
				if(hrow[i].lcase() == h.lcase()) {
					cols[h.toId()] = {
						cnum: i,
					};
				}
			}
		});


		var skipped_lines = 0;
		var h_offs = {};
		var h_dam = {};
		var h_sire = {};
		var num_offs = 0;
		var num_juve = 0;
		var num_adlt = 0;

		for(var i = 1; i < csv.length; i++) {		// skip first row (headings)
			var row = csv[i];

			var nwfsc = row[cols.nwfsc.cnum];	// get NWFSC# (some sort of unique fish identifier)
			//if(!nwfsc) { skipped_lines += 1; continue; }
			//if(!valid_nwfsc(nwfsc)) { return abort("Bad NWFSC# '"+nwfsc+"' on line "+i); };
			if(!valid_nwfsc(nwfsc)) { skipped_lines += 1; continue; }

			var fl = row[cols.fl.cnum];			// get FL (fish length)
			var date_of_capture = us2ts(row[cols.date_of_capture.cnum]);

			var offs = h_offs[nwfsc];			// get offs obj from hash
			if(!offs) {
				// not yet present
				offs = {						// create it
					line: i,
					fl: 0,
				}
				h_offs[nwfsc] = offs;			// put it in hash
				num_offs += 1;					// track # of objs in hash

				offs.fl = fl;					// note first seen FL

				// is adult or juvenile?
				if(offs.fl < 300) {
					offs.adult = false;
					num_juve += 1;
				}
				else {
					offs.adult = true;
					num_adlt += 1;
				}

				offs.date_of_capture = null;
				if(date_of_capture) {
					offs.date_of_capture = new Date(date_of_capture * 1000);
				}

			}
			else {
				warn("found "+nwfsc+" on both lines "+offs.line+" and "+i);
			}

			//if(offs.fl && offs.fl != fl) {
			//	out(nwfsc+": differing value for FL (first saw "+offs.fl+", also found "+fl+")");
			//}

			//if(offs.date_of_capture && offs.date_of_capture != date_of_capture) {
			//	out(nwfsc+": differing value for Date-of-Capture (first saw "+offs.date_of_capture+", also found "+date_of_capture+")");
			//}

		}

		out("Skipped lines: "+skipped_lines+" (Lines where NWFSC# column was not like 12345-1234)");
		out("Unique offspring found: "+num_offs+" ("+num_juve+" juvenile, "+num_adlt+" adult)");

	});


});

out("The Salmonalysis&trade; Mark I is ready.");

