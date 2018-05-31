


let sticky_msg = null;


function db(sql, args, cb) {
	$(".busy").show();
	let data = { user: "scientist", pass: "SybJKzvVydbFThvD", dbname: "science", sql: sql, args: args };
	obj = { data: JSON.stringify(data) };
	url = "https://sleepless.com/api/v1/sleepless/db/mysql";
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
			e.onclick = function() {
				
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
		});
		$("[name=found]").show();
		$("[name=search]").show();
	});

	return false;
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
