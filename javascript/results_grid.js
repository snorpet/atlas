dojo.addOnLoad(function(){
	dojo.require("dojox.grid.EnhancedGrid");
	dojo.require("dojox.grid.enhanced.plugins.Pagination");
	dojo.require("dojo.data.ItemFileWriteStore");
	dojo.require("dojox.grid.enhanced.plugins.Filter");
});

var results_id = "resultsGrid";
var filter_id = "filterGrid";
var expand_all = true;

function cleanHeader(header){
	var newHeader = "";
	if(header.indexOf("Totals") == 1)
		header = header.substring(1, header.length);
	else if(hasUpperCase(header)){
		var upperLetters = findUpperCaseLetters(header);
		var concat = header;
		for(var c=0;c<upperLetters.length;c++){
			if(upperLetters[c] != 0){
				if(upperLetters[c+1]){
					upperLetters[c+1] = upperLetters[c+1] + 1;
				}
				concat = concat.substring(0, upperLetters[c]) + "_" + concat.substring(upperLetters[c], concat.length);	
			}
		}
		header = concat;
	}
		
	newHeader = header.replace("$", " - ").toUpperCase().replace("_CD", "_CODE").replace("_RCPT", "_RECEIPT").split("_").join(" ");
	
	return newHeader;		
}

function calculateWidth(header, num){
	var width = header.length * num;
	return width;
}

function toggle(inIndex, inShow, grid) {
	var gridNode = dijit.byNode(grid);
	gridNode.expandedRows[inIndex] = inShow;
	gridNode.updateRow(inIndex);
}

function addLinks(value, inRowIndex, inItem){
 /*console.log(value); console.log(inRowIndex); console.log(inItem);*/

  if(typeof value != "undefined")
	return '<span class="pointer value-pop" onclick="filterResults(\'' + value + '\', \'' + inItem.field + '\')" >' + value + '</span>';
  else
    return value;
}

function filterResults(value, columnName){
	
	var grid = dijit.byId(results_id);
	var gridStructure = grid.structure[0].cells[0];  
	var nameConversion = columnName.substr(0, columnName.length - 1);
	var colIndex = -1;
	var lastIndex = grid.layout.cells.length - 1; //lastIndex represents the index of the details column

	dojo.some(grid.layout.cells, function(cell,idx) {
		if(cell.field.toLowerCase().indexOf(nameConversion.toLowerCase()) != -1 || nameConversion.toLowerCase().indexOf(cell.field.toLowerCase()) != -1){
			colIndex = idx;
			return true;
		}
		else if (cell.field == "Filing_Details") {
			colIndex = idx;
			return true; 
		}
	});

	
	if (value != "" && colIndex != lastIndex) {
		//set filter to "equalTo" on column if a value exists and it is not the Details column
		grid.setFilter([{type: 'string', condition: 'equalTo', column: colIndex, value: ''+ value +''}]);
	} 
	else if (value != "" && colIndex == lastIndex) {
		//set filter to "contains" on the column if a value exists and it is the Details column	
		grid.setFilter([{type: 'string', condition: 'contains', column: colIndex, value: ''+ value +''}]);
	} 
	else {
		// Clear grid filter when there is no value
		var clearFilter = "";
		grid.setFilter([{type: 'string', condition: 'contains', column: colIndex, value: ''+ clearFilter +''}]);
	}
}

function jsonHandler(results){
	var records = results;
	// Handle a single record.  Turn 'undefined' into '1'.
	var record_length = records.length;
	//console.log(results);
	if (record_length == undefined) {
		record_length = 1;
	} else {
		record_length = records.length;
	}	

	/*There are 3 sets of Headers needed. The first set is the "origHeaders" which allows for preset headers and compiling the remaining headers. These are used to determine data placement for the rows. */
	var origHeaders = ["Toggle"];
	var commentHeader = "";
	for (var i=0, total=record_length; i < total; i++) { //loop through documents(rows) to get headers

		records[i]["Toggle"] = "";

		var headerRow = records[i];

		//console.log("header row: "  + headerRow);
		for (var key in headerRow) {
		   if (headerRow.hasOwnProperty(key)) {
		      var objkey = key;
		      //console.log("header to push: " + objkey);
			   if(objkey == "text" || objkey == "Filing_Comment")
					commentHeader = objkey;
		       else if(isInArray(objkey, origHeaders) == false && objkey.indexOf('_') != 0 && objkey.indexOf('_sort') == -1 
			    && objkey.indexOf("score") == -1 && objkey != "viewingStatus" && objkey != "deleted")
					origHeaders.push(objkey);
		   }
		}
	}
	origHeaders.push(commentHeader);
	//console.log(origHeaders);
	
	/*Second is "cleanHeaders" which are the "pretty" headers passed to the detailed view used for displaying. Lastly, "resultWidthHeaders" used in the results table layout and determine width of columns*/
	var cleanHeaders = [], filterWidthHeaders = [], resultWidthHeaders = [], cellSet1 = [], cellSet2 = [], fieldSet = [];
	
	for(var item in origHeaders) {
	    var clean_header = cleanHeader(origHeaders[item]);	
		if(isInArray(clean_header, cleanHeaders) == false )
		{
			//calculating secondary set of fields
			var calc_width = "";
			cleanHeaders.push(clean_header);
			if(clean_header == "FILE")
				calc_width = calculateWidth(clean_header, 100)  + "px";
			else if(clean_header == "LAWFIRM NAME"  || clean_header == "CITY" || clean_header.indexOf("STATE CODE") != -1)
				calc_width = calculateWidth(clean_header, 25) + "px";
			else if(clean_header == "COMMENT PERIOD")
				calc_width = calculateWidth(clean_header, 16) + "px";
			else if(clean_header == "TOGGLE")
				calc_width = calculateWidth(clean_header, 5) + "px";
			else
				calc_width = 'auto';
				
			if(clean_header == "TOGGLE")
				cellSet1.push({ name: "*", field:origHeaders[item], width: calc_width, headerClasses: ["staticHeader"], styles: "text-align: center; font-size:1.5em;font-weight:bold;", get: getCheck, formatter: formatCheck});
			else if(clean_header.indexOf("PROCEEDING") != -1 || clean_header == "NAME OF FILER" || clean_header == "APPLICANT" || clean_header.indexOf("STATE CODE") != -1 || clean_header.indexOf("DATE RECEI") != -1
			|| clean_header == "FILING TYPE" || clean_header == "SUBMISSION TYPE" || clean_header == "PAGES" || clean_header.indexOf("BRIEF") != -1)
				cellSet1.push({ name: clean_header, field:origHeaders[item], width: "auto"});
			else
				fieldSet.push(origHeaders[item]);
		}
	}

	resultWidthHeaders[0] = {onBeforeRow : function(inDataIndex, inSubRows){
							//hide subrow if there is no grid, there are no expanded rows, or it is not expanded
							inSubRows[1].hidden = (!this.grid || !this.grid.expandedRows || !this.grid.expandedRows[inDataIndex]);

                        }};
	resultWidthHeaders[0]["cells"] = [cellSet1];
	cellSet2.push({ name: "DETAILS", field:"Filing_Details", fields:fieldSet, width: calc_width, colSpan : cellSet1.length, headerClasses: ["staticHeader"], filterable: true, formatter: formatDetail});
	resultWidthHeaders[0]["cells"].push(cellSet2);

	/*Now set the data for each row*/
	var setResultsRows = [], setFilterRows = [], proceedings = [], proceeding_check = [], filingTypes = [], filing_check = [],
		states = [], state_check = [], briefComment = [], brief_check = [];

	for (var i=0, total=record_length; i < total; i++) {
		var row = records[i];
		var link = {};
		
		for(key in origHeaders) {
			var value = row[origHeaders[key]];
			
			if(typeof value == "undefined")
				value = "";
				
			//get filter counts
			if(origHeaders[key].toLowerCase().indexOf("proceeding") != -1){
				if(isInArray(value, proceeding_check) == false){
					proceeding_check.push(value);
				    proceedings.push({"Proceedings": value, "PTotals" : 1});
				}	
				else{
					$.map(proceedings, function(object, key) {
							if(object.Proceedings == value)
								object.PTotals = parseInt(object.PTotals) + 1;
					});
				}
			}
			else if(origHeaders[key].toLowerCase() == "filing_type" || origHeaders[key].toLowerCase() == "submissiontype"){				
				if(isInArray(value, filing_check) == false){
					filing_check.push(value);
				    filingTypes.push({"Submissions": value, "FTotals" : 1});
				}	
				else{
					$.map(filingTypes, function(object, key) {
							if(object.Submissions == value)
								object.FTotals = parseInt(object.FTotals) + 1;
					});
				}
			}//do not count fields where state is blank
			else if(origHeaders[key].toLowerCase().indexOf("statecd") != -1 && value != ""){				
				if(isInArray(value, state_check) == false){
					state_check.push(value);
				    states.push({"States": value, "STotals" : 1});
				}	
				else{
					$.map(states, function(object, key) {
							if(object.States == value)
								object.STotals = parseInt(object.STotals) + 1;
					});
				}
			}
			else if(origHeaders[key].toLowerCase().indexOf("brief") != -1){
				if(isInArray(value, brief_check) == false){
					brief_check.push(value);
				    briefComment.push({"briefComment": value, "BTotals" : 1});
				}	
				else{
					$.map(briefComment, function(object, key) {
							if(object.briefComment == value)
								object.BTotals = parseInt(object.BTotals) + 1;
					});
				}
			}
			
		
			var _array = getStringArray(value);
			if(_array.length > 1 && _array.length < 3){//for date range variables change [12-20-2012, 12-22-2013] to a string: 12-20-2012 to 12-22-2013
				for(var j=0; j < _array.length; j++){
					var new_value = _array[j];
					if(j == 0)
						link[origHeaders[key]] = new_value;
					else if(j > 0 && new_value != "")
						link[origHeaders[key]] += " to " + new_value;
				}
			}	
			else
				link[origHeaders[key]] = value;
		}
		
		setResultsRows.push(link); 	
	}

	proceedings.sort(sortByProperty("PTotals")).reverse();
	filingTypes.sort(sortByProperty("FTotals")).reverse();
	states.sort(sortByProperty("STotals")).reverse();
	briefComment.sort(sortByProperty("BTotals")).reverse();
	//Gather the top 3 highest counts of each object set
	for (var k=0; k < 3; k++) {
		var gather_rows = {};

		for (proc in proceedings[k]){
			gather_rows[proc] = proceedings[k][proc];
			if(k == 0){
				if(proc.indexOf("Totals") != -1)
					filterWidthHeaders.push({ name: cleanHeader(proc), field:proc, width: "60px", noresize: true});
				else
					filterWidthHeaders.push({ name: cleanHeader(proc), field:proc, width: "90px", formatter: addLinks, noresize: true});
			}
		}
		for (type in filingTypes[k]){
			gather_rows[type] = filingTypes[k][type];
			if(k == 0){
				if(type.indexOf("Totals") != -1)
					filterWidthHeaders.push({ name: cleanHeader(type), field:type, width: "60px", noresize: true});
				else
					filterWidthHeaders.push({ name: cleanHeader(type), field:type, width: calculateWidth(type, 9) + "px", formatter: addLinks, noresize: true});
			
			}
		}
		for (state in states[k]){
			gather_rows[state] = states[k][state];
			if(k == 0){
				if(state.indexOf("Totals") != -1)
					filterWidthHeaders.push({ name: cleanHeader(state), field:state, width: "60px", noresize: true});
				else
					filterWidthHeaders.push({ name: cleanHeader(state), field:state, width: calculateWidth(state, 12) + "px", formatter: addLinks, noresize: true});
			}

		}
		for (brief in briefComment[k]){
			gather_rows[brief] = briefComment[k][brief];
			if(k == 0){
				if(brief.indexOf("Totals") != -1)
					filterWidthHeaders.push({ name: cleanHeader(brief), field:brief, width: "60px", noresize: true});
				else
					filterWidthHeaders.push({ name: cleanHeader(brief), field:brief, width: calculateWidth(brief, 9) + "px", formatter: addLinks, noresize: true});
			}
		}
		
		setFilterRows.push(gather_rows);
	}

	buildGrid(resultWidthHeaders, setResultsRows, results_id, results_id + "Div", "results");
	buildGrid(filterWidthHeaders, setFilterRows, filter_id, filter_id + "Div", "filter");

	function buildGrid(headers, rows, grid_id, placement_div, grid_type){
		/*Start building the results viewer table*/
		var results_data = {
		  identifier: 'id',
		  items: []
		};
		
		for(var i=0; i<rows.length; i++){
		  results_data.items.push(dojo.mixin({ id: i+1 }, rows[i]));
		}

		var store = new dojo.data.ItemFileReadStore({data: results_data});
		var layout = headers;
		var registered_grid = dijit.registry.byId(grid_id);
		var paging_rules = {}, filter_rules = {}, results_plugins ={}, header_click = "", auto_width = true;
		
		if(grid_type == "results"){
			paging_rules = {id: "paginator", pageSizes: ["100", "300", "600", "1000"], description: true, 	defaultPageSize:20, sizeSwitch: true,pageStepper: true, gotoButton: true, maxPageStep: 5, 	position: "bottom"};
			filter_rules = {closeFilterbarButton: true, itemsName: "records", ruleCount: 4,ruleCountToConfirmClearFilter: 3};
			results_plugins = {filter: filter_rules, pagination: paging_rules};
			auto_width = false;
		}

		if(registered_grid == undefined){	
			/*create a new grid*/
			var grid = new dojox.grid.EnhancedGrid({
				id: grid_id,
				store: store,
				structure: layout,
				selectable: true,
				clientSort : true,
				rowSelector: '10px',
				selectionMode: 'single',
				autoHeight: true,
				autoWidth: auto_width,
				plugins: results_plugins,
				canSort: function(col) { return col != 0}
			}, document.createElement('div'));

			dojo.connect(grid, "onHeaderCellClick", grid, function(e){
				if(e.cell.index == 0){
					if(expand_all == true){
						var rows_to_alter = [];
						this.store.fetch({
							 onComplete: function (items) {
								 dojo.forEach(items, function (item, index) {
										rows_to_alter[index] = true;
								 })
							 }
						});
						
						this.expandedRows = rows_to_alter;
						expand_all = false;
					}
					else{
						this.expandedRows = [];
						expand_all = true;
					}
					
					this.updateRows(0, this.getTotalRowCount() - 1);	
				}

			});
		
			/*Append grid and call startup() to render the grid*/
			grid.placeAt(placement_div);
			grid.startup();

		}
		else
		{
			//if grid has already been created, just replace the layout and store. 
			var grid = dijit.byId(grid_id);
			grid.setStructure(layout);
			grid.setStore(store);
			grid.placeAt(placement_div);
			grid.sort();

			var sourceName = "";
			if (sourceName != "") {
				grid.setFilter([{type: 'string', condition: 'equalTo', column: 0, value: ''+ sourceName +''}]);
			}
			grid.startup();
		}
		
		/*finished building the results table*/
	}
	
	function formatDetail(value, inRowIndex){
		//every other index, display formatted data in the results table
		var fields = this._props.fields;
		var value_length = Object.keys(value).length;
		var counter = 0;
		var html = "<div id='criteria_input' style='width:100%; margin:2px;'>";
		$.each(value, function( index, val ){

			if(fields[counter] == "text" ||  fields[counter] == "Filing_Comment"){
				html += createColumns(cleanHeader(fields[counter]), val, "left", false, true);
			}
			else{
				if(counter % 2 == 0){
					if( counter == value_length - 1)//if last row, make the entire row one column
						html += createColumns(cleanHeader(fields[counter]), val, "left", true, true);
					else 
						html += createColumns(cleanHeader(fields[counter]), val, "left", true, false);
				}
				else
					html += createColumns(cleanHeader(fields[counter]), val, "right", true, true);
			}
			counter ++;
		});
		
		html += "</div>";
		return html;
	}
	
	function getCheck(inRowIndex) {
		if (!this.grid.expandedRows)
			this.grid.expandedRows = [ ];
			
			return {image: (this.grid.expandedRows[inRowIndex] ? 'open.gif' : 'closed.gif'),
					show: (this.grid.expandedRows[inRowIndex] ? 'false' : 'true')};
	}
	
	function formatCheck(value, inRowIndex){
		return html = '<img src="images/' + value.image + '" onclick="toggle(' + inRowIndex + ', ' + value.show +  ', ' + results_id + ');" height="11" width="11"/>';
	}
	
	function createColumns (label, value, placement, split_row, complete_row){
		var html = "";
		
		if(label.indexOf("LINK") != -1 && value.indexOf("http") == 0)
			value = "<a href='" + value + "' class='value-cool'>" + value + "</a>";

		if (placement == "left")
			html += "<div class='row'>";
		
		if(split_row == true)
			html += "<div class='cell two_halves " + placement + "'><p>" + label + " : <span class='value-cool'>" + value + "</span></p></div>";
		else
			html += "<div class='cell " + placement + "'><p>" + label + " : <span class='value-cool'>" + value + "</span></p></div>";
		
		if(placement == "right"  || complete_row == true)
			html += "</div>";

		return html;
	}
}

