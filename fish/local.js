



function search( frag ) {

	$("[name=found]").hide();
	$("[name=search]").show();

	let data = { user: "scientist", pass: "SybJKzvVydbFThvD", dbname: "science" };
	data.sql = "select * from fish where nwfsc like ? order by nwfsc";
	data.args = ["%"+frag+"%"];
	obj = { data: JSON.stringify(data) };
	url = "https://sleepless.com/api/v1/sleepless/db/mysql";
	$.get( url, obj, (r)=>{
		if(r.error) { alert(r.error); return; }
		replicate("tpl_search_result", r.records, (e, fish, i)=>{
			e.onclick = function() {

				replicate("tpl_details", [fish]);
				$("div.edit").dialog({
					title: "A Fish Called "+fish.nwfsc,
					modal: true,
					buttons: [
						{ text: "Cancel", click: function() { $(this).dialog("close"); }, },
						{
							text: "Save",
							click: function() {
								save(fish, function() {
									$(this).dialog("close");
									reload();
								});
							},
						},
					],
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

	forms.search.onsubmit = function() {
		let frag = this.elements.frag.value;
		document.location = "?search_frag="+frag;
		return false;
	};

	forms.edit.elements.cancel.onclick = ()=>{
		$("[name=edit]").hide();
	};

	let qd = getQueryData();
	search(qd.search_frag || "");

});
