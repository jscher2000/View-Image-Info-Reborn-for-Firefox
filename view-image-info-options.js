/* 
  View Image Info Reborn - Options Page Script
  Copyright 2021. Jefferson "jscher2000" Scher. License: MPL-2.0.
  Script to apply defaults and save changes on the Options page
  version 1.0 - MVP
  version 1.1 - bug fix, tweaks and options for stand-alone viewing
  version 1.5 - add Last-Modified, window/tab options
  version 1.8 - Referrer for preview, popup position option, updated layout
*/

/*** Initialize Page ***/

// Default starting values
var oSettings = {
	/* menu action */
	menuplain: 'window',		// open popup window
	menushift: 'inpage',		// overlay info on image
	menuctrl: 'intab',			// open tab
	/* Styling */
	colorscheme: 'auto',		// auto / light / dark
	fontsize: 16,				// font-size for text
	popwidth: 'auto',			// width for popup window [v1.5]
	popheight: 'auto',			// height for popup window [v1.5]
	poptop: 'auto',				// top position for popup window [v1.8]
	popleft: 'auto',			// left position for popup window [v1.8]
	previewstyle: 'topthumb',	// or 'topfitw' or 'classic' for below [v1.8]
	tabinback: false,			// whether to open tab in the background [v1.5]
	autoopen: true				// show bar automatically on stand-alone image pages (FUTURE FEATURE)
}

// Update oSettings from storage
browser.storage.local.get("prefs").then( (results) => {
	if (results.prefs != undefined){
		if (JSON.stringify(results.prefs) != '{}'){
			var arrSavedPrefs = Object.keys(results.prefs)
			for (var j=0; j<arrSavedPrefs.length; j++){
				oSettings[arrSavedPrefs[j]] = results.prefs[arrSavedPrefs[j]];
			}
		}
	}
}).then(() => {
	// Context menu select's
	var sels = document.querySelectorAll('select[name^="menu"]');
	for (var i=0; i<sels.length; i++){
		var selopt = document.querySelector('select[name="' + sels[i].name + '"] option[value="' + oSettings[sels[i].name] + '"]');
		selopt.setAttribute('selected', 'selected');
	}
	// Color scheme
	document.forms[0].radColors.value = oSettings.colorscheme;
	// Font size select
	sels = document.querySelectorAll('select[name*="fontsize"]');
	for (var i=0; i<sels.length; i++){
		var selopt = document.querySelector('select[name="' + sels[i].name + '"] option[value="size' + oSettings[sels[i].name] + '"]');
		selopt.setAttribute('selected', 'selected');
	}
	// Preview position
	document.forms[0].radPreview.value = oSettings.previewstyle;
	// Popup sizing
	if (oSettings.popwidth == 'auto'){
		document.forms[0].radSizing.value = 'auto';
		document.querySelector('[name="radSizing"][value="capture"]').setAttribute('disabled', true);
		document.getElementById('currwidth').textContent = 'N/A';
		document.getElementById('currheight').textContent = 'N/A';
		document.getElementById('currleft').textContent = 'N/A';
		document.getElementById('currtop').textContent = 'N/A';
	} else {
		document.forms[0].radSizing.value = 'capture';
		document.getElementById('currwidth').textContent = oSettings.popwidth;
		document.getElementById('currheight').textContent = oSettings.popheight;
		if (oSettings.popleft == 'auto'){
			document.getElementById('currleft').textContent = 'N/A';
			document.getElementById('currtop').textContent = 'N/A';
		} else {
			document.getElementById('savepos').style.display = 'inline';
			document.getElementById('currleft').textContent = oSettings.popleft;
			document.getElementById('currtop').textContent = oSettings.poptop;
		}
	}
	// Checkboxes
	var chks = document.querySelectorAll('.chk input[type="checkbox"]');
	for (i=0; i<chks.length; i++){
		if (oSettings[chks[i].name] == true) chks[i].checked = true;
		else chks[i].checked = false;
	}
	// More to come later
}).catch((err) => {
	console.log('Error retrieving "prefs" from storage: '+err.message);
});

/*** Handle User Actions ***/

// Update storage
function updatePref(evt){
	if (evt.target.className != 'savebtn') return;
	// Context menu select's
	var sels = document.querySelectorAll('select[name^="menu"]');
	for (var i=0; i<sels.length; i++){
		oSettings[sels[i].name] = sels[i].value;
	}
	// Color scheme
	oSettings.colorscheme = document.forms[0].radColors.value;
	// Font size selects
	sels = document.querySelectorAll('select[name*="fontsize"]');
	for (var i=0; i<sels.length; i++){
		oSettings[sels[i].name] = parseInt(sels[i].value.slice(4));
	}
	// Preview position
	oSettings.previewstyle = document.forms[0].radPreview.value;
	// Popup sizing
	if (document.forms[0].radSizing.value == 'auto'){
		oSettings.popwidth = 'auto';
		oSettings.popheight = 'auto';
		oSettings.poptop = 'auto';
		oSettings.popleft = 'auto';
	} else {
		// no-op, can't change these here
	}
	// Checkboxes
	var chks = document.querySelectorAll('.chk input[type="checkbox"]');
	for (var i=0; i<chks.length; i++){
		oSettings[chks[i].name] = chks[i].checked;
	}
	// More to come later
	
	// Update storage
	browser.storage.local.set(
		{prefs: oSettings}
	).then(() => {
		// Clean up highlighting
		var lbls = document.querySelectorAll('label');
		for (var i=0; i<lbls.length; i++){
			lbls[i].style.backgroundColor = '';
		}
		var btns = document.getElementsByClassName('savebtn');
		for (i=0; i<btns.length; i++){
			btns[i].style.backgroundColor = '';
		}
		evt.target.blur();
		// Send update to background
		browser.runtime.sendMessage({
			update: 'fromStorage'
		});
	}).catch((err) => {
		console.log('Error on browser.storage.local.set(): ' + err.message);
	});
}

function lightSaveBtn(evt){
	if (!['INPUT', 'SELECT'].includes(evt.target.nodeName)) return;
	var chgd = false;
	var frm = evt.target.closest('form');
	var chgCount = frm.getAttribute('chgcount');
	switch (evt.target.type){
		case 'checkbox':
			if (evt.target.checked !== oSettings[evt.target.name]){
				chgCount++;
				evt.target.labels[0].className = 'changed';
			} else {
				chgCount--;
				evt.target.labels[0].className = '';
			}
			break;
		case 'radio':
			switch (evt.target.name){
				case 'radColors':
					if (evt.target.value != oSettings.colorscheme) chgd = true;
					else chgd = false;
					break;
				case 'radPreview':
					if (evt.target.value != oSettings.previewstyle) chgd = true;
					else chgd = false;
					break;
				case 'radSizing':
					if (evt.target.value == 'auto' && oSettings.popwidth != 'auto') chgd = true;
					else chgd = false;
					break;
			}
			if (chgd){
				chgCount++;
				var rads = frm.querySelectorAll('input[name="' + evt.target.name + '"]');
				for (var i=0; i<rads.length; i++){
					if (rads[i].getAttribute('value') == evt.target.getAttribute('value')) rads[i].labels[0].className = 'changed';
					else {
						if (rads[i].labels[0].className == 'changed') chgCount--; // change was already counted
						rads[i].labels[0].className = '';
					}
				}
			} else {
				chgCount--;
				var rads = frm.querySelectorAll('input[name="' + evt.target.name + '"]');
				for (var i=0; i<rads.length; i++){
					rads[i].labels[0].className = '';
				}
			}
			break;
		case 'select-one':
			if (evt.target.name.indexOf('menu') > -1){
				if (evt.target.value !== oSettings[evt.target.name]){
					chgCount++;
					evt.target.labels[0].className = 'changed';
				} else {
					chgCount--;
					evt.target.labels[0].className = '';
				}
			} else if (evt.target.name.indexOf('fontsize') > -1){
				if (evt.target.value !== 'size' + oSettings[evt.target.name]){
					chgCount++;
					evt.target.labels[0].className = 'changed';
				} else {
					chgCount--;
					evt.target.labels[0].className = '';
				}
			}
			break;
		default:
			// none of these 
	}
	frm.setAttribute('chgcount', chgCount);
	var btns = frm.getElementsByClassName('savebtn');
	for (i=0; i<btns.length; i++){
		if (chgCount > 0) btns[i].style.backgroundColor = '#ff0';
		else btns[i].style.backgroundColor = '';
	}
}

// Attach event handler to the Save buttons
document.forms[0].addEventListener('click', updatePref, false);
document.forms[0].addEventListener('change', lightSaveBtn, false);
