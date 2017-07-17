
global = window;

drop_target = I("drop_target");
output = I("output");

out = function(s) {
	var d = document.createElement("div");
	d.innerHTML = "<p>"+s+"</p>";
	output.appendChild(d);
}


downloadURI = function(uri, name) {
	var link = document.createElement("a");
	link.download = name;
	link.href = uri;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	delete link;
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

fix_nwfsc = function(s) {
	return s.match( /\d{5}-\d{4}/ ) ? s : ""
}

fix_origin = function(s) {
	return s.match( /^[a-zA-Z]+$/i ) ? s : ""
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

		"NWFSC#;Brood Year;FL;Date of Capture;PP?;Dam;Sire;Dam Origin;Sire Origin".split(";").forEach(function(h) {
			var hrow = csv[0];
			for(var i = 0; i < hrow.length; i++) {
				if(hrow[i].lcase() == h.lcase()) {
					cols[h.toId()] = {
						cnum: i,
					};
					//var k = h.toId().ucase();
					//global[k] = i;
				}
			}
		});


		var skipped_lines = 0;
		var h_fish = {};		// hash of objects, one per fish found in input
		var num_fish = 0;
		var num_juve = 0;
		var num_adlt = 0;

		for(var i = 1; i < csv.length; i++) {		// skip first row (headings)
			var row = csv[i];

			var nwfsc = row[cols.nwfsc.cnum];	// get NWFSC# (some sort of unique fish identifier)
			if(!fix_nwfsc(nwfsc)) { skipped_lines += 1; continue; }

			var fish = h_fish[nwfsc];			// get fish obj from hash
			if(!fish) {
				// not yet present

				// create new fish object for this nwfsc #
				fish = {
					// these fields from input
					line: i,
					nwfsc: nwfsc,
					brood_year: row[cols.brood_year.cnum],
					fl: row[cols.fl.cnum],
					date_of_capture: us2ts(row[cols.date_of_capture.cnum]),
					pp: row[cols.pp.cnum],
					mom: fix_nwfsc(row[cols.dam.cnum]),
					dad: fix_nwfsc(row[cols.sire.cnum]),
					mom_origin: fix_origin(row[cols.dam_origin.cnum]),
					dad_origin: fix_origin(row[cols.sire_origin.cnum]),
					// these fields to output
					year_of_return: 0,
					date: 0,
					julian_date: 0,
					sex: "",
					origin: "",
					length: row[cols.fl.cnum],
					kids_w_known_mates: 0,
					num_mates: 0,
					kids_w_uc_mates: 0,
					kids_total: 0,
					// for internal use
					juve_kids: 0,		// # of juvenile offspring
					mates: {},
					num_mates: 0,
				}

				h_fish[nwfsc] = fish;			// put it in hash
				num_fish += 1;					// track # of objs in hash

				if(fish.fl < 300) { num_juve += 1 } else { num_adlt += 1 };
			}
			else {
				warn("Found "+nwfsc+" on both lines "+fish.line+" and "+i);
			}
		}

		var h_moms = {};		// hash of moms
		var num_moms = 0;
		var h_dads = {};		// hash of dads
		var num_dads = 0;
		var h_prnts = {};		// hash of both moms and dads
		var num_prnts = 0;


		out("Skipped lines: "+skipped_lines+" (Where NWFSC# column didn't contain an NWFSC#");
		out("Unique NWFSC#'s found: "+num_fish+" ("+num_juve+" juvenile, "+num_adlt+" adult)");


		// walk through the fish hash
		for(var k in h_fish) {

			var fish = h_fish[k];		// get the fish obj out of hash

			var id_mom = fish.mom;		// get NWFSC# for mom
			var id_dad = fish.dad;		// get NWFSC# for dad

			var mom = h_fish[id_mom] ? h_fish[id_mom] : null;
			var dad = h_fish[id_dad] ? h_fish[id_dad] : null;

			if(mom) {
				mom.origin = fish.mom_origin;
				mom.sex = "F"
				mom.juve_kids += fish.fl < 300 ? 1 : 0
				h_moms[id_mom] = mom;		// put mom fish obj into mom hash
				h_prnts[id_mom] = mom;		// put mom fish obj into all-parents hash
				if(dad) {
					mom.mates[id_dad] = dad;		// add dad to the mom's mate hash
					mom.kids_w_known_mates += 1;	// this mom has one more kid with a known mate
				}
				else {
					mom.kids_w_uc_mates += 1;		// this mom has one more kid with an unknown mate
				}
			}
			if(dad) {
				dad.origin = fish.dad_origin;
				dad.sex = "M"
				dad.juve_kids += fish.fl < 300 ? 1 : 0
				h_dads[id_dad] = dad;		// put dad fish obj into dad hash
				h_prnts[id_dad] = dad;		// put mom fish obj into all-parents hash
				if(mom) {
					dad.mates[id_mom] = mom;		// add mom to the dad's mate hash
					dad.kids_w_known_mates += 1;	// this dad has one more kid with a known mate
				}
				else {
					dad.kids_w_uc_mates += 1;		// this dad has one more kid with an unknown mate
				}
			}
		}


		var hdrs = "NWFSC#;Year of return;Date;Julian Date;Sex;Origin;Length (mm);# Offspring w/Known Mates;# Mates;# Offspring with UC Mates;# Offspring total (w/ singles)".split(";");


		var juve_rows = [];
		var adlt_rows = [];
		for(var k in h_prnts) {
			var prnt = h_prnts[k];

			// count up the unique mates for this parent
			for(var k2 in prnt.mates) { prnt.num_mates += 1; }

			prnt.kids_total = prnt.kids_w_known_mates + prnt.kids_w_uc_mates;

			// count # of moms and dads
			if(prnt.sex == "F") { num_moms += 1; } else { num_dads += 1; };

			num_prnts += 1;
		}
		out("Unique parents: "+num_prnts+" ("+num_moms+" dams, "+num_dads+" sires)");

		for(var k in h_fish) {
			var fish = h_fish[k];		// get the fish obj out of hash
			if(fish.juve_kids > 0) { juve_rows.push(fish); } else  { adlt_rows.push(fish); };
		}


		juve_rows.sort(function(a, b) { if(a.nwfsc < b.nwfsc) return -1; if(a.nwfsc > b.nwfsc) return 1; return 0; });
		adlt_rows.sort(function(a, b) { if(a.nwfsc < b.nwfsc) return -1; if(a.nwfsc > b.nwfsc) return 1; return 0; });

		var dl = function(prnts) {
			var a = [hdrs];
			prnts.forEach(function(prnt) {
				a.push([
					prnt.nwfsc,
					prnt.year_of_return,
					prnt.date,
					prnt.julian_date,
					prnt.sex,
					prnt.origin,
					prnt.length,
					prnt.kids_w_known_mates,
					prnt.num_mates,
					prnt.kids_w_uc_mates,
					prnt.kids_total,
				]);
			});
			downloadURI(encodeURI("data:text/csv;charset=utf-8,"+CSV.to_string(a)), "newfile.csv");
		}

		dl(juve_rows);
		//dl(adlt_rows);
		



		/*
		out("Parents found: "+num_prnts+" ("+num_moms+" dams, "+num_dads+" sires)");

		var h_prnt_juve {};
		var h_prnt_adult = {};

		for(var k in h_fish) {
			var fish = h_fish[k];
			var mom = h_fish[fish.mom];
			if(mom) {
				h_moms[fish.mom] = mom;
				if(fish.adult) {
				}
			}
			else {
				warn("Dam "+k+" not found in offspring hash");
			}
		}



		dl_csv = [
			["foo", 3, "bar", 7],
			["foo", 7, "bar", 3],
		];

		downloadURI(encodeURI("data:text/csv;charset=utf-8,"+CSV.to_string(dl_csv)), "newfile.csv");
		*/

	});


});

out("The Salmonalysis&trade; Mark I is ready.");

