


let sticky_msg = null;


function db(sql, args, cb) {
	$(".busy").show();
	let data = { user: "scientist", pass: "SybJKzvVydbFThvD", dbname: "science", sql: sql, args: args };
	obj = { data: JSON.stringify(data) };
	url = "https://sleepless.com/api/v1/db/mysql";
	$.get(url, obj, (r)=>{
		$(".busy").hide();
		cb(r);
	});
}


function save(fish, cb) {
	log("saving");

	let form = document.forms.edit;

	let args = [];
	let f = [];
	for(var i = 0; i < form.length; i++) {
		let el = form[i];
		f.push(el.name+"=?");
		//args.push(el.name);
		args.push(el.value);
	}

	let sql = "update fish set "+f+" where nwfsc=? limit 1";
	args.push(fish.nwfsc);

	log(sql+"\n"+args);
	db(sql, args, (r)=>{
		sticky_msg = null;
		cb();
	});
}


function search( frag ) {

	$("[name=found]").hide();
	$("[name=search]").show();

	let el = document.forms.search.elements.frag;
	el.value = frag;
	$(el).focus();

	if(!frag) {
		return;
	}

	let sql = "select * from fish where nwfsc like ? order by nwfsc";
	let args = ["%"+frag+"%"];
	db(sql, args, (r)=>{
		if(r.error) { alert(r.error); return; }
		replicate("tpl_search_result", r.records, (e, fish, i)=>{
			$(e).click( function(evt) {
				
				if(evt.target.tagName != "A") {
					
					replicate("tpl_details", [fish]);
					document.forms.edit.onchange = ()=>{
						log("modified");
						sticky_msg = "Unsaved changes.";
						$(".save_btn").addClass("accent");
					};

					$("div.page[name=edit]").dialog({
						title: "A Fish Called "+fish.nwfsc,
						modal: true,
						width: "auto",
						buttons: [
							{
								class: "save_btn",
								text: "Save",
								click: function() {
									let dlg = this;
									save(fish, function() {
										$(dlg).dialog("close");
										reload();
									});
								},
							},
						],
						beforeClose: (evt, ui)=>{
							log(sticky_msg);
							if(sticky_msg) {
								if(!confirm(sticky_msg)) {
									return false;
								}
							}
							return true;
						},
						open: (evt, ui)=>{
							$(".save_btn").removeClass("accent");
						},
					});
				}
			})
		});
		$("[name=found]").show();
		$("[name=search]").show();
	});

	return false;

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


function download_parentage() {
	
	let e_out = getEl("out");

	e_out.html("");

	let out = function(s) {
		var d = document.createElement("div");
		d.innerHTML = s;
		e_out.appendChild(d);
	}

	db("select * from fish limit 20000", [], (r)=>{
		if(r.error) { alert(r.error); return; }

		let recs = r.records;
		out("Fish in database: "+recs.length);

		let aoa = [];
		aoa.push([
			"nwfsc",
			" offspring",
			" offspring w/known mates",
			" distinct known mates",
			" adlt offspring w/known mates",
			" adlt offspring w/unknown mates",
			" juve offspring w/known mates",
			" juve offspring w/unknown mates",
		]);

		let last_p = 0;
		let ln = 0;
		recs.forEach((fish) => {

			ln += 1;

			fish.num_kids = 0;
			fish.num_kids_known_mates = 0;
			fish.distinct_known_mates = 0;
			fish.num_adlt_kids_known_mates = 0;
			fish.num_adlt_kids_unknown_mates = 0;
			fish.num_juve_kids_known_mates = 0;
			fish.num_juve_kids_unknown_mates = 0;

			let known_mates_hash = {};

			recs.forEach( (kid) => {

				let juve = kid.fork_length < 300;

				if(fish.sex == "M") {
					// fish is male 
					if(kid.sire == fish.nwfsc) {
						// is fish's kid
						fish.num_kids += 1;		// increment total # of offspring for fish
						if(kid.dam) {
							// mate known
							known_mates_hash[kid.dam] = true;
							fish.num_kids_known_mates += 1;	// incr # of offspring w/known mates
							if(juve) {
								fish.num_juve_kids_known_mates += 1;	// inc # of juve kids w/known mates
							}
							else {
								fish.num_adlt_kids_known_mates += 1;	// inc # of adult kids w/known mates
							}
						}
						else {
							// mate unknown
							fish.num_kids_unknown_mates += 1;	// incr # of offspring w/unknown mates
							if(juve) {
								fish.num_juve_kids_unknown_mates += 1;	// inc # of juve kids w/known mates
							}
							else {
								fish.num_adlt_kids_unknown_mates += 1;	// inc # of adult kids w/known mates
							}
						}
					}
					else {
						// not fish's kid
					}
				}
				else {
					// fish is female 
					if(kid.dam == fish.nwfsc) {
						// is fish's kid
						fish.num_kids += 1;		// increment total # of offspring for fish
						if(kid.sire) {
							// mate known
							known_mates_hash[kid.sire] = true;
							fish.num_kids_known_mates += 1;	// incr # of offspring w/known mates
							if(juve) {
								fish.num_juve_kids_known_mates += 1;	// inc # of juve kids w/known mates
							}
							else {
								fish.num_adlt_kids_known_mates += 1;	// inc # of adult kids w/known mates
							}
						}
						else {
							// mate unknown
							fish.num_kids_unknown_mates += 1;	// incr # of offspring w/unknown mates
							if(juve) {
								fish.num_juve_kids_unknown_mates += 1;	// inc # of juve kids w/unknown mates
							}
							else {
								fish.num_adlt_kids_unknown_mates += 1;	// inc # of adult kids w/unknown mates
							}
						}
					}
					else {
						// not fish's kid
					}
				}

			})

			// count up the distinct known mates
			fish.distinct_known_mates = 0;
			for(var k in known_mates_hash) {
				fish.distinct_known_mates += 1;
			}


			aoa.push([
				fish.nwfsc,
				fish.num_kids,
				fish.num_kids_known_mates,
				fish.distinct_known_mates,
				fish.num_adlt_kids_known_mates,
				fish.num_adlt_kids_unknown_mates,
				fish.num_juve_kids_known_mates,
				fish.num_juve_kids_unknown_mates,
			]);

			let p = Math.round((ln * 10) / recs.length);
			if(p != last_p) {
				last_p = p;
				out(""+p+"0%");
			}

		});

		out("Downloading 'parentage.csv'");

		downloadURI(encodeURI("data:text/csv;charset=utf-8,"+CSV.to_string(aoa)), "parentage.csv");

	});
}



$(document).ready(()=>{

	replicate("tpl_search_result", []);

	let forms = document.forms;
	let f_search = forms.search;
	let f_edit = forms.edit;

	f_search.onsubmit = function() {
		let frag = this.elements.frag.value;
		document.location = "?search_frag="+frag;
		return false;
	};

	f_edit.onsubmit = function() {
		return false;
	};

	let qd = getQueryData();
	search(qd.search_frag || "");

	window.onbeforeunload = ()=>{ return sticky_msg };
});
