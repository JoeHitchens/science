
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
	return s.trim().match( /^\d{5}-\d{4}$/ ) ? s : ""
}

// If 's' contains nothing but letters, then return them, otherwise return empty string.
fix_origin = function(s) {
	return s.trim().match( /^[a-zA-Z]+$/i ) ? s : ""
}

FDrop.attach(drop_target, function(files) {

	// file was dropped onto page.
	var file = files[0];		// get the first file object (if you drop 2 or more, all but first are ignored)
	if(!file) { return; };

	var fname = file.name;		// name of the file
	if(!fname.match( /\.csv$/i )) { return abort("I can only eat CSV files."); };

	var fname = file.name.replace(/\.csv$/i, "").toId();	// remove the .csv from end of file name

	// convert the file object to actual data
	to_text(file, function(txt) {
		var csv = CSV.from_string(txt);		// convert the file contents to an array (rows) of arrays (columns)

		out("Loaded \""+file.name+"\".");
		out("File contains "+csv.length+" lines.");
		if(csv.length < 2) { return abort("Less then 2 lines?  Seems a little short doesn't it?"); }

		// look for certain labels in the first row of the csv and note their positions, keyed by label, in the 'cols' hash.
		var cols = {};
		"NWFSC;broodyear;FL;DateCaptured;Dam;Sire;DamOrigin;SireOrigin".split(";").forEach(function(h) {
			var hrow = csv[0];
			for(var i = 0; i < hrow.length; i++) {
				if(hrow[i].lcase() == h.lcase()) {
					cols[h.toId()] = {
						cnum: i,
					};
				}
			}
		});
		// cols looks like, { "NWFSC#" : 1, ... }


		var skipped_lines = 0;	// count of lines that were ignored
		var h_fish = {};		// hash of objects, one per fish found in input
		var num_fish = 0;		// count of fish objects that are in h_fish
		var num_juve = 0;
		var num_adlt = 0;

		// loop through each line in the csv starting with the 2nd (just pass header line)
		for(var i = 1; i < csv.length; i++) {
			var row = csv[i];

			var nwfsc = row[cols.nwfsc.cnum];	// get NWFSC# (universally unique fish identifier?)
			// skip the rows if there's not a valid nwfsc # on it.
			if(!fix_nwfsc(nwfsc)) { skipped_lines += 1; continue; }
			// number appears kosher

			var fish = h_fish[nwfsc];			// get fish obj from hash
			if(!fish) {
				// First time we've seen this fish (nwfsc #), so
				// create new fish object with this #.
				var x_y = 0;
				var dcap = row[cols.datecaptured.cnum];
				if(dcap == ".") {
					dcap = "";
				}
				if(!dcap.match(/^\d+$/)) {
					if(dcap) {
						log(dcap);
						dcap = ts2dt(us2ts(row[cols.datecaptured.cnum])).getFullYear();
					}
				}
				fish = {
					// set these fields from input
					line: i,		// line # in csv file where we first saw this # in the NWFSC# column
					nwfsc: nwfsc,
					brood_year: toInt(row[cols.broodyear.cnum]),			// contents of the "Brood Year" column as an integer
					fl: row[cols.fl.cnum],									// fish length?
					date_of_capture: dcap, //us2ts(row[cols.datecaptured.cnum]),	// a unix timestamp or 0 if date can't be parsed
					//pp: row[cols.pp.cnum],									// what is PP again?
					mom: fix_nwfsc(row[cols.dam.cnum]),
					dad: fix_nwfsc(row[cols.sire.cnum]),
					mom_origin: fix_origin(row[cols.damorigin.cnum]),
					dad_origin: fix_origin(row[cols.sireorigin.cnum]),
					// these fields to output
					//year_of_return: row[cols.datecaptured.cnum] ? ts2dt(us2ts(row[cols.datecaptured.cnum])).getFullYear() : "",
					year_of_return: dcap,
					date: "",
					julian_date: 0,
					sex: "",
					origin: "",
					length: row[cols.fl.cnum],
					num_mates: 0,
					juve_kids_w_known_mates: 0,
					juve_kids_w_uc_mates: 0,
					juve_kids_total: 0,
					adlt_kids_w_known_mates: 0,
					adlt_kids_w_uc_mates: 0,
					adlt_kids_total: 0,
					// for internal use
					juve_kids: 0,		// # of juvenile offspring
					adlt_kids: 0,		// # of adult offspring
					mates: {},
					num_mates: 0,
				}

				h_fish[nwfsc] = fish;			// put the object into the hash
				num_fish += 1;					// increment the # of fish found

				// increment counts for juvenile or adult based on the fishes FL #.
				if(fish.fl < 300) {
					num_juve += 1;
				} else {
					num_adlt += 1;
				}
			}
			else {
				warn("Found NWFSC# "+nwfsc+" on both lines "+fish.line+" and "+i);
			}
		}

		var h_moms = {};		// hash of moms
		var num_moms = 0;
		var h_dads = {};		// hash of dads
		var num_dads = 0;
		var h_prnts = {};		// hash of both moms and dads
		var num_prnts = 0;
		var num_year_mismatches = 0;


		out("Skipped "+skipped_lines+" lines.");
		out("Found "+num_fish+" unique fish ("+num_juve+" juvenile, "+num_adlt+" adult)");


		// walk through the fish hash
		for(var k in h_fish) {

			var fish = h_fish[k];		// get the fish obj out of hash

			var id_mom = fish.mom;		// get NWFSC# for mom
			var id_dad = fish.dad;		// get NWFSC# for dad

			if(!fix_nwfsc(id_mom) && !fix_nwfsc(id_dad)) {
				continue;
			}

			var mom = null;
			if(fix_nwfsc(id_mom)) {
				var mom = h_fish[id_mom];
				if(!mom) {
					mom = {
						nwfsc: id_mom,
						fl: 0,
						year_of_return: 0,
						date: "",
						julian_date: 0,
						length: 0,
						num_mates: 0,
						juve_kids_w_known_mates: 0,
						juve_kids_w_uc_mates: 0,
						juve_kids_total: 0,
						adlt_kids_w_known_mates: 0,
						adlt_kids_w_uc_mates: 0,
						adlt_kids_total: 0,
						juve_kids: 0,		// # of juvenile offspring
						adlt_kids: 0,		// # of adult offspring
						mates: {},
						num_mates: 0,
					}
					h_fish[id_mom] = mom;
				}
				else {
					if(mom.year_of_return != fish.brood_year) {
						if(!mom.year_of_return) {
							warn("Line: "+mom.line+": No year of return");
						}
						else {
							warn("Lines "+fish.line+" v. "+mom.line+": Fish brood-year vs Dam year-of-return mismatch: "+fish.brood_year+" - "+mom.year_of_return);
						}
						num_year_mismatches += 1;
					}
				}
			}

			var dad = null;
			if(fix_nwfsc(id_dad)) {
				var dad = h_fish[id_dad];
				if(!dad) {
					dad = {
						nwfsc: id_dad,
						fl: 0,
						year_of_return: 0,
						date: "",
						julian_date: 0,
						length: 0,
						num_mates: 0,
						juve_kids_w_known_mates: 0,
						juve_kids_w_uc_mates: 0,
						juve_kids_total: 0,
						adlt_kids_w_known_mates: 0,
						adlt_kids_w_uc_mates: 0,
						adlt_kids_total: 0,
						juve_kids: 0,		// # of juvenile offspring
						adlt_kids: 0,		// # of adult offspring
						mates: {},
						num_mates: 0,
					}
					h_fish[id_dad] = dad;
				}
				else {
					if(dad.year_of_return != fish.brood_year) {
						if(!dad.year_of_return) {
							warn("Line: "+dad.line+": No year of return");
						}
						else {
							warn("Lines "+fish.line+" v. "+dad.line+": Fish brood-year vs Sire year-of-return mismatch: "+fish.brood_year+" - "+dad.year_of_return);
						}
						num_year_mismatches += 1;
					}
				}
			}

			if(fish.fl < 300) {

				if(mom) {
					mom.year_of_return = fish.brood_year;
					mom.origin = fish.mom_origin;		// XXX compare, except if not same
					mom.sex = "F";						// XXX compare, except if not right
					mom.juve_kids += fish.fl < 300 ? 1 : 0;
					mom.adlt_kids += fish.fl >= 300 ? 1 : 0;
					h_moms[id_mom] = mom;		// put mom fish obj into mom hash
					h_prnts[id_mom] = mom;		// put mom fish obj into all-parents hash
					if(dad) {
						mom.mates[id_dad] = dad;		// add dad to the mom's mate hash
						if(fish.fl < 300) {
							mom.juve_kids_w_known_mates += 1;	// this mom has one more juvenile offspring with a known mate
						}
						else {
							mom.adlt_kids_w_known_mates += 1;	// this mom has one more adult offspring with a known mate
						}
					}
					else {
						if(fish.fl < 300) {
							mom.juve_kids_w_uc_mates += 1;		// this mom has one more juvenile offspring with an unknown mate
						}
						else {
							mom.adlt_kids_w_uc_mates += 1;		// this mom has one more adult offspring with an unknown mate
						}
					}
				}

				if(dad) {
					dad.year_of_return = fish.brood_year;
					dad.origin = fish.dad_origin;		// XXX sanity check
					dad.sex = "M";		// XXX sanity check
					dad.juve_kids += fish.fl < 300 ? 1 : 0;
					dad.adlt_kids += fish.fl >= 300 ? 1 : 0;
					h_dads[id_dad] = dad;		// put dad fish obj into dad hash
					h_prnts[id_dad] = dad;		// put mom fish obj into all-parents hash
					if(mom) {
						dad.mates[id_mom] = mom;		// add mom to the dad's mate hash
						if(fish.fl < 300) {
							dad.juve_kids_w_known_mates += 1;	// this dad has one more juvenile offspring with a known mate
						}
						else {
							dad.adlt_kids_w_known_mates += 1;	// this dad has one more adult offspring with a known mate
						}
					}
					else {
						if(fish.fl < 300) {
							dad.juve_kids_w_uc_mates += 1;		// this dad has one more juvenile offspring with an unknown mate
						}
						else {
							dad.adlt_kids_w_uc_mates += 1;		// this dad has one more adult offspring with an unknown mate
						}
					}
				}
			}
		}
		out("Total year mismatches: "+num_year_mismatches);

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
			if(fish.juve_kids > 0) {
				juve_rows.push(fish);
			}
			if(fish.adlt_kids > 0) {
				adlt_rows.push(fish);
			}
		}

		juve_rows.sort(function(a, b) { if(a.nwfsc < b.nwfsc) return -1; if(a.nwfsc > b.nwfsc) return 1; return 0; });
		adlt_rows.sort(function(a, b) { if(a.nwfsc < b.nwfsc) return -1; if(a.nwfsc > b.nwfsc) return 1; return 0; });

		var dl = function(prnts, fname, j) {
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
					j ? prnt.juve_kids_w_known_mates : prnt.adlt_kids_w_known_mates,
					prnt.num_mates,
					j ? prnt.juve_kids_w_uc_mates : prnt.adlt_kids_w_uc_mates,
					j ? (prnt.juve_kids_w_known_mates + prnt.juve_kids_w_uc_mates) : (prnt.adlt_kids_w_known_mates + prnt.adlt_kids_w_uc_mates),
				]);
			});
			out("Downloading "+fname);
			downloadURI(encodeURI("data:text/csv;charset=utf-8,"+CSV.to_string(a)), fname);
		}

		setTimeout(function() {
			dl(juve_rows, "offspring-juvenile.csv", true);
		}, 500);

		setTimeout(function() {
			dl(adlt_rows, "offspring-adult.csv", false);
		}, 1000);

	});


});

out("The Salmonalysis&trade; Mark I is ready.");

