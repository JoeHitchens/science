
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
	alert(s+"<br>FAILED");
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


		var offspring = {};
		var num_offspring = 0;
		var num_juvenile = 0;
		var num_adult = 0;

		for(var i = 1; i < csv.length; i++) {		// skip first row (headings)
			var row = csv[i];

			var nwfsc = row[cols.nwfsc.cnum];
			var o = offspring[nwfsc];
			if(!o) {
				o = {
					fl: 0,
				}
				offspring[nwfsc] = o;
				num_offspring += 1;
			}

			var fl = row[cols.fl.cnum];
			if(o.fl == 0) {
				o.fl = fl;
			}
			else {
				if(o.fl != fl) {
					out(nwfsc+": differing value for FL (first found "+o.fl+", also found "+fl+")");
				}
			}
			if(o.fl < 300) {
				o.adult = false;
				num_juvenile += 1;
			}
			else {
				o.adult = true;
				num_adult += 1;
			}


		}

		out("Unique NWFSC#'s found: "+num_offspring+" ("+num_juvenile+" juvenile, "+num_adult+" adult)");

	});


});

out("The Salmonalysis&trade; Mark I is ready.");

