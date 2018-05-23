


$(document).ready(()=>{

	replicate("tpl_search_result", []);

	$("[name=found]").hide();
	$("[name=search]").show();


	let forms = document.forms;

	forms.search.onsubmit = function() {

		let frag = this.elements.frag.value;

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
					$("[name=edit]").show();
				}
			});
			$("[name=found]").show();
			$("[name=search]").show();
		});

		return false;
	};

	forms.edit.elements.cancel.onclick = ()=>{
		$("[name=edit]").hide();
	};




});
